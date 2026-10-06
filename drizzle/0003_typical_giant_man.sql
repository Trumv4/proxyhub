CREATE TABLE `topups` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`code` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`bank_id` text NOT NULL,
	`account_number` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`credited` integer,
	`transaction_id` text,
	`request_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topup_code` ON `topups` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `topup_transaction` ON `topups` (`transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `topup_request` ON `topups` (`customer_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `wallet_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_reference` ON `wallet_entries` (`reference`);--> statement-breakpoint
CREATE INDEX `wallet_customer` ON `wallet_entries` (`customer_id`,`created`);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method` text DEFAULT 'MANUAL' NOT NULL;