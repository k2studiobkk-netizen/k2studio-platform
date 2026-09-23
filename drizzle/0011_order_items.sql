CREATE TABLE `order_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_id` integer NOT NULL,
  `line_no` integer NOT NULL,
  `item_name` text DEFAULT '' NOT NULL,
  `thickness_mm` text NOT NULL,
  `width_cm` text NOT NULL,
  `height_cm` text NOT NULL,
  `pricing_size_cm` integer NOT NULL,
  `quantity` integer NOT NULL,
  `print_sides` integer NOT NULL,
  `hardware_code` text NOT NULL,
  `hardware_name` text NOT NULL,
  `hardware_color` text DEFAULT '' NOT NULL,
  `packaging_type` text NOT NULL,
  `unit_price` text NOT NULL,
  `line_total` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_items_order_line` ON `order_items` (`order_id`,`line_no`);
--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`order_id`);
