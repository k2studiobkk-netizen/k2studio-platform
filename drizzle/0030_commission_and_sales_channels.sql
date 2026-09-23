CREATE TABLE `sales_channels` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `prefix` text NOT NULL,
  `platform` text DEFAULT '' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_by` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `sales_channels_code_unique` ON `sales_channels` (`code`);
CREATE UNIQUE INDEX `sales_channels_prefix_unique` ON `sales_channels` (`prefix`);
CREATE INDEX `idx_sales_channels_active_sort` ON `sales_channels` (`active`,`sort_order`,`name`);

INSERT INTO `sales_channels` (`code`,`name`,`prefix`,`platform`,`sort_order`,`created_by`) VALUES
  ('facebook_k2sign','Facebook K2SIGN','K2','Facebook',10,'system'),
  ('facebook_sweetdesign','Facebook Sweetdesign','SW','Facebook',20,'system'),
  ('line_k2sign','LINE K2SIGN','LK','LINE',30,'system'),
  ('line_k2studio','LINE K2STUDIO','LS','LINE',40,'system');

CREATE TABLE `commission_tiers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sales_owner_id` integer,
  `tier_name` text NOT NULL,
  `min_sales` real DEFAULT 0 NOT NULL,
  `max_sales` real,
  `rate_percent` real NOT NULL,
  `effective_from` text NOT NULL,
  `effective_to` text DEFAULT '' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_by_id` integer NOT NULL,
  `created_by_name` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `idx_commission_tiers_owner_effective` ON `commission_tiers` (`sales_owner_id`,`effective_from`,`effective_to`,`min_sales`);
