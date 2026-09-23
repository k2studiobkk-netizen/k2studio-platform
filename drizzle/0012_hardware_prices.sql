CREATE TABLE `hardware_prices` (
  `hardware_code` text PRIMARY KEY NOT NULL,
  `price` text NOT NULL,
  `updated_by` text DEFAULT '' NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
