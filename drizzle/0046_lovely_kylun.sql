ALTER TABLE `campaigns` DROP FOREIGN KEY `campaigns_icp_id_idealCustomerProfiles_id_fk`;
--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingComplete` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingStage` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `activityStreak` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastActivityDate` date;--> statement-breakpoint
ALTER TABLE `users` ADD `streakUpdatedAt` timestamp;