CREATE TABLE `phrase_usage_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phraseId` int NOT NULL,
	`phrase` varchar(255) NOT NULL,
	`category` enum('critical','warning') NOT NULL,
	`userId` int NOT NULL,
	`generatorType` varchar(50) NOT NULL,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phrase_usage_stats_id` PRIMARY KEY(`id`)
);
