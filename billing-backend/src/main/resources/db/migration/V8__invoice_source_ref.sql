-- Pointer from a ledger row back to the Firestore document it came from.
--
-- Two things depend on this:
--   1. Mirroring IRD sync state back onto the right Firestore document.
--      Without an explicit pointer the backend would have to guess the
--      collection from the invoice-number format, which is exactly the kind
--      of heuristic that silently writes to the wrong record.
--   2. Reconciliation: an exact join key, instead of matching on a number
--      field that each module names differently (pharmacy uses purchaseNo).
--
-- Nullable by necessity — every row created before this migration has no
-- pointer, and the rows whose Firestore documents were wiped never will.

ALTER TABLE invoices
    ADD COLUMN source_collection VARCHAR(64) NULL,
    ADD COLUMN source_doc_id     VARCHAR(64) NULL;

CREATE INDEX ix_invoices_source_ref ON invoices (source_collection, source_doc_id);

-- No change-timestamp existed (only created_at), so nothing could drive an
-- incremental reconcile or tell when a row's sync state last moved.
ALTER TABLE invoices
    ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
