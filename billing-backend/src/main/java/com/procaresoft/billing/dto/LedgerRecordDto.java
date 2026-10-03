package com.procaresoft.billing.dto;

import com.procaresoft.billing.model.Invoice;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * One row of the authoritative MySQL ledger, shaped for reconciliation
 * against the parallel Firestore copy the UI reads from.
 *
 * Deliberately exposes what Schedule5RecordDto does not — id, the sync
 * attempt/response/review state, and the source-document pointer — because
 * those are exactly the fields needed to answer "did this sale actually
 * reach IRD, and which Firestore document is it?". Schedule5RecordDto stays
 * as-is: its field list is dictated by IRD's Schedule 5 and must not drift
 * to suit an internal tool.
 */
@Data
public class LedgerRecordDto {

    private final Long id;
    private final String invoiceNumber;
    private final String invoiceDate;
    private final String fiscalYear;
    private final String buyerName;
    private final String buyerPan;
    private final BigDecimal totalAmount;
    private final BigDecimal taxableAmount;
    private final BigDecimal taxAmount;
    private final BigDecimal exemptAmount;
    private final BigDecimal discountAmount;
    private final boolean irdSynced;
    private final String irdSyncDate;
    private final String cbmsResponseCode;
    private final int irdSyncAttempts;
    private final boolean irdNeedsManualReview;
    private final boolean active;
    private final String refInvoiceNumber;
    private final String sourceCollection;
    private final String sourceDocId;
    private final String createdAt;

    public static LedgerRecordDto fromInvoice(Invoice invoice) {
        return new LedgerRecordDto(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : null,
                invoice.getFiscalYear(),
                invoice.getBuyerName(),
                invoice.getBuyerPan(),
                invoice.getTotalAmount(),
                invoice.getTaxableAmount(),
                invoice.getTaxAmount(),
                invoice.getExemptAmount(),
                invoice.getDiscountAmount(),
                invoice.isIrdSynced(),
                invoice.getIrdSyncDate() != null
                        ? invoice.getIrdSyncDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        : null,
                invoice.getCbmsResponseCode(),
                invoice.getIrdSyncAttempts(),
                invoice.isIrdNeedsManualReview(),
                invoice.isActive(),
                invoice.getRefInvoiceNumber(),
                invoice.getSourceCollection(),
                invoice.getSourceDocId(),
                invoice.getCreatedAt() != null
                        ? invoice.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        : null);
    }
}
