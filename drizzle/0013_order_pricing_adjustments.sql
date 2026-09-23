ALTER TABLE `orders` ADD `discount_amount` text DEFAULT '0' NOT NULL;
CREATE TABLE `order_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_order_adjustments_order` ON `order_adjustments` (`order_id`);
