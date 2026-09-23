ALTER TABLE `orders` ADD `sales_owner_id` integer;
ALTER TABLE `orders` ADD `sales_owner_name` text DEFAULT '' NOT NULL;

UPDATE `orders` SET `sales_owner_id` = COALESCE(
  (SELECT `sales_owner_id` FROM `work_orders` WHERE `work_orders`.`order_id`=`orders`.`id` LIMIT 1),
  (SELECT `user_id` FROM `audit_logs` WHERE `audit_logs`.`order_id`=`orders`.`id` AND `action`='สร้างใบงาน' ORDER BY `id` LIMIT 1)
);
UPDATE `orders` SET `sales_owner_name` = COALESCE(
  (SELECT `display_name` FROM `staff_users` WHERE `staff_users`.`id`=`orders`.`sales_owner_id` LIMIT 1), ''
);

CREATE INDEX `idx_orders_sales_owner_created` ON `orders` (`sales_owner_id`,`created_at`);
CREATE INDEX `idx_orders_channel_created` ON `orders` (`contact_channel`,`created_at`);

CREATE TABLE `order_sales_assignment_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `old_sales_owner_id` integer,
  `old_sales_owner_name` text DEFAULT '' NOT NULL,
  `new_sales_owner_id` integer,
  `new_sales_owner_name` text DEFAULT '' NOT NULL,
  `changed_by_id` integer NOT NULL,
  `changed_by_name` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_sales_assignment_order_created` ON `order_sales_assignment_history` (`order_id`,`created_at`);
