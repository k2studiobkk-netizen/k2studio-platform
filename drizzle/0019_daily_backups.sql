CREATE TABLE `backup_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`backup_date` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`r2_key` text DEFAULT '' NOT NULL,
	`google_drive_url` text DEFAULT '' NOT NULL,
	`google_sheet_url` text DEFAULT '' NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_backup_runs_date` ON `backup_runs` (`backup_date`);
--> statement-breakpoint
CREATE INDEX `idx_backup_runs_started` ON `backup_runs` (`started_at`);
