ALTER TABLE `orders` ADD `payment_slip_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_slip_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_slip_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_confirmed_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_confirmed_by` text DEFAULT '' NOT NULL;
