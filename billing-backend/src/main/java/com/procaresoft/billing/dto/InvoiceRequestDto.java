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

    /** True for a sales-return invoice — routes the IRD submission to /api/billreturn instead of /api/bill. */
    private boolean isReturn;

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

        private boolean isTaxable;
    }
}
