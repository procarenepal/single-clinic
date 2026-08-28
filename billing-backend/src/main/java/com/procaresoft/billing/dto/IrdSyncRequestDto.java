package com.procaresoft.billing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Retry-sync request. Credentials are resolved server-side from
 * ClinicIrdConfigService using the invoice's owning clinic — never accepted
 * from the client.
 */
public class IrdSyncRequestDto {

    @JsonProperty("fiscalYear")
    @NotBlank(message = "fiscalYear is required")
    @Pattern(regexp = "^\\d{4}\\.\\d{2,3}$", message = "fiscalYear must look like 2080.081")
    private String fiscalYear;

    @JsonProperty("isReturn")
    private boolean isReturn;

    public String getFiscalYear() { return fiscalYear; }
    public void setFiscalYear(String fiscalYear) { this.fiscalYear = fiscalYear; }

    public boolean isReturn() { return isReturn; }
    public void setReturn(boolean isReturn) { this.isReturn = isReturn; }
}
