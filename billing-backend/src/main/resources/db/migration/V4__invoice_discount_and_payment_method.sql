-- Schedule 5 fields (IRD Electronic Billing Procedure clause 6(ङ)) not
-- otherwise captured on invoices: Discount and Payment_Method. Both nullable
-- — not always known at invoice-creation time.

ALTER TABLE invoices
    ADD COLUMN discount_amount DECIMAL(10,2) NULL,
    ADD COLUMN payment_method VARCHAR(255) NULL;
