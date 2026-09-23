ALTER TABLE `orders` ADD `estimated_subtotal` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `vat_applied` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `vat_amount` text DEFAULT '0' NOT NULL;