CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`stock_id` text NOT NULL,
	`position` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stock_id`) REFERENCES `digital_stock`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_stock` ON `deliveries` (`stock_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_position` ON `deliveries` (`order_id`,`position`);--> statement-breakpoint
CREATE TABLE `digital_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`fingerprint` text NOT NULL,
	`content` text NOT NULL,
	`state` text DEFAULT 'AVAILABLE' NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digital_fingerprint` ON `digital_stock` (`product`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `digital_available` ON `digital_stock` (`product`,`state`);--> statement-breakpoint
ALTER TABLE `products` ADD `kind` text DEFAULT 'PROXY' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `description` text DEFAULT '' NOT NULL;