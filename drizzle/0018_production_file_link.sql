ALTER TABLE `orders` ADD `production_file_url` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `production_file_note` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `production_file_updated_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `production_file_updated_by` text NOT NULL DEFAULT '';
