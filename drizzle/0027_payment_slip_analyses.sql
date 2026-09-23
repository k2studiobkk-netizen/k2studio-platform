CREATE TABLE IF NOT EXISTS `payment_slip_analyses` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `receipt_id` integer,
  `file_key` text NOT NULL,
  `file_name` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'queued',
  `expected_amount` text NOT NULL DEFAULT '0',
  `detected_amount` text NOT NULL DEFAULT '',
  `transaction_date` text NOT NULL DEFAULT '',
  `transaction_time` text NOT NULL DEFAULT '',
  `reference_no` text NOT NULL DEFAULT '',
  `sender_name` text NOT NULL DEFAULT '',
  `receiver_name` text NOT NULL DEFAULT '',
  `confidence` text NOT NULL DEFAULT '',
  `note` text NOT NULL DEFAULT '',
  `raw_result` text NOT NULL DEFAULT '',
  `error_message` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`receipt_id`) REFERENCES `order_payment_receipts` (`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX IF NOT EXISTS `payment_slip_analyses_file_key_unique` ON `payment_slip_analyses` (`file_key`);
CREATE INDEX IF NOT EXISTS `idx_payment_slip_analyses_order` ON `payment_slip_analyses` (`order_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `idx_payment_slip_analyses_receipt` ON `payment_slip_analyses` (`receipt_id`);
