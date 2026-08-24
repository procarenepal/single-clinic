package com.procaresoft.billing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IrdSyncRequestDto {
    @JsonProperty("irdEnabled")
    private boolean irdEnabled;

    @JsonProperty("irdApiUrl")
    private String irdApiUrl;

    @JsonProperty("irdApiUsername")
    private String irdApiUsername;

    @JsonProperty("irdApiPassword")
    private String irdApiPassword;

    @JsonProperty("sellerPan")
    private String sellerPan;

    @JsonProperty("fiscalYear")
    private String fiscalYear;

    @JsonProperty("isReturn")
    private boolean isReturn;

    public boolean isIrdEnabled() { return irdEnabled; }
    public void setIrdEnabled(boolean irdEnabled) { this.irdEnabled = irdEnabled; }

    public String getIrdApiUrl() { return irdApiUrl; }
    public void setIrdApiUrl(String irdApiUrl) { this.irdApiUrl = irdApiUrl; }

    public String getIrdApiUsername() { return irdApiUsername; }
    public void setIrdApiUsername(String irdApiUsername) { this.irdApiUsername = irdApiUsername; }

    public String getIrdApiPassword() { return irdApiPassword; }
    public void setIrdApiPassword(String irdApiPassword) { this.irdApiPassword = irdApiPassword; }

    public String getSellerPan() { return sellerPan; }
    public void setSellerPan(String sellerPan) { this.sellerPan = sellerPan; }

    public String getFiscalYear() { return fiscalYear; }
    public void setFiscalYear(String fiscalYear) { this.fiscalYear = fiscalYear; }

    public boolean isReturn() { return isReturn; }
    public void setReturn(boolean isReturn) { this.isReturn = isReturn; }
}
