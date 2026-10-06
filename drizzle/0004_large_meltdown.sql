CREATE TABLE `auth_accounts` (
	`customer_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`salt` text NOT NULL,
	`password_hash` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_email` ON `auth_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seller_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires` integer NOT NULL,
	`used_by` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seller_sales` (
	`order_id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`gross` integer NOT NULL,
	`fee` integer NOT NULL,
	`net` integer NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sellers` (
	`customer_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'SELLER' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `seller_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `unit_fee` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `seller_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `review_state` text DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock` ADD `product` text REFERENCES products(code);