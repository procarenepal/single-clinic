package com.procaresoft.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Entity
@Table(name = "invoice_items")
@Data
@NoArgsConstructor
public class InvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Invoice invoice;

    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal rate;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "is_taxable", nullable = false)
    private boolean isTaxable;

    /**
     * IRD's procedure §6(घ) wants every record to carry its entry time. The
     * invoice row has always had one; its line items had nothing — an
     * unattributed row in a tax ledger. Set once on insert and never
     * updated; the invoice's created_by_uid is the actor for its lines.
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.LocalDateTime createdAt;

    @PrePersist
    void stampCreatedAt() {
        if (createdAt == null) createdAt = java.time.LocalDateTime.now();
    }
}
