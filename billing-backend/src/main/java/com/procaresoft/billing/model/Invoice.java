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

    /**
     * Credit-note / sales-return fields required by IRD's CBMS
     * /api/billreturn endpoint (ird_api_documentation.pdf) — the original
     * invoice number being reversed, and the mandatory stated reason. Null
     * for a normal (non-return) invoice. credit_note_number/credit_note_date
     * sent to IRD are derived from this row's own invoiceNumber/invoiceDate
     * at sync time, so they don't need separate columns.
     */
    @Column(name = "ref_invoice_number")
    private String refInvoiceNumber;

    @Column(name = "reason_for_return", length = 1000)
    private String reasonForReturn;

    /**
     * Why, when and by whom this row was cancelled. IRD's procedure §6(ज)
     * requires cancellation "stating the reason" and the Schedule 5 register
     * to reflect it. The reason used to live only in the audit log — so an
     * inspector reading the ledger saw Is_bill_Active = 0 and nothing else,
     * and had to cross-reference a separate table to learn why. Null on a
     * live row.
     */
    @Column(name = "cancel_reason", length = 1000)
    private String cancelReason;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancelled_by_uid")
    private String cancelledByUid;

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

    /**
     * Pointer back to the Firestore document this invoice was created from
     * (e.g. "medicinePurchases" / "4Jb6EmIiR4oBV5zFETcF"). Lets the backend
     * mirror IRD sync state onto exactly the right document instead of
     * guessing by invoice number, and gives reconciliation an exact join key
     * rather than relying on each module's differing number field.
     *
     * Null for rows created before this existed, and for the historical rows
     * whose Firestore documents were wiped — those are marked
     * 'legacy_wiped' so they can be explained rather than mistaken for drift.
     */
    @Column(name = "source_collection", length = 64)
    private String sourceCollection;

    @Column(name = "source_doc_id", length = 64)
    private String sourceDocId;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Invoice Items
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InvoiceItem> items = new ArrayList<>();

    public void addItem(InvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }
}
