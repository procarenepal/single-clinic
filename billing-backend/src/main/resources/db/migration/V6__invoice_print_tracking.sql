-- Reprint tracking for the Schedule 5 (अनुसूची ५) report — IRD's Electronic
-- Billing Procedure requires Is_Bill_Printed/Printed_Time/Printed_By to be
-- part of that table. Previously these were only tracked in Firestore
-- (printCount on the AppointmentBilling/PathologyBilling/MedicinePurchase
-- docs) and never synced back to this authoritative ledger, so the Java-side
-- Schedule 5 report always showed them as null. The frontend now calls
-- POST /{id}/record-print alongside its existing Firestore printCount write.

ALTER TABLE invoices
    ADD COLUMN print_count INT NOT NULL DEFAULT 0,
    ADD COLUMN last_printed_at DATETIME NULL,
    ADD COLUMN last_printed_by VARCHAR(255) NULL;
