CREATE TABLE `adCreatives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int,
	`niche` varchar(255) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`uniqueMechanism` varchar(255),
	`targetAudience` varchar(255) NOT NULL,
	`mainBenefit` text NOT NULL,
	`pressingProblem` text NOT NULL,
	`adType` enum('lead_gen','ecommerce') NOT NULL DEFAULT 'lead_gen',
	`designStyle` enum('person_shocked','screenshot','person_intense','object','person_curious') NOT NULL,
	`headlineFormula` enum('banned','secret','leaked','glitch','forbidden') NOT NULL,
	`headline` varchar(255) NOT NULL,
	`imageUrl` text NOT NULL,
	`imageFormat` varchar(20) NOT NULL DEFAULT '1080x1080',
	`complianceChecked` boolean NOT NULL DEFAULT true,
	`complianceIssues` text,
	`batchId` varchar(100),
	`variationNumber` int NOT NULL DEFAULT 1,
	`rating` int DEFAULT 0,
	`downloaded` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adCreatives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adCreatives` ADD CONSTRAINT `adCreatives_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adCreatives` ADD CONSTRAINT `adCreatives_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_adCreatives_userId` ON `adCreatives` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_adCreatives_serviceId` ON `adCreatives` (`serviceId`);--> statement-breakpoint
CREATE INDEX `idx_adCreatives_batchId` ON `adCreatives` (`batchId`);