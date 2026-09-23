CREATE TABLE IF NOT EXISTS `broadcast_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `priority` text NOT NULL DEFAULT 'normal',
  `sender_id` integer NOT NULL,
  `sender_name` text NOT NULL,
  `display_mode` text NOT NULL DEFAULT 'top_banner',
  `target_scope` text NOT NULL DEFAULT 'all',
  `target_department` text NOT NULL DEFAULT '',
  `target_screen` text NOT NULL DEFAULT '',
  `duration_minutes` integer NOT NULL DEFAULT 5,
  `expire_at` text NOT NULL DEFAULT '',
  `dismissible` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` text NOT NULL DEFAULT '',
  `closed_by` integer,
  FOREIGN KEY (`sender_id`) REFERENCES `staff_users` (`id`),
  FOREIGN KEY (`closed_by`) REFERENCES `staff_users` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_broadcast_active_expire` ON `broadcast_messages` (`status`,`expire_at`,`created_at`);
CREATE INDEX IF NOT EXISTS `idx_broadcast_target` ON `broadcast_messages` (`target_scope`,`target_department`,`target_screen`);

CREATE TABLE IF NOT EXISTS `broadcast_acknowledgements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `message_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `display_name` text NOT NULL,
  `screen_id` text NOT NULL DEFAULT '',
  `acknowledged_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`message_id`) REFERENCES `broadcast_messages` (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `staff_users` (`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_broadcast_ack_unique` ON `broadcast_acknowledgements` (`message_id`,`user_id`,`screen_id`);

CREATE TABLE IF NOT EXISTS `broadcast_screens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `screen_key` text NOT NULL,
  `name` text NOT NULL,
  `department` text NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `last_seen_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_broadcast_screens_key` ON `broadcast_screens` (`screen_key`);
CREATE INDEX IF NOT EXISTS `idx_broadcast_screens_department` ON `broadcast_screens` (`department`,`active`);

INSERT OR IGNORE INTO `broadcast_screens` (`screen_key`,`name`,`department`) VALUES
  ('production-main','จอฝ่ายผลิตหลัก','production'),
  ('packing-main','จอฝ่ายแพ็ก','packing'),
  ('graphic-main','จอฝ่ายกราฟิก','graphic');

PRAGMA optimize;
