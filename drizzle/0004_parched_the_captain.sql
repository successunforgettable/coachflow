CREATE TABLE `headlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`headlineSetId` varchar(50) NOT NULL,
	`formulaType` enum('story','eyebrow','question','authority','urgency') NOT NULL,
	`headline` text NOT NULL,
	`subheadline` text,
	`eyebrow` varchar(255),
	`targetMarket` varchar(255) NOT NULL,
	`pressingProblem` text NOT NULL,
	`desiredOutcome` text NOT NULL,
	`uniqueMechanism` text NOT NULL,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `headlines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `icpGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `adCopyGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailSeqGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `whatsappSeqGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `landingPageGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `offerGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `headlineGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `usageResetAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `headlines` ADD CONSTRAINT `headlines_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `headlines` ADD CONSTRAINT `headlines_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `headlines` ADD CONSTRAINT `headlines_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_headlines_userId` ON `headlines` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_headlines_campaignId` ON `headlines` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_headlines_headlineSetId` ON `headlines` (`headlineSetId`);