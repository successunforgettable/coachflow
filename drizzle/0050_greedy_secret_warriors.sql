CREATE TABLE `jobs` (
	`id` varchar(36) NOT NULL,
	`status` enum('pending','complete','failed') NOT NULL DEFAULT 'pending',
	`result` text,
	`error` varchar(1024),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
