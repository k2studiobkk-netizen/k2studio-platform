CREATE TABLE IF NOT EXISTS `order_payment_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`amount` text NOT NULL,
	`file_name` text NOT NULL,
	`file_key` text NOT NULL,
	`file_type` text NOT NULL,
	`created_by_id` integer NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_payment_receipts_order_created` ON `order_payment_receipts` (`order_id`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
