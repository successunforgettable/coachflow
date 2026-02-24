CREATE TABLE `metaConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaUserId` varchar(255) NOT NULL,
	`adAccountId` varchar(255) NOT NULL,
	`adAccountName` varchar(255),
	`pageId` varchar(255),
	`pageName` varchar(255),
	`accessToken` text NOT NULL,
	`tokenExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metaConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `metaConnections_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `videoCreditTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('purchase','deduction','free_grant','refund') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`videoId` int,
	`description` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `videoCreditTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoCredits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoCredits_id` PRIMARY KEY(`id`),
	CONSTRAINT `videoCredits_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `videoScripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int NOT NULL,
	`campaignId` int,
	`videoType` enum('explainer','proof_results','testimonial','mechanism_reveal') NOT NULL,
	`duration` enum('15','30','60','90') NOT NULL,
	`visualStyle` enum('kinetic_typography','motion_graphics','stats_card') NOT NULL,
	`scenes` json NOT NULL,
	`voiceoverText` text NOT NULL,
	`status` enum('draft','approved','rendered','failed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoScripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int NOT NULL,
	`campaignId` int,
	`scriptId` int NOT NULL,
	`videoType` enum('explainer','proof_results','testimonial','mechanism_reveal') NOT NULL,
	`duration` enum('15','30','60','90') NOT NULL,
	`visualStyle` enum('kinetic_typography','motion_graphics','stats_card') NOT NULL,
	`creatomateRenderId` varchar(255),
	`creatomateStatus` enum('queued','rendering','succeeded','failed') NOT NULL DEFAULT 'queued',
	`videoUrl` varchar(1000),
	`thumbnailUrl` varchar(1000),
	`fileSize` int,
	`creditsUsed` int NOT NULL,
	`sentToMetaAt` timestamp,
	`metaCreativeId` varchar(255),
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `metaConnections` ADD CONSTRAINT `metaConnections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoCreditTransactions` ADD CONSTRAINT `videoCreditTransactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoCredits` ADD CONSTRAINT `videoCredits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoScripts` ADD CONSTRAINT `videoScripts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoScripts` ADD CONSTRAINT `videoScripts_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoScripts` ADD CONSTRAINT `videoScripts_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videos` ADD CONSTRAINT `videos_scriptId_videoScripts_id_fk` FOREIGN KEY (`scriptId`) REFERENCES `videoScripts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_metaConnections_userId` ON `metaConnections` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_videoCreditTransactions_userId` ON `videoCreditTransactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_videoCreditTransactions_videoId` ON `videoCreditTransactions` (`videoId`);--> statement-breakpoint
CREATE INDEX `idx_videoCredits_userId` ON `videoCredits` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_videoScripts_userId` ON `videoScripts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_videoScripts_serviceId` ON `videoScripts` (`serviceId`);--> statement-breakpoint
CREATE INDEX `idx_videoScripts_campaignId` ON `videoScripts` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_videos_userId` ON `videos` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_videos_serviceId` ON `videos` (`serviceId`);--> statement-breakpoint
CREATE INDEX `idx_videos_campaignId` ON `videos` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_videos_scriptId` ON `videos` (`scriptId`);