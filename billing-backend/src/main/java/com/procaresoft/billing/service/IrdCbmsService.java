package com.procaresoft.billing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procaresoft.billing.model.ClinicIrdConfig;
import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.model.IrdSyncLog;
import com.procaresoft.billing.repository.IrdSyncLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpMethod;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Submits invoices to IRD's CBMS API. Credentials are always resolved
 * server-side via ClinicIrdConfigService, keyed by the invoice's owning
 * clinic — this service never accepts credentials from a caller.
 *
 * Every attempt (success, failure, or skipped-as-unconfigured) is recorded in
 * ird_sync_log as an immutable audit row — the record that proves what was
 * actually sent to/received from IRD for a given invoice.
 */
@Service
@RequiredArgsConstructor
public class IrdCbmsService {

    private static final Logger log = LoggerFactory.getLogger(IrdCbmsService.class);

    private static final Map<String, String> ENVIRONMENT_ENDPOINTS = Map.of(
            "live", "https://cbapi.ird.gov.np",
            "sandbox", "https://cbapi.ird.gov.np/sandbox",
            "mock", "mock");

    private final ClinicIrdConfigService clinicIrdConfigService;
    private final IrdSyncLogRepository irdSyncLogRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SyncResult syncInvoice(Invoice invoice, String fiscalYear, boolean isReturn) {
        Optional<ClinicIrdConfig> configOpt = clinicIrdConfigService.resolveForClinic(invoice.getClinicId());
        if (configOpt.isEmpty() || !configOpt.get().isEnabled()) {
            SyncResult result = new SyncResult(false, "IRD sync is not configured or not enabled for this clinic", "400");
            persistLog(invoice, null, result);
            return result;
        }
        ClinicIrdConfig config = configOpt.get();

        String baseUrl = resolveBaseUrl(config);
        Map<String, Object> payload = buildPayload(invoice, config, fiscalYear, isReturn);

        if ("mock".equals(baseUrl)) {
            log.info("MOCK IRD sync for invoice {} (clinic {})", invoice.getInvoiceNumber(), invoice.getClinicId());
            SyncResult result = new SyncResult(true, "MOCK: not actually sent to IRD", "200-MOCK");
            persistLog(invoice, payload, result);
            return result;
        }

        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            // Guards against a malformed manual clinic_ird_config.ird_api_url (e.g. someone
            // saved "test" as a placeholder) reaching RestTemplate, which throws an opaque
            // IllegalArgumentException("URI is not absolute") instead of a clean failure.
            SyncResult result = new SyncResult(false,
                    "Configured IRD API URL is not a valid absolute URL: " + baseUrl, "400");
            persistLog(invoice, payload, result);
            return result;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            String endpoint = isReturn ? baseUrl + "/api/billreturn" : baseUrl + "/api/bill";

            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, entity, String.class);

