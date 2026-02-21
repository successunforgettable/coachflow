CREATE TABLE `compliance_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`adminUserName` varchar(255) NOT NULL,
	`adminUserEmail` varchar(320) NOT NULL,
	`action` enum('add','update','delete','import','version_update') NOT NULL,
	`phraseId` int,
	`phraseBefore` text,
	`phraseAfter` text,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_history_id` PRIMARY KEY(`id`)
);
