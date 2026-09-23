-- Collection and document preference are separate from accounting's VAT liability.
-- Legacy monetary values are deliberately untouched.
ALTER TABLE `orders` ADD COLUMN `tax_invoice_requested` integer;
ALTER TABLE `orders` ADD COLUMN `vat_policy_mode` text NOT NULL DEFAULT '';
ALTER TABLE `orders` ADD COLUMN `vat_policy_revision` integer;
CREATE TABLE vat_collection_settings (
  id integer PRIMARY KEY CHECK (id=1),
  mode text NOT NULL CHECK (mode IN ('manual_accounting_transition','all_orders')),
  revision integer NOT NULL DEFAULT 1,
  updated_by integer,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_id text NOT NULL DEFAULT ''
);
INSERT INTO vat_collection_settings (id,mode) VALUES (1,'manual_accounting_transition');
