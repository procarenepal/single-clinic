package com.procaresoft.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Atomic per-clinic, per-fiscal-year invoice number counter.
 * Rows are locked with SELECT ... FOR UPDATE (see InvoiceSequenceRepository)
 * inside the same transaction as invoice creation, so numbering stays
 * gapless and monotonic even under concurrent requests / multiple instances.
 */
@Entity
@Table(name = "invoice_sequence", uniqueConstraints = @UniqueConstraint(columnNames = { "clinic_id", "fiscal_year" }))
@Data
@NoArgsConstructor
public class InvoiceSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "clinic_id", nullable = false)
    private String clinicId;

    @Column(name = "fiscal_year", nullable = false)
    private String fiscalYear;

    @Column(name = "last_number", nullable = false)
    private long lastNumber = 0L;
}
