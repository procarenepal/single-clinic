package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.Invoice;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Extends the bare Spring Data {@code Repository} marker (not {@code JpaRepository})
 * and declares only the methods actually used — deliberately omitting delete/deleteAll/
 * deleteById. IRD requires billing records to never be hard-deleted after entry; this
 * makes that structurally true rather than just a convention nobody happens to violate.
 */
@org.springframework.stereotype.Repository
public interface InvoiceRepository extends Repository<Invoice, Long> {

    Invoice save(Invoice invoice);

    Optional<Invoice> findById(Long id);

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    /**
     * Clinic-scoped lookup backing /invoice-by-number. invoice_number is
     * globally unique at the DB level, so the clinic predicate can't change
     * which row matches — it exists so one clinic can never read another's
     * invoice by guessing its number.
     */
    Optional<Invoice> findByClinicIdAndInvoiceNumber(String clinicId, String invoiceNumber);

    Optional<Invoice> findByClinicIdAndIdempotencyKey(String clinicId, String idempotencyKey);

    List<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId);

    Page<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId, Pageable pageable);

    /**
     * Retry candidates for IrdSyncScheduler. Bounded and filtered at the
     * query rather than in the loop: an unbounded findByIrdSyncedFalse()
     * loaded every unsynced invoice of every clinic — including cancelled
     * ones and ones already parked for manual review — into memory each
     * minute.
     */
    Page<Invoice> findByIrdSyncedFalseAndActiveTrueAndIrdNeedsManualReviewFalse(Pageable pageable);

    Page<Invoice> findByClinicIdAndFiscalYearOrderByInvoiceDateDesc(String clinicId, String fiscalYear, Pageable pageable);

    Page<Invoice> findByClinicIdOrderByInvoiceDateDesc(String clinicId, Pageable pageable);

    // Reconciliation listings — ordered by invoice number, not date: paging
    // over a date-ordered set is unstable when many invoices share a date,
    // which silently corrupts a paged cross-store join.
    Page<Invoice> findByClinicIdOrderByInvoiceNumberAsc(String clinicId, Pageable pageable);

    Page<Invoice> findByClinicIdAndFiscalYearOrderByInvoiceNumberAsc(String clinicId, String fiscalYear, Pageable pageable);

    Page<Invoice> findByClinicIdAndIrdSyncedFalseOrderByInvoiceNumberAsc(String clinicId, Pageable pageable);

    Page<Invoice> findByClinicIdAndIrdNeedsManualReviewTrueOrderByInvoiceNumberAsc(String clinicId, Pageable pageable);
}