            SyncResult result = interpretCbmsResponse(
                    response.getStatusCode().value(), response.getBody(), isReturn);
            persistLog(invoice, payload, result, response.getBody());
            return result;

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.warn("HTTP error during IRD sync for invoice {}: {} - {}", invoice.getInvoiceNumber(),
                    e.getStatusCode(), e.getResponseBodyAsString());
            SyncResult result = new SyncResult(false, "Sync failed: " + e.getResponseBodyAsString(),
                    String.valueOf(e.getStatusCode().value()));
            persistLog(invoice, payload, result, e.getResponseBodyAsString());
            return result;
        } catch (Exception e) {
            log.error("Exception during IRD sync for invoice {}", invoice.getInvoiceNumber(), e);
            SyncResult result = new SyncResult(false, "Exception during IRD sync: " + e.getMessage(), "500");
            persistLog(invoice, payload, result, e.getMessage());
            return result;
        }
    }

    /**
     * CBMS reports its verdict as an application code in the response BODY,
     * not in the HTTP status. Per the API documentation (2079 Ashoj 28):
     *
     *   200  success
     *   100  API credentials do not match
     *   101  bill already exists          (/api/bill)
     *        bill does not exist          (/api/billreturn)
     *   102  exception while saving bill details
     *   103  unknown exception — check URL and model
     *   104  model invalid
     *   105  bill does not exist          (/api/billreturn, sales return)
     *
     * This used to treat any HTTP 2xx as a successful filing and never read
     * the body. A credentials rotation at IRD would therefore have marked
     * every subsequent invoice as synced while none were accepted — and
     * nothing downstream could have told, because the ledger, the Schedule 5
     * register, the retry scheduler and the Firestore mirror all key off
     * SyncResult.isSuccess().
     *
     * The stored responseCode is now the CBMS code itself, so cbms_response_code
     * in the ledger says what IRD actually said. Package-private and static
     * so the mapping can be tested without a Spring context or a network.
     */
    static SyncResult interpretCbmsResponse(int httpStatus, String body, boolean isReturn) {
        if (httpStatus < 200 || httpStatus > 299) {
            return new SyncResult(false, "Sync failed: HTTP " + httpStatus + " " + nullToEmpty(body),
                    String.valueOf(httpStatus));
        }

        String code = extractCbmsCode(body);
        if (code == null) {
            // Off-contract: a 2xx with no recognisable code. Refusing to call
            // this a success is the safe direction — the scheduler retries it
            // (bounded) and the failures report shows it, rather than the
            // ledger claiming a filing nobody can confirm.
            return new SyncResult(false,
                    "Sync failed: CBMS returned HTTP " + httpStatus + " with no recognisable response code: "
                    + nullToEmpty(body), "2xx-NOCODE");
        }

        switch (code) {
            case "200":
                return new SyncResult(true, "Synced successfully", code);
            case "101":
                // Same code, opposite meaning on the two endpoints. On /api/bill
                // it means IRD already holds this number — a retry of a filing
                // that did land, which is exactly the idempotent case and is
                // correctly recorded as synced. On /api/billreturn it means the
                // referenced original is unknown to IRD, which is a hard failure.
                return isReturn
                        ? new SyncResult(false, "Sync failed: CBMS 101 — referenced bill does not exist", code)
                        : new SyncResult(true, "Synced: CBMS 101 — bill already exists (previously filed)", code);
            case "100":
                return new SyncResult(false, "Sync failed: CBMS 100 — API credentials do not match", code);
            case "102":
                return new SyncResult(false, "Sync failed: CBMS 102 — exception while saving bill details", code);
            case "103":
                return new SyncResult(false, "Sync failed: CBMS 103 — unknown exception, check API URL and model", code);
            case "104":
                return new SyncResult(false, "Sync failed: CBMS 104 — model invalid", code);
            case "105":
                return new SyncResult(false, "Sync failed: CBMS 105 — bill does not exist (sales return)", code);
            default:
                return new SyncResult(false, "Sync failed: CBMS returned unrecognised code " + code, code);
        }
    }

    /**
     * The documented contract is a bare code ("200"). Tolerate the obvious
     * wrappers a .NET host might add — surrounding quotes, whitespace, a JSON
     * object carrying the code as a value — without accepting arbitrary
     * digits from an error page: only a standalone 3-digit CBMS code counts.
     */
    static String extractCbmsCode(String body) {
        if (body == null) return null;
        String s = body.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
            s = s.substring(1, s.length() - 1).trim();
        }
        if (s.matches("\\d{3}")) return s;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?<![\\d.])(\\d{3})(?![\\d.])").matcher(s);
        if (m.find()) return m.group(1);
        return null;
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private void persistLog(Invoice invoice, Map<String, Object> payload, SyncResult result) {
        persistLog(invoice, payload, result, null);
    }

    private void persistLog(Invoice invoice, Map<String, Object> payload, SyncResult result, String responseBody) {
        try {
            IrdSyncLog entry = new IrdSyncLog();
            entry.setInvoiceId(invoice.getId());
            entry.setRequestPayloadJson(payload != null ? objectMapper.writeValueAsString(redact(payload)) : null);
            entry.setResponseCode(result.getResponseCode());
            entry.setResponseBody(responseBody != null ? responseBody : result.getMessage());
            entry.setSuccess(result.isSuccess());
            irdSyncLogRepository.save(entry);
        } catch (Exception e) {
            // Logging failure must never break the actual sync flow — but it should be loud.
            log.error("Failed to persist IRD sync audit log for invoice {}", invoice.getInvoiceNumber(), e);
        }
    }

    private Map<String, Object> redact(Map<String, Object> payload) {
        Map<String, Object> copy = new HashMap<>(payload);
        if (copy.containsKey("password")) {
            copy.put("password", "***REDACTED***");
        }
        return copy;
    }

    private String resolveBaseUrl(ClinicIrdConfig config) {
        // Mock environment always wins, regardless of what's saved in
        // ird_api_url — the settings UI auto-fills that field with the real
        // IRD endpoint for display purposes even while "Mock" is selected,
        // and a manual override must never accidentally route mock-mode
        // traffic to IRD's real API.
        if ("mock".equals(config.getIrdEnvironment())) {
            return "mock";
        }
        String manual = config.getIrdApiUrl();
        if (manual != null && !manual.isBlank()) {
            return manual.replaceAll("/$", "");
        }
        return ENVIRONMENT_ENDPOINTS.getOrDefault(config.getIrdEnvironment(), "mock");
    }

    private Map<String, Object> buildPayload(Invoice invoice, ClinicIrdConfig config, String fiscalYear, boolean isReturn) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("username", config.getIrdApiUsername());
        payload.put("password", config.getIrdApiPassword());
        payload.put("seller_pan", config.getSellerPan());
        payload.put("buyer_pan", invoice.getBuyerPan() != null ? invoice.getBuyerPan() : "");
        payload.put("buyer_name", invoice.getBuyerName() != null ? invoice.getBuyerName() : "Cash Sales");
        payload.put("fiscal_year", fiscalYear);
        payload.put("invoice_number", invoice.getInvoiceNumber());
        payload.put("invoice_date",
                invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : java.time.LocalDate.now().toString());
        payload.put("total_sales", invoice.getTotalAmount());
        payload.put("taxable_sales_vat", invoice.getTaxableAmount());
        payload.put("vat", invoice.getTaxAmount());
        // Excise, Health Service Tax, and Education Service Fee are not
        // charged by this system — sent as 0 to match IRD's documented
        // field list exactly (CBMS API Technical Document for Software
        // Developers), rather than omitting them or sending an undocumented
        // "zero_rated_sales" field their model binder doesn't expect.
        payload.put("excisable_amount", 0);
        payload.put("excise", 0);
        payload.put("taxable_sales_hst", 0);
        payload.put("hst", 0);
        payload.put("amount_for_esf", 0);
        payload.put("esf", 0);
        payload.put("export_sales", 0);
        payload.put("tax_exempted_sales", invoice.getExemptAmount());
        payload.put("isrealtime", true);
        payload.put("datetimeClient", java.time.LocalDateTime.now().toString());

        // /api/billreturn requires 4 fields beyond /api/bill's set (CBMS API
        // Technical Document, "API to post credit note (sales return)"):
        // ref_invoice_number, credit_note_number, credit_note_date,
        // reason_for_return. credit_note_number/date are just this credit
        // note's own invoice_number/invoice_date — only the reference to the
        // ORIGINAL invoice and the reason are separately persisted fields.
        if (isReturn) {
            payload.put("ref_invoice_number", invoice.getRefInvoiceNumber() != null ? invoice.getRefInvoiceNumber() : "");
            payload.put("credit_note_number", invoice.getInvoiceNumber());
            payload.put("credit_note_date", invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : "");
            payload.put("reason_for_return", invoice.getReasonForReturn() != null ? invoice.getReasonForReturn() : "");
        }

        return payload;
    }

    public static class SyncResult {
        private final boolean success;
        private final String message;
        private final String responseCode;

        public SyncResult(boolean success, String message, String responseCode) {
            this.success = success;
            this.message = message;
            this.responseCode = responseCode;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public String getResponseCode() { return responseCode; }
    }
}
