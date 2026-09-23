ALTER TABLE `orders` ADD `rush_mode` text NOT NULL DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE `orders` ADD `requested_speed_days` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_tier` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `orders` ADD `rush_fee` text NOT NULL DEFAULT '0';
--> statement-breakpoint
ALTER TABLE `orders` ADD `rush_note` text NOT NULL DEFAULT '';
