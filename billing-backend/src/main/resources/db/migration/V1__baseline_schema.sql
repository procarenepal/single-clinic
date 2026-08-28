-- Baseline schema, generated to match the JPA entities as they stood when
-- Hibernate ddl-auto=update was retired in favor of Flyway-managed migrations.
-- Applied via `baseline-on-migrate` so existing dev/prod databases (already
-- created by `update`) are marked as already being at this version rather
-- than re-run. New/empty databases get this DDL applied directly.

CREATE TABLE invoices (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    firebase_patient_id      VARCHAR(255),
    clinic_id                VARCHAR(255)   NOT NULL,
    invoice_number           VARCHAR(255)   NOT NULL,
    invoice_date             DATE           NOT NULL,
    buyer_name               VARCHAR(255)   NOT NULL,
    buyer_pan                VARCHAR(255),
    total_amount             DECIMAL(10,2)  NOT NULL,
    taxable_amount           DECIMAL(10,2)  NOT NULL,
    tax_amount               DECIMAL(10,2)  NOT NULL,
    exempt_amount            DECIMAL(10,2)  NOT NULL,
    ird_synced               BIT(1)         NOT NULL DEFAULT 0,
    ird_sync_date            DATETIME(6),
    cbms_response_code       VARCHAR(255),
    fiscal_year              VARCHAR(255),
    ird_sync_attempts        INT            NOT NULL DEFAULT 0,
    ird_last_attempt_at      DATETIME(6),
    ird_needs_manual_review  BIT(1)         NOT NULL DEFAULT 0,
    CONSTRAINT uk_invoices_invoice_number UNIQUE (invoice_number)
);

CREATE INDEX idx_invoices_clinic_id ON invoices (clinic_id);
CREATE INDEX idx_invoices_firebase_patient_id ON invoices (firebase_patient_id);

CREATE TABLE invoice_items (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id    BIGINT         NOT NULL,
    item_name     VARCHAR(255)   NOT NULL,
    quantity      INT            NOT NULL,
    rate          DECIMAL(10,2)  NOT NULL,
    total_amount  DECIMAL(10,2)  NOT NULL,
    is_taxable    BIT(1)         NOT NULL,
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items (invoice_id);

CREATE TABLE invoice_sequence (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    clinic_id    VARCHAR(255)  NOT NULL,
    fiscal_year  VARCHAR(255)  NOT NULL,
    last_number  BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_invoice_sequence_clinic_fiscal_year UNIQUE (clinic_id, fiscal_year)
);

CREATE TABLE ird_sync_log (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id             BIGINT       NOT NULL,
    attempt_at             DATETIME(6)  NOT NULL,
    request_payload_json   LONGTEXT,
    response_code          VARCHAR(255),
    response_body          LONGTEXT,
    success                BIT(1)       NOT NULL
);

CREATE INDEX idx_ird_sync_log_invoice_id ON ird_sync_log (invoice_id);

CREATE TABLE clinic_ird_config (
    id                           BIGINT AUTO_INCREMENT PRIMARY KEY,
    clinic_id                    VARCHAR(255)  NOT NULL,
    seller_pan                   VARCHAR(255),
    ird_environment               VARCHAR(255)  NOT NULL DEFAULT 'mock',
    ird_api_url                  VARCHAR(255),
    ird_api_username             VARCHAR(255),
    ird_api_password_encrypted   VARCHAR(255),
    enabled                      BIT(1)        NOT NULL DEFAULT 0,
    updated_at                   DATETIME(6),
    CONSTRAINT uk_clinic_ird_config_clinic_id UNIQUE (clinic_id)
);
