CREATE TABLE IF NOT EXISTS `roles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_roles_code` ON `roles` (`code`);

CREATE TABLE IF NOT EXISTS `customers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `customer_number` text NOT NULL,
  `name` text NOT NULL,
  `phone` text NOT NULL DEFAULT '',
  `email` text NOT NULL DEFAULT '',
  `line_id` text NOT NULL DEFAULT '',
  `contact_channel` text NOT NULL DEFAULT '',
  `social_contact_name` text NOT NULL DEFAULT '',
  `address` text NOT NULL DEFAULT '',
  `province` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_customers_number` ON `customers` (`customer_number`);
CREATE INDEX IF NOT EXISTS `idx_customers_phone` ON `customers` (`phone`);
CREATE INDEX IF NOT EXISTS `idx_customers_email` ON `customers` (`email`);

CREATE TABLE IF NOT EXISTS `products` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_products_code` ON `products` (`code`);
CREATE INDEX IF NOT EXISTS `idx_products_category` ON `products` (`category`, `active`);

CREATE TABLE IF NOT EXISTS `machines` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `department` text NOT NULL DEFAULT '',
  `daily_capacity_minutes` integer NOT NULL DEFAULT 480,
  `busy_threshold` integer NOT NULL DEFAULT 70,
  `nearly_full_threshold` integer NOT NULL DEFAULT 90,
  `full_threshold` integer NOT NULL DEFAULT 100,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_machines_code` ON `machines` (`code`);
CREATE INDEX IF NOT EXISTS `idx_machines_active` ON `machines` (`active`, `name`);

CREATE TABLE IF NOT EXISTS `production_processes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `sequence_no` integer NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_production_processes_code` ON `production_processes` (`code`);

CREATE TABLE IF NOT EXISTS `production_capacity` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `product_id` integer,
  `machine_id` integer NOT NULL,
  `process_id` integer,
  `units_per_hour` real NOT NULL DEFAULT 0,
  `setup_minutes` integer NOT NULL DEFAULT 0,
  `capacity_unit` text NOT NULL DEFAULT 'items',
  `notes` text NOT NULL DEFAULT '',
  `active` integer NOT NULL DEFAULT 1,
  `created_by` integer,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`),
  FOREIGN KEY (`process_id`) REFERENCES `production_processes` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_capacity_machine_product_process` ON `production_capacity` (`machine_id`, `product_id`, `process_id`, `active`);

