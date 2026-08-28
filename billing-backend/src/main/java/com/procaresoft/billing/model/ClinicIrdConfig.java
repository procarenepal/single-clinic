package com.procaresoft.billing.model;

import com.procaresoft.billing.crypto.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Per-clinic IRD CBMS credentials, resolved server-side only.
 * Never exposed to the frontend — the client only ever sends an "enabled" intent.
 */
@Entity
@Table(name = "clinic_ird_config")
@Data
@NoArgsConstructor
public class ClinicIrdConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "clinic_id", unique = true, nullable = false)
    private String clinicId;

    @Column(name = "seller_pan")
    private String sellerPan;

    @Column(name = "ird_environment", nullable = false)
    private String irdEnvironment = "mock";

    @Column(name = "ird_api_url")
    private String irdApiUrl;

    @Column(name = "ird_api_username")
    private String irdApiUsername;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "ird_api_password_encrypted")
    private String irdApiPassword;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }
}
