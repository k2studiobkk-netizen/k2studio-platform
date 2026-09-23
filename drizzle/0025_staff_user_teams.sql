CREATE TABLE `staff_user_teams` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `team_code` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `staff_users` (`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `idx_staff_user_teams_user_team`
ON `staff_user_teams` (`user_id`,`team_code`);

CREATE INDEX `idx_staff_user_teams_team_user`
ON `staff_user_teams` (`team_code`,`user_id`);

PRAGMA optimize;
