-- Two gaps against IRD's Electronic Invoice Procedure 2074, found by the
-- clause-by-clause compliance check on 2026-10-07.
--
-- §6(ज): a cancelled invoice must state its reason, and the Schedule 5
-- register must reflect the cancellation. Is_bill_Active already flipped,
-- but the reason lived only in audit_log — an inspector reading the ledger
-- row saw that it was cancelled and nothing about why. Put it on the row.
--
-- Nullable: every live row has no reason, and that is the correct state
-- for a live row. Rows cancelled before this migration keep their reason
-- in audit_log (action = 'CANCEL'); it is not back-filled here because the
-- audit text is free-form and a mechanical extraction could attach the
-- wrong reason to a row. There is exactly one such row today.

ALTER TABLE invoices
    ADD COLUMN cancel_reason    VARCHAR(1000) NULL,
    ADD COLUMN cancelled_at     DATETIME(6)   NULL,
    ADD COLUMN cancelled_by_uid VARCHAR(255)  NULL;

-- §6(घ): every record carries its entry date/time. The invoice row always
-- has; its line items had no timestamp at all. Existing rows take the
-- column default (the migration's own run time) because their true insert
-- time was never recorded — their parent invoice's created_at is the
-- honest answer for those, and this column becomes accurate from the next
-- insert onward.

ALTER TABLE invoice_items
    ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
