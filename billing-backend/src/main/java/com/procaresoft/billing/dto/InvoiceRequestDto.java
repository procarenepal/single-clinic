package com.procaresoft.billing.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
    
    // IRD Credentials from ClinicSettings
    private boolean irdEnabled;
    private String irdApiUrl;
    private String irdApiUsername;
    private String irdApiPassword;
    private String sellerPan;
    private String fiscalYear;
    
    private List<InvoiceItemDto> items;

    @Data
    public static class InvoiceItemDto {
        private String itemName;
        private Integer quantity;
        private BigDecimal rate;
        private BigDecimal totalAmount;
        private boolean isTaxable;
    }
}
