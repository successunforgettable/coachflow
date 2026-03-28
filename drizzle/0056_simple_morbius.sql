CREATE TABLE `coachAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetType` varchar(50) NOT NULL,
	`url` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coachAssets_id` PRIMARY KEY(`id`)
);
