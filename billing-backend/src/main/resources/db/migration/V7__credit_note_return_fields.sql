-- IRD's real CBMS API (ird_api_documentation.pdf, "2. API to post credit note
-- (sales return) to CBMS") requires 4 fields on POST /api/billreturn beyond
-- what a normal /api/bill submission carries: ref_invoice_number,
-- credit_note_number, credit_note_date, reason_for_return. Previously
-- IrdCbmsService.buildPayload() sent the exact same payload to both
-- endpoints, so every credit note ever submitted went out with none of
-- these fields — no linkage to the original invoice IRD has on file, and no
-- stated reason. credit_note_number/credit_note_date are derivable from the
-- credit note's own invoice_number/invoice_date at send time, so only the
-- two fields that reference the ORIGINAL invoice need to be persisted here.
ALTER TABLE invoices
    ADD COLUMN ref_invoice_number VARCHAR(255) NULL,
    ADD COLUMN reason_for_return VARCHAR(1000) NULL;
