package com.procaresoft.billing.dto;

import com.procaresoft.billing.model.Invoice;
import lombok.Data;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * One row of the master invoice/sales table IRD's Electronic Billing
 * Procedure, Schedule 5 (अनुसूची ५), requires: a per-fiscal-year table with
 * exactly these attributes, viewable and printable from the front end
 * (clause 6(ङ)). Field names below match the schedule's own field list.
 *
 * Printed_by/Is_Bill_Printed/Printed_Time are sourced from Invoice's own
 * print_count/last_printed_at/last_printed_by columns (see /record-print),
 * kept in sync with the Firestore-side printCount the frontend also tracks.
 * Transaction_Id/VAT_Refund_Amount are still always null — Schedule 8's
 * digital-payment VAT rebate flow is not yet implemented (see
 * docs/IRD_CBMS_INTEGRATION.md).
 */
@Data
public class Schedule5RecordDto {
    private final String fiscalYear;
    private final String billNo;
    private final String customerName;
    private final String customerPan;
    private final String billDate;
    private final BigDecimal amount;
    private final BigDecimal discount;
    private final BigDecimal taxableAmount;
    private final BigDecimal taxAmount;
    private final BigDecimal totalAmount;
    private final boolean syncWithIrd;
    // Deliberately not named isBillPrinted/isBillActive/isRealtime: Lombok's
    // boolean getter for a field already starting with "is" reuses that name
    // verbatim (isBillActive() rather than isIsBillActive()), which Jackson
    // then serializes by stripping the "is" prefix — producing JSON key
    // "billActive", silently breaking any client expecting "isBillActive".
    private final Boolean billPrinted;
    private final boolean billActive;
    private final String printedTime;
    private final String enteredBy;
    private final String printedBy;
    private final Boolean realtime;
    private final String paymentMethod;
    private final BigDecimal vatRefundAmount;
    private final String transactionId;

    public static Schedule5RecordDto fromInvoice(Invoice invoice) {
        // "Amount" per the schedule is the pre-discount gross; our stored
        // totalAmount is already post-discount, so add the discount back.
        BigDecimal discount = invoice.getDiscountAmount() != null ? invoice.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal amount = invoice.getTotalAmount() != null ? invoice.getTotalAmount().add(discount) : null;

        // Best-effort proxy for "was this sent to IRD in real time at issuance,
        // vs. picked up later by the retry scheduler": zero retry attempts
        // recorded means the first (and only) attempt happened at creation.
        Boolean isRealtime = invoice.isIrdSynced() ? invoice.getIrdSyncAttempts() == 0 : null;

        return new Schedule5RecordDto(
                invoice.getFiscalYear(),
                invoice.getInvoiceNumber(),
                invoice.getBuyerName(),
                invoice.getBuyerPan(),
                invoice.getInvoiceDate() != null ? invoice.getInvoiceDate().toString() : null,
                amount,
                discount,
                invoice.getTaxableAmount(),
                invoice.getTaxAmount(),
                invoice.getTotalAmount(),
                invoice.isIrdSynced(),
                invoice.getPrintCount() > 0,
                invoice.isActive(),
                invoice.getLastPrintedAt() != null
                        ? invoice.getLastPrintedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        : null,
                invoice.getCreatedByUid(),
                invoice.getLastPrintedBy(),
                isRealtime,
                invoice.getPaymentMethod(),
                null,
                null);
    }
}
