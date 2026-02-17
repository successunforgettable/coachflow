CREATE TABLE `heroMechanisms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`mechanismSetId` varchar(50) NOT NULL,
	`tabType` enum('hero_mechanisms','headline_ideas','beast_mode') NOT NULL,
	`mechanismName` varchar(255) NOT NULL,
	`mechanismDescription` text NOT NULL,
	`targetMarket` varchar(100) NOT NULL,
	`pressingProblem` varchar(200) NOT NULL,
	`whyProblem` text NOT NULL,
	`whatTried` text NOT NULL,
	`whyExistingNotWork` text NOT NULL,
	`descriptor` varchar(50),
	`application` varchar(100),
	`desiredOutcome` varchar(200) NOT NULL,
	`credibility` varchar(200) NOT NULL,
	`socialProof` varchar(200) NOT NULL,
	`rating` int DEFAULT 0,
	`isFavorite` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `heroMechanisms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hvcoTitles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`hvcoSetId` varchar(50) NOT NULL,
	`tabType` enum('long','short','beast_mode','subheadlines') NOT NULL,
	`title` varchar(500) NOT NULL,
	`targetMarket` varchar(100) NOT NULL,
	`hvcoTopic` text NOT NULL,
	`rating` int DEFAULT 0,
	`isFavorite` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hvcoTitles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `hvcoGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `heroMechanismGeneratedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `heroMechanisms` ADD CONSTRAINT `heroMechanisms_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `heroMechanisms` ADD CONSTRAINT `heroMechanisms_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `heroMechanisms` ADD CONSTRAINT `heroMechanisms_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hvcoTitles` ADD CONSTRAINT `hvcoTitles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hvcoTitles` ADD CONSTRAINT `hvcoTitles_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hvcoTitles` ADD CONSTRAINT `hvcoTitles_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_heroMechanisms_userId` ON `heroMechanisms` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_heroMechanisms_campaignId` ON `heroMechanisms` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_heroMechanisms_mechanismSetId` ON `heroMechanisms` (`mechanismSetId`);--> statement-breakpoint
CREATE INDEX `idx_hvcoTitles_userId` ON `hvcoTitles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_hvcoTitles_campaignId` ON `hvcoTitles` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_hvcoTitles_hvcoSetId` ON `hvcoTitles` (`hvcoSetId`);