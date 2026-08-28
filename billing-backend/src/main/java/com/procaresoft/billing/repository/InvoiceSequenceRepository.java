package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.InvoiceSequence;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Extends the bare Spring Data {@code Repository} marker (not {@code JpaRepository})
 * and exposes only the two custom queries actually used — no save/find/delete at
 * all, since every access to this counter table goes through upsertIncrement/
 * findLastNumber. See InvoiceRepository for why delete is never offered.
 */
@org.springframework.stereotype.Repository
public interface InvoiceSequenceRepository extends Repository<InvoiceSequence, Long> {

    /**
     * Atomically creates the counter row at 1 (first invoice) or increments an
     * existing one — a single INSERT ... ON DUPLICATE KEY UPDATE, relying on
     * the unique index on (clinic_id, fiscal_year) for atomicity.
     *
     * Deliberately NOT implemented as "SELECT ... FOR UPDATE, then insert if
     * missing": a locking SELECT that matches zero rows still takes an InnoDB
     * gap lock under REPEATABLE READ, and a subsequent INSERT into that gap
     * (even from a separate REQUIRES_NEW transaction) then blocks on the
     * outer transaction's own gap lock — a self-deadlock that only manifests
     * against real MySQL (not H2), surfacing as "Lock wait timeout exceeded"
     * rather than a detectable deadlock, since MySQL's deadlock detector
     * can't see that the outer transaction's owning thread is blocked waiting
     * on the inner one. This upsert avoids the pattern entirely.
     */
    @Modifying
    @Query(value = "insert into invoice_sequence (clinic_id, fiscal_year, last_number) values (:clinicId, :fiscalYear, 1) "
            + "on duplicate key update last_number = last_number + 1", nativeQuery = true)
    void upsertIncrement(@Param("clinicId") String clinicId, @Param("fiscalYear") String fiscalYear);

    @Query("select s.lastNumber from InvoiceSequence s where s.clinicId = :clinicId and s.fiscalYear = :fiscalYear")
    Long findLastNumber(@Param("clinicId") String clinicId, @Param("fiscalYear") String fiscalYear);
}
