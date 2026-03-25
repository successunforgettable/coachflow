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
