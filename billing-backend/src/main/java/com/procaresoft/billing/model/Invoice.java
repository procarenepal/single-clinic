package com.procaresoft.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoices")
@Data
@NoArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Link back to Firebase
    @Column(name = "firebase_patient_id")
    private String firebasePatientId;

    // Owning clinic, resolved server-side from the authenticated user (never client-supplied)
    @Column(name = "clinic_id", nullable = false)
    private String clinicId;

    @Column(name = "invoice_number", unique = true, nullable = false)
    private String invoiceNumber;

    /**
     * Client-generated key for this specific create-invoice attempt (unique
     * per clinic). Lets /api/billing/create be safely retried after a
     * network drop: if a browser retry arrives with the same key, the
     * already-created invoice is returned instead of a duplicate being
     * minted. Nullable only because rows created before this field existed
     * have none.
     */
    @Column(name = "idempotency_key")
    private String idempotencyKey;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    // Entry date/time, creating user, and record effectiveness — required per
    // IRD's Electronic Billing Procedure clause 6(घ). createdByUid is resolved
    // server-side from the authenticated user, never client-supplied.
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by_uid", nullable = false)
    private String createdByUid;

    /**
     * Record effectiveness flag (clause 6(घ)/6(ठ)): true while this invoice is
     * the live record. A future correction flow would set this false on the
     * superseded record rather than editing its financial fields in place —
     * matching "no update, only supersede with a new record."
     */
    @Column(name = "active", nullable = false)
    private boolean active = true;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // Buyer Info (from Firebase snapshot)
    @Column(name = "buyer_name", nullable = false)
    private String buyerName;

    @Column(name = "buyer_pan")
    private String buyerPan;

    // Financials
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "taxable_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal taxableAmount;

    @Column(name = "tax_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "exempt_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal exemptAmount;

    // Schedule 5 fields (IRD Electronic Billing Procedure clause 6(ङ)) not
    // otherwise captured above. Nullable: not always known at invoice-creation
    // time (e.g. an appointment invoice created before payment is recorded).
    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "payment_method")
    private String paymentMethod;

    // IRD Sync Tracking
    @Column(name = "ird_synced", nullable = false)
    private boolean irdSynced = false;

    @Column(name = "ird_sync_date")
    private LocalDateTime irdSyncDate;

    @Column(name = "cbms_response_code")
    private String cbmsResponseCode;

    @Column(name = "fiscal_year")
    private String fiscalYear;

    @Column(name = "ird_sync_attempts", nullable = false)
    private int irdSyncAttempts = 0;

    @Column(name = "ird_last_attempt_at")
    private LocalDateTime irdLastAttemptAt;

    @Column(name = "ird_needs_manual_review", nullable = false)
    private boolean irdNeedsManualReview = false;

    // Reprint tracking (Schedule 5 clause 6(ङ) / clause 6(च)'s "Copy of
    // Original" numbering) — the frontend increments this via /record-print
    // alongside its own Firestore printCount write, so both sides agree.
    @Column(name = "print_count", nullable = false)
    private int printCount = 0;

    @Column(name = "last_printed_at")
    private LocalDateTime lastPrintedAt;

    @Column(name = "last_printed_by")
    private String lastPrintedBy;

    // Invoice Items
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InvoiceItem> items = new ArrayList<>();

    public void addItem(InvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }
}
