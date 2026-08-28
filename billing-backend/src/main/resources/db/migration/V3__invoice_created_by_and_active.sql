-- Per-record entry timestamp, creating user, and effectiveness flag, required
-- by IRD's Electronic Billing Procedure clause 6(घ). Existing rows (from
-- before this column existed) are backfilled with best-effort values so the
-- NOT NULL constraints can be applied.

ALTER TABLE invoices
    ADD COLUMN created_at DATETIME(6) NULL,
    ADD COLUMN created_by_uid VARCHAR(255) NULL,
    ADD COLUMN active BIT(1) NOT NULL DEFAULT 1;

UPDATE invoices
SET created_at = CAST(invoice_date AS DATETIME)
WHERE created_at IS NULL;

UPDATE invoices
SET created_by_uid = 'unknown-pre-migration'
WHERE created_by_uid IS NULL;

ALTER TABLE invoices
    MODIFY COLUMN created_at DATETIME(6) NOT NULL,
    MODIFY COLUMN created_by_uid VARCHAR(255) NOT NULL;
