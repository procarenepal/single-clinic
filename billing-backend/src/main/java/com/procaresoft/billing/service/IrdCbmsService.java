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
        Map<String, Object> payload = buildPayload(invoice, config, fiscalYear);

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

            String responseCode = String.valueOf(response.getStatusCode().value());
            boolean isSuccess = response.getStatusCode().is2xxSuccessful();
            SyncResult result = new SyncResult(isSuccess,
                    isSuccess ? "Synced successfully" : "Sync failed: " + response.getBody(), responseCode);
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
        String manual = config.getIrdApiUrl();
        if (manual != null && !manual.isBlank()) {
            return manual.replaceAll("/$", "");
        }
        return ENVIRONMENT_ENDPOINTS.getOrDefault(config.getIrdEnvironment(), "mock");
    }

    private Map<String, Object> buildPayload(Invoice invoice, ClinicIrdConfig config, String fiscalYear) {
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
        payload.put("excise", 0);
        payload.put("tax_exempted_sales", invoice.getExemptAmount());
        payload.put("zero_rated_sales", 0);
        payload.put("export_sales", 0);
        payload.put("isrealtime", true);
        payload.put("datetimeClient", java.time.LocalDateTime.now().toString());
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
