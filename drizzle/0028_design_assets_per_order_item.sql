ALTER TABLE `design_assets` ADD `order_item_id` integer;

CREATE INDEX `idx_design_assets_order_item`
ON `design_assets` (`order_item_id`, `design_version_id`, `sort_order`);
