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

    Optional<Invoice> findByClinicIdAndIdempotencyKey(String clinicId, String idempotencyKey);

    List<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId);

    Page<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId, Pageable pageable);

    List<Invoice> findByIrdSyncedFalse();

    Page<Invoice> findByClinicIdAndFiscalYearOrderByInvoiceDateDesc(String clinicId, String fiscalYear, Pageable pageable);

    Page<Invoice> findByClinicIdOrderByInvoiceDateDesc(String clinicId, Pageable pageable);
}
