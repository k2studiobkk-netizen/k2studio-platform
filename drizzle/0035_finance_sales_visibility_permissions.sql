CREATE TABLE `staff_user_permissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `permission_code` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_staff_user_permissions_user_code` ON `staff_user_permissions` (`user_id`,`permission_code`);
CREATE INDEX `idx_staff_user_permissions_code_user` ON `staff_user_permissions` (`permission_code`,`user_id`);
