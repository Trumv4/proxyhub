CREATE TABLE `user_moderation` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `banned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `ban_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `last_login` integer;