ALTER TABLE `orders` ADD `file_delivery_method` text DEFAULT 'upload' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `external_file_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `file_delivery_note` text DEFAULT '' NOT NULL;
