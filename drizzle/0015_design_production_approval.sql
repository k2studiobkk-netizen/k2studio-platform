ALTER TABLE `orders` ADD `production_released_at` text NOT NULL DEFAULT '';
ALTER TABLE `orders` ADD `production_released_by` text NOT NULL DEFAULT '';

ALTER TABLE `design_versions` ADD `scale_file_name` text NOT NULL DEFAULT '';
ALTER TABLE `design_versions` ADD `scale_file_key` text NOT NULL DEFAULT '';
ALTER TABLE `design_versions` ADD `scale_file_type` text NOT NULL DEFAULT '';
ALTER TABLE `design_versions` ADD `mockup_file_name` text NOT NULL DEFAULT '';
ALTER TABLE `design_versions` ADD `mockup_file_key` text NOT NULL DEFAULT '';
ALTER TABLE `design_versions` ADD `mockup_file_type` text NOT NULL DEFAULT '';

UPDATE `design_versions`
SET `mockup_file_name` = `file_name`,
    `mockup_file_key` = `file_key`,
    `mockup_file_type` = `file_type`
WHERE `mockup_file_key` = '';
