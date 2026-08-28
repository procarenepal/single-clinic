package com.procaresoft.billing.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Upsert payload for a clinic's IRD credentials. The password is write-only:
 * omit it (null) to leave the currently-stored password unchanged.
 */
@Data
public class ClinicIrdConfigRequestDto {

    private String sellerPan;

    @Pattern(regexp = "mock|sandbox|live", message = "irdEnvironment must be one of: mock, sandbox, live")
    private String irdEnvironment = "mock";

    /** Optional manual override for the IRD base URL — must be a real absolute http(s) URL if set. */
    @Pattern(regexp = "^$|^https?://.+", message = "irdApiUrl must be a full http(s):// URL, or left blank")
    private String irdApiUrl;

    private String irdApiUsername;

    /** Write-only. Null/omitted means "keep existing password". */
    private String irdApiPassword;

    private boolean enabled;
}
