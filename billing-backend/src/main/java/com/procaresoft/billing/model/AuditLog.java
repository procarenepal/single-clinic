package com.procaresoft.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Automatic log-archive of every write action performed against the billing
 * database — required by IRD's Electronic Billing Procedure, clause 6(ग):
 * "all operations performed on the database must be automatically recorded
 * in an enabled log archive." Insert-only, immutable, and identifies which
 * user/clinic performed the action and when (see clause 6(घ)).
 */
@Entity
@Table(name = "audit_log")
@Data
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. "Invoice", "ClinicIrdConfig" */
    @Column(name = "entity_name", nullable = false)
    private String entityName;

    /** Primary key of the affected row, as a string (Invoice id, etc.) */
    @Column(name = "entity_id", nullable = false)
    private String entityId;

    /** e.g. "CREATE", "UPDATE" — never "DELETE", nothing in this system deletes. */
    @Column(name = "action", nullable = false)
    private String action;

    /** Firebase uid of the authenticated user who performed the action. */
    @Column(name = "performed_by_uid", nullable = false)
    private String performedByUid;

    @Column(name = "clinic_id", nullable = false)
    private String clinicId;

    @Column(name = "performed_at", nullable = false)
    private LocalDateTime performedAt = LocalDateTime.now();

    /** Short human-readable summary of what changed, e.g. "Invoice INV-2081.082-0007 created". */
    @Column(name = "details", columnDefinition = "LONGTEXT")
    private String details;
}
