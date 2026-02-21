CREATE TABLE `meta_published_ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`adSetId` varchar(255) NOT NULL,
	`metaCampaignId` varchar(255) NOT NULL,
	`metaAdSetId` varchar(255) NOT NULL,
	`metaAdId` varchar(255) NOT NULL,
	`metaCreativeId` varchar(255) NOT NULL,
	`campaignName` varchar(255) NOT NULL,
	`status` enum('ACTIVE','PAUSED','ARCHIVED','DELETED') NOT NULL DEFAULT 'PAUSED',
	`objective` varchar(100),
	`dailyBudget` decimal(10,2),
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSyncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_published_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meta_published_ads` ADD CONSTRAINT `meta_published_ads_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_metaPublishedAds_userId` ON `meta_published_ads` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_metaPublishedAds_adSetId` ON `meta_published_ads` (`adSetId`);