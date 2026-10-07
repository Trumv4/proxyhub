CREATE TABLE `manual_topup_approvals` (
	`topup_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`bank_reference` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`topup_id`) REFERENCES `topups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `topups` ADD `reported` integer;--> statement-breakpoint
ALTER TABLE `wallet_entries` ADD `bank_reference` text;--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_bank_reference` ON `wallet_entries` (`bank_reference`);