package com.procaresoft.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Request to atomically reserve the next number from the shared invoice
 * sequence WITHOUT creating an Invoice row. Exists for callers that must
 * allocate the number before some other, non-Java state change commits (e.g.
 * pharmacy's Firestore transaction, which deducts stock and can't be rolled
 * back the way an unsaved invoice can) — see BillingController.reserveNumber
 * and InvoiceRequestDto.preAssignedInvoiceNumber.
 */
@Data
public class ReserveInvoiceNumberRequestDto {
    @NotBlank(message = "fiscalYear is required")
    @Pattern(regexp = "^\\d{4}\\.\\d{2,3}$", message = "fiscalYear must look like 2080.081")
    private String fiscalYear;

    /** Optional — e.g. "PUR" for a pharmacy sale. Defaults to "INV" when omitted. */
    private String prefix;
}
