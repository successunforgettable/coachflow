CREATE TABLE `favourites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nodeId` varchar(50) NOT NULL,
	`itemIndex` int NOT NULL,
	`itemText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favourites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ghl_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiresAt` timestamp NOT NULL,
	`locationId` varchar(255),
	`locationName` varchar(255),
	`companyId` varchar(255),
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ghl_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `ghl_access_tokens_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `favourites` ADD CONSTRAINT `favourites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_product_events_userId` ON `product_events` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_product_events_eventType` ON `product_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_product_events_createdAt` ON `product_events` (`createdAt`);