CREATE TABLE IF NOT EXISTS `work_orders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_number` text NOT NULL,
  `order_id` integer NOT NULL,
  `customer_id` integer,
  `sales_owner_id` integer,
  `graphic_owner_id` integer,
  `product_id` integer,
  `product_name` text NOT NULL DEFAULT '',
  `product_category` text NOT NULL DEFAULT '',
  `quantity` integer NOT NULL DEFAULT 0,
  `size` text NOT NULL DEFAULT '',
  `material` text NOT NULL DEFAULT '',
  `thickness` text NOT NULL DEFAULT '',
  `print_specification` text NOT NULL DEFAULT '',
  `customer_requested_date` text NOT NULL DEFAULT '',
  `planned_production_date` text NOT NULL DEFAULT '',
  `confirmed_delivery_date` text NOT NULL DEFAULT '',
  `priority` text NOT NULL DEFAULT 'normal',
  `rush_status` text NOT NULL DEFAULT 'none',
  `delivery_method` text NOT NULL DEFAULT '',
  `notes` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'waiting_for_production',
  `created_by` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  FOREIGN KEY (`sales_owner_id`) REFERENCES `staff_users` (`id`),
  FOREIGN KEY (`graphic_owner_id`) REFERENCES `staff_users` (`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_work_orders_number` ON `work_orders` (`work_order_number`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_work_orders_order` ON `work_orders` (`order_id`);
CREATE INDEX IF NOT EXISTS `idx_work_orders_status_delivery` ON `work_orders` (`status`, `confirmed_delivery_date`);
CREATE INDEX IF NOT EXISTS `idx_work_orders_planned_date` ON `work_orders` (`planned_production_date`);

CREATE TABLE IF NOT EXISTS `production_schedule` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_id` integer NOT NULL,
  `machine_id` integer NOT NULL,
  `process_id` integer,
  `production_date` text NOT NULL,
  `quantity` integer NOT NULL DEFAULT 0,
  `estimated_minutes` integer NOT NULL DEFAULT 0,
  `sequence_no` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'scheduled',
  `override_reason` text NOT NULL DEFAULT '',
  `created_by` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`),
  FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`),
  FOREIGN KEY (`process_id`) REFERENCES `production_processes` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_schedule_date_machine` ON `production_schedule` (`production_date`, `machine_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_schedule_work_order` ON `production_schedule` (`work_order_id`, `production_date`);

CREATE TABLE IF NOT EXISTS `rush_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_id` integer NOT NULL,
  `requested_date` text NOT NULL,
  `reason` text NOT NULL,
  `importance` text NOT NULL DEFAULT 'normal',
  `notes` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'pending',
  `approved_date` text NOT NULL DEFAULT '',
  `requested_by` integer NOT NULL,
  `decided_by` integer,
  `decision_note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_at` text NOT NULL DEFAULT '',
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_rush_status_created` ON `rush_requests` (`status`, `created_at`);

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer,
  `work_order_id` integer,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `read_at` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `staff_users` (`id`),
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_notifications_user_unread` ON `notifications` (`user_id`, `read_at`, `created_at`);

CREATE TABLE IF NOT EXISTS `work_order_status_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_id` integer NOT NULL,
  `status` text NOT NULL,
  `note` text NOT NULL DEFAULT '',
  `changed_by` integer,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`),
  FOREIGN KEY (`changed_by`) REFERENCES `staff_users` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_work_order_history` ON `work_order_status_history` (`work_order_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `attachments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `work_order_id` integer NOT NULL,
  `attachment_type` text NOT NULL,
  `file_name` text NOT NULL,
  `file_key` text NOT NULL,
  `file_type` text NOT NULL DEFAULT '',
  `caption` text NOT NULL DEFAULT '',
  `created_by` integer,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`)
);
CREATE INDEX IF NOT EXISTS `idx_attachments_work_order_type` ON `attachments` (`work_order_id`, `attachment_type`, `created_at`);

ALTER TABLE `audit_logs` ADD `entity_type` text NOT NULL DEFAULT 'order';
ALTER TABLE `audit_logs` ADD `entity_id` integer;
ALTER TABLE `audit_logs` ADD `field_name` text NOT NULL DEFAULT '';
ALTER TABLE `audit_logs` ADD `old_value` text NOT NULL DEFAULT '';
ALTER TABLE `audit_logs` ADD `new_value` text NOT NULL DEFAULT '';

INSERT OR IGNORE INTO `roles` (`code`,`name`,`description`) VALUES
  ('sales','ฝ่ายขาย','สร้าง Draft Order และดูคิวผลิต'),
  ('graphic','กราฟิก','เตรียม Artwork และออก Work Order'),
  ('production','ฝ่ายผลิต','จัดคิวและอัปเดตการผลิต'),
  ('production_manager','ผู้จัดการฝ่ายผลิต','อนุมัติงานด่วนและ Override Capacity'),
  ('admin','ผู้ดูแลระบบ','จัดการระบบและผู้ใช้งานทั้งหมด');

INSERT OR IGNORE INTO `products` (`code`,`name`,`category`) VALUES
  ('ACRYLIC-KEYCHAIN','พวงกุญแจอะคริลิก','acrylic_keychain'),
  ('CUSTOM','งานสั่งทำอื่น ๆ','custom');

INSERT OR IGNORE INTO `machines` (`code`,`name`,`department`,`daily_capacity_minutes`) VALUES
  ('UV-PRINTER-A','UV Printer A','Printing',480),
  ('LASER-A','Laser Machine A','Cutting',480),
  ('PACKING','Packing','Packing',480),
  ('DTG','DTG','Garment Printing',480);

INSERT OR IGNORE INTO `production_processes` (`code`,`name`,`sequence_no`) VALUES
  ('ARTWORK','เตรียมไฟล์ผลิต',10),
  ('PRINT','พิมพ์',20),
  ('CUT','ตัด',30),
  ('ASSEMBLY','ประกอบ',40),
  ('QC','ตรวจคุณภาพ',50),
  ('PACK','แพ็ก',60);

PRAGMA optimize;
