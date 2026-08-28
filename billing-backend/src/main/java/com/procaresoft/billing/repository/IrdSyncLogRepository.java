package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.IrdSyncLog;
import org.springframework.data.repository.Repository;

/**
 * Extends the bare Spring Data {@code Repository} marker (not {@code JpaRepository})
 * and exposes only save — no update, find, or delete. IrdSyncLog is an immutable
 * insert-only audit trail (see the entity's own Javadoc); this makes "never
 * updated or deleted" structurally true, not just a documented convention.
 */
@org.springframework.stereotype.Repository
public interface IrdSyncLogRepository extends Repository<IrdSyncLog, Long> {
    IrdSyncLog save(IrdSyncLog entry);
}
