ALTER TABLE `products` ADD `sku` text;--> statement-breakpoint
CREATE UNIQUE INDEX `product_sku` ON `products` (`sku`);