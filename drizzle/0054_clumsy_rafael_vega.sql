ALTER TABLE `jobs` ADD `progress` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `retry_count` int DEFAULT 0 NOT NULL;