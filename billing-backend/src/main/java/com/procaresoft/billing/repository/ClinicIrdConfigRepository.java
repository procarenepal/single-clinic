package com.procaresoft.billing.repository;

import com.procaresoft.billing.model.ClinicIrdConfig;
import org.springframework.data.repository.Repository;

import java.util.Optional;

/**
 * Extends the bare Spring Data {@code Repository} marker (not {@code JpaRepository})
 * and declares only save/findByClinicId — deliberately omitting delete. See
 * InvoiceRepository for why: IRD requires billing-related records to never be
 * hard-deleted after entry.
 */
@org.springframework.stereotype.Repository
public interface ClinicIrdConfigRepository extends Repository<ClinicIrdConfig, Long> {
    ClinicIrdConfig save(ClinicIrdConfig config);

    Optional<ClinicIrdConfig> findByClinicId(String clinicId);
}
