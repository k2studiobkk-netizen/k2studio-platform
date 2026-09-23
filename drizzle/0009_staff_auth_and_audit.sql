CREATE TABLE `staff_users` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`username` text NOT NULL,`display_name` text NOT NULL,`role` text DEFAULT 'staff' NOT NULL,`password_hash` text NOT NULL,`password_salt` text NOT NULL,`must_change_password` integer DEFAULT 1 NOT NULL,`active` integer DEFAULT 1 NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`last_login_at` text DEFAULT '' NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_username_unique` ON `staff_users` (`username`);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`user_id` integer NOT NULL,`token_hash` text NOT NULL,`expires_at` text NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_sessions_token_hash_unique` ON `staff_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_staff_sessions_user` ON `staff_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_staff_sessions_expiry` ON `staff_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `audit_logs` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`order_id` integer,`user_id` integer NOT NULL,`username` text NOT NULL,`display_name` text NOT NULL,`action` text NOT NULL,`details` text DEFAULT '' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_audit_order_created` ON `audit_logs` (`order_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_user_created` ON `audit_logs` (`user_id`,`created_at`);
--> statement-breakpoint
-- Staff accounts must be provisioned securely; no default credentials are distributed.
--> statement-breakpoint
-- Staff accounts must be provisioned securely; no default credentials are distributed.
