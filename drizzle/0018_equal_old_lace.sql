CREATE TABLE `banned_phrases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phrase` varchar(255) NOT NULL,
	`category` enum('critical','warning') NOT NULL,
	`description` text,
	`suggestion` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banned_phrases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(50) NOT NULL,
	`lastUpdated` date NOT NULL,
	`nextReviewDue` date NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_bannedPhrases_category` ON `banned_phrases` (`category`);--> statement-breakpoint
CREATE INDEX `idx_bannedPhrases_active` ON `banned_phrases` (`active`);