package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    List<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId);

    Page<Invoice> findByFirebasePatientIdOrderByInvoiceDateDesc(String firebasePatientId, Pageable pageable);

    List<Invoice> findByIrdSyncedFalse();

    Optional<Invoice> findFirstByOrderByIdDesc();
}
