CREATE TABLE `user_onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 1,
	`completed` boolean NOT NULL DEFAULT false,
	`serviceId` int,
	`icpId` varchar(255),
	`headlineSetId` varchar(255),
	`campaignId` int,
	`skipped` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `user_onboarding_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_onboarding_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `user_onboarding` ADD CONSTRAINT `user_onboarding_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_onboarding_user` ON `user_onboarding` (`userId`);