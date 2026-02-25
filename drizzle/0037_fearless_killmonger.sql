CREATE TABLE `demoVideos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'ZAP Demo Video',
	`description` text,
	`creatomateRenderId` varchar(255),
	`creatomateStatus` enum('queued','rendering','succeeded','failed') NOT NULL DEFAULT 'queued',
	`videoUrl` varchar(1000),
	`thumbnailUrl` varchar(1000),
	`fileSize` int,
	`duration` int NOT NULL DEFAULT 30,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `demoVideos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `demoVideos` ADD CONSTRAINT `demoVideos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;