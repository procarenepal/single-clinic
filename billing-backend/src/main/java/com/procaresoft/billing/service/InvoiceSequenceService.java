package com.procaresoft.billing.service;

import com.procaresoft.billing.repository.InvoiceSequenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

/**
 * Generates gapless, monotonic invoice numbers scoped per clinic + Nepali fiscal year,
 * as IRD expects. Uses a single atomic INSERT ... ON DUPLICATE KEY UPDATE against a
 * dedicated counter table (see InvoiceSequenceRepository.upsertIncrement) so numbering
 * stays correct across concurrent requests and multiple app instances — replacing the
 * old in-JVM `synchronized` + "read last invoice" approach, which was not safe beyond a
 * single instance and could fall back to a non-sequential timestamp format.
 */
@Service
@RequiredArgsConstructor
public class InvoiceSequenceService {

    private static final String PREFIX = "INV";
    // Matches the Nepali fiscal-year format used throughout the app, e.g. "2080.081"
    private static final Pattern FISCAL_YEAR_PATTERN = Pattern.compile("^\\d{4}\\.\\d{2,3}$");

    private final InvoiceSequenceRepository invoiceSequenceRepository;

    /**
     * Allocates and returns the next invoice number for a clinic/fiscal-year, incrementing
     * the underlying counter in the same transaction. Must be called within the same
     * @Transactional boundary that persists the Invoice row, so a number is never issued
     * without a corresponding saved invoice.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String generateNextInvoiceNumber(String clinicId, String fiscalYear) {
        if (clinicId == null || clinicId.isBlank()) {
            throw new IllegalArgumentException("clinicId is required to generate an invoice number");
        }
        if (fiscalYear == null || !FISCAL_YEAR_PATTERN.matcher(fiscalYear).matches()) {
            throw new IllegalArgumentException("fiscalYear is missing or not in the expected format (e.g. 2080.081)");
        }

        invoiceSequenceRepository.upsertIncrement(clinicId, fiscalYear);
        Long lastNumber = invoiceSequenceRepository.findLastNumber(clinicId, fiscalYear);

        return PREFIX + "-" + fiscalYear + "-" + String.format("%04d", lastNumber);
    }
}
