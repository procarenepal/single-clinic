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
        return generateNextInvoiceNumber(clinicId, fiscalYear, null);
    }

    /**
     * Same as {@link #generateNextInvoiceNumber(String, String)}, but with an
     * optional caller-supplied prefix (e.g. the clinic's configured
     * invoicePrefix billing setting, or "CN" for a credit note) instead of
     * the hardcoded "INV" — previously every invoice used the hardcoded
     * prefix regardless of what a clinic's billing settings said, and
     * credit notes had no way to be distinguished by number at all. The
     * underlying counter/sequence is unchanged — only the string label
     * varies, so numbering stays one continuous gapless sequence per
     * clinic+fiscal year as IRD expects.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String generateNextInvoiceNumber(String clinicId, String fiscalYear, String prefix) {
        if (clinicId == null || clinicId.isBlank()) {
            throw new IllegalArgumentException("clinicId is required to generate an invoice number");
        }
        if (fiscalYear == null || !FISCAL_YEAR_PATTERN.matcher(fiscalYear).matches()) {
            throw new IllegalArgumentException("fiscalYear is missing or not in the expected format (e.g. 2080.081)");
        }

        invoiceSequenceRepository.upsertIncrement(clinicId, fiscalYear);
        Long lastNumber = invoiceSequenceRepository.findLastNumber(clinicId, fiscalYear);
        String effectivePrefix = (prefix == null || prefix.isBlank()) ? PREFIX : prefix;

        return effectivePrefix + "-" + fiscalYear + "-" + String.format("%04d", lastNumber);
    }
}
