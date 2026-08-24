package com.procaresoft.billing.service;

import com.procaresoft.billing.model.Invoice;
import com.procaresoft.billing.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class InvoiceSequenceService {

    private final InvoiceRepository invoiceRepository;

    private static final String PREFIX = "INV-";

    /**
     * Generates a sequential invoice number (e.g., INV-0001, INV-0002)
     * Synchronized to prevent race conditions in a single-instance deployment.
     */
    @Transactional
    public synchronized String generateNextInvoiceNumber() {
        Optional<Invoice> lastInvoice = invoiceRepository.findFirstByOrderByIdDesc();

        if (lastInvoice.isPresent() && lastInvoice.get().getInvoiceNumber() != null
                && lastInvoice.get().getInvoiceNumber().startsWith(PREFIX)) {
            String lastNumberStr = lastInvoice.get().getInvoiceNumber().replace(PREFIX, "");
            try {
                long lastNumber = Long.parseLong(lastNumberStr);
                return PREFIX + String.format("%04d", lastNumber + 1);
            } catch (NumberFormatException e) {
                // If the last invoice number was not numeric (e.g., old UUID format), fallback
                // to timestamp or a default
                return PREFIX + System.currentTimeMillis();
            }
        } else {
            // First invoice
            return PREFIX + "0001";
        }
    }
}
