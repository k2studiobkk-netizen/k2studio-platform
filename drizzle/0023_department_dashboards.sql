ALTER TABLE `work_orders` ADD `dashboard_note` text NOT NULL DEFAULT '';
ALTER TABLE `work_orders` ADD `queue_rank` integer NOT NULL DEFAULT 0;
ALTER TABLE `work_orders` ADD `queue_removed` integer NOT NULL DEFAULT 0;
ALTER TABLE `work_orders` ADD `queue_updated_at` text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS `idx_work_orders_queue` ON `work_orders` (`status`,`queue_removed`,`queue_rank`,`confirmed_delivery_date`);

CREATE TABLE IF NOT EXISTS `production_queue_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_id` integer NOT NULL,
  `department` text NOT NULL,
  `action` text NOT NULL,
  `note` text NOT NULL DEFAULT '',
  `from_status` text NOT NULL DEFAULT '',
  `to_status` text NOT NULL DEFAULT '',
  `from_rank` integer NOT NULL DEFAULT 0,
  `to_rank` integer NOT NULL DEFAULT 0,
  `changed_by` integer NOT NULL,
  `changed_by_name` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`),
  FOREIGN KEY (`changed_by`) REFERENCES `staff_users` (`id`)
);

CREATE INDEX IF NOT EXISTS `idx_queue_events_work_order` ON `production_queue_events` (`work_order_id`,`created_at`);
CREATE INDEX IF NOT EXISTS `idx_queue_events_department` ON `production_queue_events` (`department`,`created_at`);

INSERT OR IGNORE INTO `broadcast_screens` (`screen_key`,`name`,`department`) VALUES
  ('print-cut-main','จอห้อง Print & Cut','print_cut'),
  ('pack-main','จอห้อง Pack','pack'),
  ('sale-main','จอฝ่ายขาย','sale');

PRAGMA optimize;
