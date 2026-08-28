package com.procaresoft.billing.service;

import com.procaresoft.billing.model.AuditLog;
import com.procaresoft.billing.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Records every write action against billing data — see AuditLog for why
 * (IRD clause 6(ग)/6(घ)). Recording a log entry must never block or fail the
 * business operation it's describing, so failures here are only logged.
 */
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository auditLogRepository;

    public void record(String entityName, Object entityId, String action, String performedByUid, String clinicId, String details) {
        try {
            AuditLog entry = new AuditLog();
            entry.setEntityName(entityName);
            entry.setEntityId(String.valueOf(entityId));
            entry.setAction(action);
            entry.setPerformedByUid(performedByUid);
            entry.setClinicId(clinicId);
            entry.setDetails(details);
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to record audit log entry: entity={} id={} action={}", entityName, entityId, action, e);
        }
    }

    public Page<AuditLog> getForClinic(String clinicId, Pageable pageable) {
        return auditLogRepository.findByClinicIdOrderByPerformedAtDesc(clinicId, pageable);
    }
}
