package com.procaresoft.billing.service;

import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.dto.InvoiceRequestDto;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpMethod;
import java.util.Map;
import java.util.HashMap;

@Service
public class IrdCbmsService {

    private final RestTemplate restTemplate = new RestTemplate();

    public SyncResult syncInvoice(Invoice invoice, InvoiceRequestDto request) {
        if (!request.isIrdEnabled() || request.getIrdApiUrl() == null || request.getIrdApiUrl().isEmpty()) {
            return new SyncResult(false, "IRD sync is not configured", "400");
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("username", request.getIrdApiUsername());
            payload.put("password", request.getIrdApiPassword());
            payload.put("seller_pan", request.getSellerPan());
            payload.put("buyer_pan", request.getBuyerPan() != null ? request.getBuyerPan() : "");
            payload.put("buyer_name", request.getBuyerName() != null ? request.getBuyerName() : "Cash Sales");
            payload.put("fiscal_year", request.getFiscalYear());
            payload.put("invoice_number", invoice.getInvoiceNumber());
            payload.put("invoice_date", java.time.LocalDate.now().toString());
            payload.put("total_sales", request.getTotalAmount());
            payload.put("taxable_sales_vat", request.getTaxableAmount());
            payload.put("vat", request.getTaxAmount());
            payload.put("excise", 0);
            payload.put("tax_exempted_sales", request.getExemptAmount());
            payload.put("zero_rated_sales", 0);
            payload.put("export_sales", 0);
            payload.put("isrealtime", true);
            payload.put("datetimeClient", java.time.LocalDateTime.now().toString());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            // Mock logic removed for production

            ResponseEntity<String> response = restTemplate.exchange(
                    request.getIrdApiUrl(),
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            String responseCode = String.valueOf(response.getStatusCode().value());
            boolean isSuccess = response.getStatusCode().is2xxSuccessful();
            
            return new SyncResult(isSuccess, isSuccess ? "Synced successfully" : "Sync failed: " + response.getBody(), responseCode);
            
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            System.err.println("HTTP Error during IRD sync: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            return new SyncResult(false, "Sync failed: " + e.getResponseBodyAsString(), String.valueOf(e.getStatusCode().value()));
        } catch (Exception e) {
            e.printStackTrace();
            return new SyncResult(false, "Exception during IRD sync: " + e.getMessage(), "500");
        }
    }
    public SyncResult syncInvoice(Invoice invoice, com.procaresoft.billing.dto.IrdSyncRequestDto request) {
        if (!request.isIrdEnabled() || request.getIrdApiUrl() == null || request.getIrdApiUrl().isEmpty()) {
            return new SyncResult(false, "IRD sync is not configured", "400");
        }

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("username", request.getIrdApiUsername());
            payload.put("password", request.getIrdApiPassword());
            payload.put("seller_pan", request.getSellerPan());
            payload.put("buyer_pan", invoice.getBuyerPan() != null ? invoice.getBuyerPan() : "");
            payload.put("buyer_name", invoice.getBuyerName() != null ? invoice.getBuyerName() : "Cash Sales");
            payload.put("fiscal_year", request.getFiscalYear());
            payload.put("invoice_number", invoice.getInvoiceNumber());
            payload.put("invoice_date", invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : java.time.LocalDate.now().toString());
            payload.put("total_sales", invoice.getTotalAmount());
            payload.put("taxable_sales_vat", invoice.getTaxableAmount());
            payload.put("vat", invoice.getTaxAmount());
            payload.put("excise", 0);
            payload.put("tax_exempted_sales", invoice.getExemptAmount());
            payload.put("zero_rated_sales", 0);
            payload.put("export_sales", 0);
            payload.put("isrealtime", true);
            payload.put("datetimeClient", java.time.LocalDateTime.now().toString());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            
            String targetUrl = request.getIrdApiUrl();
            if (request.isReturn() && targetUrl.endsWith("/api/bill")) {
                targetUrl = targetUrl.replace("/api/bill", "/api/billreturn");
            }

            // Mock logic removed for production

            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            String responseCode = String.valueOf(response.getStatusCode().value());
            boolean isSuccess = response.getStatusCode().is2xxSuccessful();
            
            return new SyncResult(isSuccess, isSuccess ? "Synced successfully" : "Sync failed: " + response.getBody(), responseCode);
            
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            System.err.println("HTTP Error during IRD sync: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            return new SyncResult(false, "Sync failed: " + e.getResponseBodyAsString(), String.valueOf(e.getStatusCode().value()));
        } catch (Exception e) {
            e.printStackTrace();
            return new SyncResult(false, "Exception during IRD sync: " + e.getMessage(), "500");
        }
    }


    public static class SyncResult {
        private boolean success;
        private String message;
        private String responseCode;

        public SyncResult(boolean success, String message, String responseCode) {
            this.success = success;
            this.message = message;
            this.responseCode = responseCode;
        }

        public boolean isSuccess() {
            return success;
        }

        public String getMessage() {
            return message;
        }

        public String getResponseCode() {
            return responseCode;
        }
    }
}
