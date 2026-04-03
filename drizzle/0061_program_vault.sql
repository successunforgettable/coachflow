-- W0 Program Vault migration — adds 7 new columns to services table.
-- If this migration fails partway through due to a duplicate column error,
-- connect to Railway MySQL directly and run only the missing ALTER TABLE statements.
-- Do NOT re-run the full migration file — drizzle-kit migrate is not idempotent.
ALTER TABLE `services` ADD `bonuses` text;--> statement-breakpoint
ALTER TABLE `services` ADD `guaranteeDuration` varchar(100);--> statement-breakpoint
ALTER TABLE `services` ADD `guaranteeType` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `deliveryFormat` enum('live','online','hybrid');--> statement-breakpoint
ALTER TABLE `services` ADD `deliveryDuration` varchar(100);--> statement-breakpoint
ALTER TABLE `services` ADD `paymentPlan` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `earlyBirdPrice` decimal(10,2);
