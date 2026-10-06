CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "valid_transaction" CHECK("transaction_guards"."valid" = 1)
);
--> statement-breakpoint
CREATE TABLE `locks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`message` text NOT NULL,
	`created` integer NOT NULL,
	`dedupe` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe` ON `notifications` (`dedupe`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`product` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created` integer NOT NULL,
	`approved` integer,
	`request_id` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product`) REFERENCES `products`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request` ON `orders` (`customer_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`protocol` text NOT NULL,
	`price` integer NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`checked` integer NOT NULL,
	`replaced` integer NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`position` integer NOT NULL,
	`stock_id` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stock_id`) REFERENCES `stock`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slot_order_position` ON `slots` (`order_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `slot_stock` ON `slots` (`stock_id`);--> statement-breakpoint
CREATE TABLE `stock` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`protocol` text NOT NULL,
	`region` text NOT NULL,
	`credentials` text NOT NULL,
	`state` text DEFAULT 'AVAILABLE' NOT NULL,
	`health` text DEFAULT 'UNKNOWN' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`latency` integer,
	`last_error` text,
	`provider_expiry` integer,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_fingerprint` ON `stock` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `stock_due` ON `stock` (`state`,`checked`);--> statement-breakpoint
CREATE TABLE `warranty` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`old_stock` text NOT NULL,
	`new_stock` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`old_stock`) REFERENCES `stock`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`new_stock`) REFERENCES `stock`(`id`) ON UPDATE no action ON DELETE no action
);
