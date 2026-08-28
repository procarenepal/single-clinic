package com.procaresoft.billing.service;

import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Automated retry for invoices that failed to sync to IRD on creation.
 *
 * Backoff: 1min, 5min, 30min, 2h, 12h (attempt index -> delay). After
 * MAX_ATTEMPTS failures, the invoice is flagged irdNeedsManualReview and no
 * longer auto-retried — it needs a human to look at it (bad credentials,
 * IRD outage, permanently malformed data, etc.) rather than retrying forever
 * silently, which would hide a real compliance gap.
 */
@Service
@RequiredArgsConstructor
public class IrdSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(IrdSyncScheduler.class);
    private static final int MAX_ATTEMPTS = 5;
    private static final long[] BACKOFF_MINUTES = { 1, 5, 30, 120, 720 };

    private final InvoiceRepository invoiceRepository;
    private final IrdCbmsService irdCbmsService;

    @Scheduled(fixedDelayString = "60000")
    public void retryFailedIrdSyncs() {
        List<Invoice> failedInvoices = invoiceRepository.findByIrdSyncedFalse();
        if (failedInvoices.isEmpty()) {
            return;
        }

        for (Invoice invoice : failedInvoices) {
            if (invoice.isIrdNeedsManualReview()) {
                continue;
            }
            if (invoice.getFiscalYear() == null) {
                // Legacy rows created before fiscalYear was tracked on Invoice — can't
                // safely resolve which IRD fiscal-year bucket to submit under.
                continue;
            }
            if (!isDueForRetry(invoice)) {
                continue;
            }

            try {
                boolean isReturn = invoice.getTotalAmount() != null && invoice.getTotalAmount().signum() < 0;
                IrdCbmsService.SyncResult syncResult = irdCbmsService.syncInvoice(invoice, invoice.getFiscalYear(), isReturn);

                invoice.setIrdSyncAttempts(invoice.getIrdSyncAttempts() + 1);
                invoice.setIrdLastAttemptAt(LocalDateTime.now());
                invoice.setCbmsResponseCode(syncResult.getResponseCode());

                if (syncResult.isSuccess()) {
                    invoice.setIrdSynced(true);
                    invoice.setIrdSyncDate(LocalDateTime.now());
                    log.info("Successfully synced invoice: {}", invoice.getInvoiceNumber());
                } else {
                    log.warn("Failed to sync invoice {} (attempt {}/{}): {}", invoice.getInvoiceNumber(),
                            invoice.getIrdSyncAttempts(), MAX_ATTEMPTS, syncResult.getMessage());
                    if (invoice.getIrdSyncAttempts() >= MAX_ATTEMPTS) {
                        invoice.setIrdNeedsManualReview(true);
                        log.error("Invoice {} exceeded {} IRD sync attempts — flagged for manual review",
                                invoice.getInvoiceNumber(), MAX_ATTEMPTS);
                    }
                }
                invoiceRepository.save(invoice);
            } catch (Exception e) {
                log.error("Error processing invoice {}", invoice.getInvoiceNumber(), e);
            }
        }
    }

    private boolean isDueForRetry(Invoice invoice) {
        if (invoice.getIrdLastAttemptAt() == null) {
            return true;
        }
        int attemptIndex = Math.min(invoice.getIrdSyncAttempts(), BACKOFF_MINUTES.length - 1);
        long dueInMinutes = BACKOFF_MINUTES[attemptIndex];
        long minutesSinceLastAttempt = ChronoUnit.MINUTES.between(invoice.getIrdLastAttemptAt(), LocalDateTime.now());
        return minutesSinceLastAttempt >= dueInMinutes;
    }
}
