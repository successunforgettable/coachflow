ALTER TABLE `adCreatives` ADD `campaignId` int;--> statement-breakpoint
ALTER TABLE `adCreatives` ADD CONSTRAINT `adCreatives_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_adCreatives_campaignId` ON `adCreatives` (`campaignId`);