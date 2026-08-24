package com.procaresoft.billing.service;

import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.repository.InvoiceRepository;
import com.procaresoft.billing.dto.IrdSyncRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class IrdSyncScheduler {

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;

    @Value("${ird.api.enabled:false}")
    private boolean irdEnabled;

    @Value("${ird.api.url:}")
    private String irdApiUrl;

    @Value("${ird.api.username:}")
    private String irdApiUsername;

    @Value("${ird.api.password:}")
    private String irdApiPassword;
    
    @Value("${ird.api.seller-pan:}")
    private String sellerPan;
    
    @Value("${ird.api.fiscal-year:80/81}")
    private String fiscalYear;

    // Run every 60 seconds (60000 ms)
    @Scheduled(fixedDelayString = "60000")
    public void retryFailedIrdSyncs() {
        // Firebase handles offline syncs via Firestore caching and retry buttons (Option A).
        // Disable Java offline syncing completely.
        if (true) return;
        
        if (!irdEnabled) {
            return;
        }

        List<Invoice> failedInvoices = invoiceRepository.findByIrdSyncedFalse();
        if (failedInvoices.isEmpty()) {
            return; // Nothing to sync
        }

        System.out.println("[IRD Scheduler] Found " + failedInvoices.size() + " failed invoices. Attempting sync...");

        for (Invoice invoice : failedInvoices) {
            try {
                IrdSyncRequestDto requestDto = new IrdSyncRequestDto();
                requestDto.setIrdEnabled(true);
                requestDto.setIrdApiUrl(irdApiUrl);
                requestDto.setIrdApiUsername(irdApiUsername);
                requestDto.setIrdApiPassword(irdApiPassword);
                requestDto.setSellerPan(sellerPan);
                requestDto.setFiscalYear(fiscalYear);
                
                // Assuming negative total amount means it's a return
                boolean isReturn = invoice.getTotalAmount() != null && invoice.getTotalAmount().signum() < 0;
                requestDto.setReturn(isReturn);

                IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(invoice, requestDto);
                
                if (syncResult.isSuccess()) {
                    invoice.setIrdSynced(true);
                    invoice.setIrdSyncDate(LocalDateTime.now());
                    invoice.setCbmsResponseCode(syncResult.getResponseCode());
                    invoiceRepository.save(invoice);
                    System.out.println("[IRD Scheduler] Successfully synced invoice: " + invoice.getInvoiceNumber());
                } else {
                    invoice.setCbmsResponseCode(syncResult.getResponseCode());
                    invoiceRepository.save(invoice);
                    System.err.println("[IRD Scheduler] Failed to sync invoice: " + invoice.getInvoiceNumber() + ". Reason: " + syncResult.getMessage());
                }
            } catch (Exception e) {
                System.err.println("[IRD Scheduler] Error processing invoice " + invoice.getInvoiceNumber() + ": " + e.getMessage());
            }
        }
    }
}
