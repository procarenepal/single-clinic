-- Lets a create-invoice HTTP request be retried safely after a dropped
-- connection: a retry carrying the same client-generated key returns the
-- already-created invoice instead of minting a duplicate. Unique per clinic
-- (not globally) since keys are client-generated UUIDs, but scoping to
-- clinic keeps the lookup index small and matches how every other query is
-- already clinic-scoped.

ALTER TABLE invoices
    ADD COLUMN idempotency_key VARCHAR(255) NULL;

CREATE UNIQUE INDEX ux_invoices_clinic_idempotency_key
    ON invoices (clinic_id, idempotency_key);
