ALTER TABLE `order_items` ADD `product_type` text DEFAULT 'acrylic_keychain' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `item_description` text DEFAULT '' NOT NULL;
