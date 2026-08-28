package com.procaresoft.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Immutable audit trail of every IRD CBMS submission attempt — this is the
 * record that proves what was actually sent to and received from IRD for a
 * given invoice. Rows are never updated or deleted, only inserted.
 */
@Entity
@Table(name = "ird_sync_log")
@Data
@NoArgsConstructor
public class IrdSyncLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_id", nullable = false)
    private Long invoiceId;

    @Column(name = "attempt_at", nullable = false)
    private LocalDateTime attemptAt = LocalDateTime.now();

    /**
     * Outgoing payload with the password redacted — never store credentials in the log.
     * columnDefinition is explicit because @Lob alone maps a MySQL String column to
     * TINYTEXT (255-byte limit) by default, not the LONGTEXT this actually needs —
     * without this, inserting a JSON payload longer than 255 bytes fails silently at
     * flush time, well after the code that built the payload has already returned.
     */
    @Column(name = "request_payload_json", columnDefinition = "LONGTEXT")
    private String requestPayloadJson;

    @Column(name = "response_code")
    private String responseCode;

    @Column(name = "response_body", columnDefinition = "LONGTEXT")
    private String responseBody;

    @Column(name = "success", nullable = false)
    private boolean success;
}
