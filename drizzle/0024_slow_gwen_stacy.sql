CREATE TABLE `campaign_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaCampaignId` varchar(255),
	`alertType` enum('ctr_drop','cpc_exceed','spend_limit','low_impressions') NOT NULL,
	`threshold` decimal(10,2) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastTriggeredAt` timestamp,
	`triggerCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaign_alerts` ADD CONSTRAINT `campaign_alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_campaignAlerts_userId` ON `campaign_alerts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_campaignAlerts_metaCampaignId` ON `campaign_alerts` (`metaCampaignId`);