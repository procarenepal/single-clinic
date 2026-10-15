-- New IRD rule: every invoice line item must carry an HS (Harmonized
-- System) tax-classification code.
--
-- Nullable: ~160 existing ledger rows were filed before this rule existed
-- and cannot be retroactively assigned a code with any authority. The
-- compulsory requirement is enforced going forward, in the application
-- layer (each billing form refuses to submit a line with no hsCode), not
-- as a DB constraint — a hard NOT NULL here would also reject the
-- unrelated, already-wired-through fields on every historical codepath
-- that still only sends itemName/quantity/rate/totalAmount/isTaxable.

ALTER TABLE invoice_items
    ADD COLUMN hs_code VARCHAR(50) NULL;
