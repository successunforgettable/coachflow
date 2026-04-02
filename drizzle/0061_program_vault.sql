ALTER TABLE `services` ADD `bonuses` text;--> statement-breakpoint
ALTER TABLE `services` ADD `guaranteeDuration` varchar(100);--> statement-breakpoint
ALTER TABLE `services` ADD `guaranteeType` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `deliveryFormat` enum('live','online','hybrid');--> statement-breakpoint
ALTER TABLE `services` ADD `deliveryDuration` varchar(100);--> statement-breakpoint
ALTER TABLE `services` ADD `paymentPlan` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `earlyBirdPrice` decimal(10,2);
