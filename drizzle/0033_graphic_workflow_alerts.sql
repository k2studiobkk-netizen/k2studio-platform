ALTER TABLE `orders` ADD `graphic_claimed_by_id` integer;
ALTER TABLE `orders` ADD `graphic_claimed_by_name` text NOT NULL DEFAULT '';
ALTER TABLE `orders` ADD `graphic_claimed_at` text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS `idx_orders_graphic_claim` ON `orders` (`order_status`,`graphic_claimed_at`,`created_at`);

CREATE TABLE IF NOT EXISTS `graphic_alert_deliveries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `alert_type` text NOT NULL,
  `stage_key` text NOT NULL,
  `first_sent_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` text NOT NULL DEFAULT '',
  `resolved_notified_at` text NOT NULL DEFAULT '',
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_graphic_alert_order_type` ON `graphic_alert_deliveries` (`order_id`,`alert_type`,`stage_key`);
CREATE INDEX IF NOT EXISTS `idx_graphic_alert_unresolved` ON `graphic_alert_deliveries` (`resolved_at`,`first_sent_at`);
