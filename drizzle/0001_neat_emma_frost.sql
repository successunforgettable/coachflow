CREATE TABLE `adCopy` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`adType` enum('story','authority','question','social_proof','cta'),
	`headline` varchar(500) NOT NULL,
	`bodyCopy` text NOT NULL,
	`linkDescription` varchar(500),
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adCopy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`name` varchar(255) NOT NULL,
	`campaignType` enum('webinar','challenge','course_launch','product_launch'),
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`startDate` timestamp,
	`endDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`sequenceType` enum('welcome','engagement','sales'),
	`name` varchar(255) NOT NULL,
	`emails` json NOT NULL,
	`automationEnabled` boolean DEFAULT false,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailSequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idealCustomerProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`name` varchar(255) NOT NULL,
	`demographics` json,
	`painPoints` text,
	`desiredOutcomes` text,
	`valuesMotivations` text,
	`buyingTriggers` text,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `idealCustomerProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landingPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`angle` enum('shock_solve','contrarian','story','authority'),
	`headline` text NOT NULL,
	`sections` json NOT NULL,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landingPages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`offerType` enum('standard','premium','vip'),
	`headline` text NOT NULL,
	`whatIncluded` json NOT NULL,
	`bonuses` json,
	`guarantee` text,
	`price` decimal(10,2),
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('coaching','speaking','consulting') NOT NULL,
	`description` text NOT NULL,
	`targetCustomer` varchar(500) NOT NULL,
	`mainBenefit` varchar(500) NOT NULL,
	`price` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`campaignId` int,
	`sequenceType` enum('engagement','sales'),
	`name` varchar(255) NOT NULL,
	`messages` json NOT NULL,
	`automationEnabled` boolean DEFAULT false,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappSequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adCopy` ADD CONSTRAINT `adCopy_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adCopy` ADD CONSTRAINT `adCopy_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adCopy` ADD CONSTRAINT `adCopy_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailSequences` ADD CONSTRAINT `emailSequences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailSequences` ADD CONSTRAINT `emailSequences_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emailSequences` ADD CONSTRAINT `emailSequences_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idealCustomerProfiles` ADD CONSTRAINT `idealCustomerProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idealCustomerProfiles` ADD CONSTRAINT `idealCustomerProfiles_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landingPages` ADD CONSTRAINT `landingPages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landingPages` ADD CONSTRAINT `landingPages_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landingPages` ADD CONSTRAINT `landingPages_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsappSequences` ADD CONSTRAINT `whatsappSequences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsappSequences` ADD CONSTRAINT `whatsappSequences_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsappSequences` ADD CONSTRAINT `whatsappSequences_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_adCopy_userId` ON `adCopy` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_adCopy_campaignId` ON `adCopy` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_userId` ON `campaigns` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_serviceId` ON `campaigns` (`serviceId`);--> statement-breakpoint
CREATE INDEX `idx_emailSequences_userId` ON `emailSequences` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_emailSequences_campaignId` ON `emailSequences` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_icp_userId` ON `idealCustomerProfiles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_icp_serviceId` ON `idealCustomerProfiles` (`serviceId`);--> statement-breakpoint
CREATE INDEX `idx_landingPages_userId` ON `landingPages` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_landingPages_campaignId` ON `landingPages` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_offers_userId` ON `offers` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_offers_campaignId` ON `offers` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_services_userId` ON `services` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_whatsappSequences_userId` ON `whatsappSequences` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_whatsappSequences_campaignId` ON `whatsappSequences` (`campaignId`);