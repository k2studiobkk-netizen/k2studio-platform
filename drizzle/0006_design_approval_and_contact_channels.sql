ALTER TABLE `orders` ADD `contact_channel` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `social_contact_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `design_versions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `order_id` integer NOT NULL, `version_no` integer NOT NULL,
  `file_name` text NOT NULL, `file_key` text NOT NULL, `file_type` text NOT NULL, `note` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL, `created_by` text DEFAULT '' NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `customer_note` text DEFAULT '' NOT NULL, `responded_by` text DEFAULT '' NOT NULL, `responded_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_design_order_version` ON `design_versions` (`order_id`,`version_no`);
--> statement-breakpoint
CREATE INDEX `idx_design_order_status` ON `design_versions` (`order_id`,`status`);
