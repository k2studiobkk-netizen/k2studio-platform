CREATE TABLE `design_assets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `design_version_id` integer NOT NULL,
  `asset_type` text NOT NULL,
  `file_name` text NOT NULL,
  `file_key` text NOT NULL,
  `file_type` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_design_assets_version_type`
ON `design_assets` (`design_version_id`, `asset_type`, `sort_order`);

INSERT INTO `design_assets` (`design_version_id`,`asset_type`,`file_name`,`file_key`,`file_type`,`sort_order`)
SELECT `id`,'scale',`scale_file_name`,`scale_file_key`,`scale_file_type`,1
FROM `design_versions`
WHERE `scale_file_key` <> '';

INSERT INTO `design_assets` (`design_version_id`,`asset_type`,`file_name`,`file_key`,`file_type`,`sort_order`)
SELECT `id`,'mockup',`mockup_file_name`,`mockup_file_key`,`mockup_file_type`,1
FROM `design_versions`
WHERE `mockup_file_key` <> '';
