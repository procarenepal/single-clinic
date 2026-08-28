-- Automatic log-archive of every write action against billing data, per
-- IRD's Electronic Billing Procedure clause 6(ग). Insert-only — see
-- AuditLogRepository, which deliberately never exposes a delete method.

CREATE TABLE audit_log (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_name       VARCHAR(255)  NOT NULL,
    entity_id         VARCHAR(255)  NOT NULL,
    action            VARCHAR(255)  NOT NULL,
    performed_by_uid  VARCHAR(255)  NOT NULL,
    clinic_id         VARCHAR(255)  NOT NULL,
    performed_at      DATETIME(6)   NOT NULL,
    details           LONGTEXT
);

CREATE INDEX idx_audit_log_clinic_id ON audit_log (clinic_id);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_name, entity_id);
