CREATE TABLE `order_progress_photos` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `status` text DEFAULT '' NOT NULL,
  `file_name` text NOT NULL,
  `file_key` text NOT NULL,
  `file_type` text NOT NULL,
  `caption` text DEFAULT '' NOT NULL,
  `created_by_id` integer NOT NULL,
  `created_by_name` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_order_progress_order_created` ON `order_progress_photos` (`order_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_order_progress_status` ON `order_progress_photos` (`order_id`,`status`);
