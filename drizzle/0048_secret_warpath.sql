CREATE TABLE `admin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`admin_user_id` int NOT NULL,
	`action_type` varchar(100) NOT NULL,
	`target_user_id` int,
	`details` text NOT NULL DEFAULT ('{}'),
	`ip_address` varchar(100),
	`user_agent` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`content_type` varchar(100) NOT NULL,
	`content_id` int NOT NULL,
	`content_text` text,
	`flag_reason` text,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`resolved_by` int,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`admin_user_id` int NOT NULL,
	`note` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_target_user_id_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_flags` ADD CONSTRAINT `content_flags_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_adminUserId` ON `admin_audit_log` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_targetUserId` ON `admin_audit_log` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_createdAt` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_contentFlags_userId` ON `content_flags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_contentFlags_status` ON `content_flags` (`status`);--> statement-breakpoint
CREATE INDEX `idx_userNotes_userId` ON `user_notes` (`user_id`);