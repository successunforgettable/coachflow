CREATE TABLE `meta_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`tokenExpiresAt` timestamp NOT NULL,
	`adAccountId` varchar(255),
	`adAccountName` varchar(255),
	`businessId` varchar(255),
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`lastRefreshedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `meta_access_tokens_userId_unique` UNIQUE(`userId`)
);
