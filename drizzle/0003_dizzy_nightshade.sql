CREATE TABLE `order_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_order_history_order_created` ON `order_status_history` (`order_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `public_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `orders` SET `public_token` = lower(hex(randomblob(16))) WHERE `public_token` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `orders_public_token_unique` ON `orders` (`public_token`);
