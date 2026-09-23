ALTER TABLE `orders` ADD `shipping_fee` text DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `deposit_amount` text DEFAULT '0' NOT NULL;
