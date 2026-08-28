package com.procaresoft.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Response shape for reading back a clinic's IRD config. Never carries the
 * password itself — only whether one is currently set — so a GET can never
 * leak the credential.
 */
@Data
@AllArgsConstructor
public class ClinicIrdConfigResponseDto {
    private String sellerPan;
    private String irdEnvironment;
    private String irdApiUrl;
    private String irdApiUsername;
    private boolean hasPassword;
    private boolean enabled;
}
