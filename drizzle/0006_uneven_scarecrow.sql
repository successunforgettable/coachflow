ALTER TABLE `adCopy` MODIFY COLUMN `adType` enum('lead_gen','ecommerce') NOT NULL;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `adSetId` varchar(21) NOT NULL;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `adStyle` varchar(100);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `contentType` enum('headline','body','link') NOT NULL;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `content` text NOT NULL;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `targetMarket` varchar(255);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `pressingProblem` text;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `desiredOutcome` text;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `uniqueMechanism` text;--> statement-breakpoint
CREATE INDEX `idx_adCopy_adSetId` ON `adCopy` (`adSetId`);--> statement-breakpoint
ALTER TABLE `adCopy` DROP COLUMN `headline`;--> statement-breakpoint
ALTER TABLE `adCopy` DROP COLUMN `bodyCopy`;--> statement-breakpoint
ALTER TABLE `adCopy` DROP COLUMN `linkDescription`;