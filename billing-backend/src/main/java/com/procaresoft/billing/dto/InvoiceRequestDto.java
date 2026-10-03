package com.procaresoft.billing.dto;

import lombok.Data;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.util.List;

@Data
public class InvoiceRequestDto {
    private String firebasePatientId;

    @NotBlank(message = "buyerName is required")
    private String buyerName;
    private String buyerPan;

    @NotNull(message = "totalAmount is required")
    private BigDecimal totalAmount;
    @NotNull(message = "taxableAmount is required")
    private BigDecimal taxableAmount;
    @NotNull(message = "taxAmount is required")
    private BigDecimal taxAmount;
    @NotNull(message = "exemptAmount is required")
    private BigDecimal exemptAmount;

    /** Optional — Schedule 5 field. Null if not known/applicable at creation time. */
    private BigDecimal discountAmount;

    /** Optional — Schedule 5 field. Often not known yet for an unpaid invoice at creation time. */
    private String paymentMethod;

    // Intent only — actual IRD credentials are resolved server-side from
    // ClinicIrdConfigService, never accepted from the client.
    private boolean irdEnabled;

    @NotBlank(message = "fiscalYear is required")
    @Pattern(regexp = "^\\d{4}\\.\\d{2,3}$", message = "fiscalYear must look like 2080.081")
    private String fiscalYear;

    /**
     * Optional pre-assigned invoice/receipt number for flows that must
     * allocate their own number atomically alongside other state (e.g.
     * pharmacy, which resolves final amounts and deducts stock inside one
     * Firestore transaction, and needs the receipt number to exist before
     * this endpoint can be called). When omitted, the server allocates the
     * next number via InvoiceSequenceService as normal. When supplied, the
     * database's unique constraint on invoice_number is the safety net
     * against collisions — this does not weaken atomicity, it only lets the
     * number be minted by a different, still-atomic authority.
     */
    private String preAssignedInvoiceNumber;

    /**
     * Client-generated key identifying this specific create-invoice attempt.
     * When a request with a previously-seen key (for this clinic) arrives
     * again — e.g. the browser retrying after a dropped connection —
     * the existing invoice is returned instead of creating a duplicate.
     */
    private String idempotencyKey;

    /**
     * True for a sales-return invoice — routes the IRD submission to
     * /api/billreturn instead of /api/bill.
     *
     * Same Lombok/Jackson trap as InvoiceItemDto.isTaxable, and with worse
     * consequences: the setter is setReturn(), so Jackson bound the property
     * "return" while every client sends "isReturn". The flag never arrived,
     * so credit notes were filed to IRD as ordinary invoices via /api/bill
     * and stored without the ref_invoice_number / reason_for_return that a
     * sales return requires.
     */
    @com.fasterxml.jackson.annotation.JsonProperty("isReturn")
    private boolean isReturn;

    /**
     * Required (per IRD's CBMS API doc) when isReturn is true — the invoice
     * number of the original invoice this credit note reverses. Sent to IRD
     * as ref_invoice_number. Ignored when isReturn is false.
     */
    private String refInvoiceNumber;

    /**
     * Required (per IRD's CBMS API doc) when isReturn is true — the stated
     * reason for the return. Sent to IRD as reason_for_return. Ignored when
     * isReturn is false.
     */
    private String reasonForReturn;

    /**
     * Optional prefix to use instead of the server's hardcoded default
     * (e.g. the clinic's configured invoicePrefix billing setting, or
     * "CN" for a credit note) — see InvoiceSequenceService's overload.
     * Ignored when preAssignedInvoiceNumber is also supplied.
     */
    private String invoicePrefix;

    /**
     * The Firestore collection and document this invoice is being created
     * from (e.g. "medicinePurchases" / "4Jb6EmIiR4oBV5zFETcF"). Optional —
     * older clients send neither — but supplying it is what lets IRD sync
     * state be mirrored back to exactly the right document later, instead of
     * guessing which collection an invoice number belongs to.
     */
    private String sourceCollection;

    private String sourceDocId;

    @NotEmpty(message = "items must not be empty")
    private List<@Valid InvoiceItemDto> items;

    @Data
    public static class InvoiceItemDto {
        @NotBlank(message = "itemName is required")
        private String itemName;

        @NotNull(message = "quantity is required")
        private Integer quantity;

        @NotNull(message = "rate is required")
        private BigDecimal rate;

        @NotNull(message = "totalAmount is required")
        private BigDecimal totalAmount;

        /**
         * Lombok names the setter setTaxable(), so Jackson would bind the
         * JSON property "taxable" — but every client sends "isTaxable".
         * With Spring Boot ignoring unknown properties by default, the flag
         * silently never arrived and every line item was stored as
         * non-taxable. The invoice-level taxable/exempt totals filed to IRD
         * come from their own fields and were never affected.
         */
        @com.fasterxml.jackson.annotation.JsonProperty("isTaxable")
        private boolean isTaxable;
    }
}
