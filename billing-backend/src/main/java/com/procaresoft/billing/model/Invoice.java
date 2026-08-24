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

    @Column(name = "invoice_number", unique = true, nullable = false)
    private String invoiceNumber;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

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

    // IRD Sync Tracking
    @Column(name = "ird_synced", nullable = false)
    private boolean irdSynced = false;

    @Column(name = "ird_sync_date")
    private LocalDateTime irdSyncDate;

    @Column(name = "cbms_response_code")
    private String cbmsResponseCode;

    // Invoice Items
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InvoiceItem> items = new ArrayList<>();

    public void addItem(InvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }
}
