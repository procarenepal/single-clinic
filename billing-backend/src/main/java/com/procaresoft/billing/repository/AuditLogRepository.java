package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/**
 * Extends the bare Spring Data {@code Repository} marker (not {@code JpaRepository})
 * and exposes only save/find — no delete. The audit log itself must never be
 * alterable or erasable, or it stops being trustworthy as an audit trail.
 */
@org.springframework.stereotype.Repository
public interface AuditLogRepository extends Repository<AuditLog, Long> {
    AuditLog save(AuditLog entry);

    Page<AuditLog> findByClinicIdOrderByPerformedAtDesc(String clinicId, Pageable pageable);
}
