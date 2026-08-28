package com.procaresoft.billing.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * IRD's Electronic Billing Procedure clause 6(झ) requires cancellation to
 * carry a documented reason — this is never optional.
 */
@Data
public class CancelInvoiceRequestDto {
    @NotBlank(message = "reason is required")
    private String reason;
}
