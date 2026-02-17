CREATE TABLE `sourceOfTruth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`programName` varchar(255) NOT NULL,
	`coreOffer` text NOT NULL,
	`targetAudience` text NOT NULL,
	`mainPainPoint` text NOT NULL,
	`priceRange` varchar(100),
	`description` text,
	`targetCustomer` text,
	`mainBenefits` text,
	`painPoints` text,
	`uniqueValue` text,
	`idealCustomerAvatar` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sourceOfTruth_id` PRIMARY KEY(`id`),
	CONSTRAINT `sourceOfTruth_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `sourceOfTruth` ADD CONSTRAINT `sourceOfTruth_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_sourceOfTruth_userId` ON `sourceOfTruth` (`userId`);