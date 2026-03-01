CREATE TABLE `icp_angle_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`service_id` int NOT NULL,
	`user_id` int NOT NULL,
	`angle_name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`primary_pain` text NOT NULL,
	`primary_buying_trigger` text NOT NULL,
	`status` varchar(50) DEFAULT 'suggested',
	`icp_id` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `icp_angle_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `icp_id` int;--> statement-breakpoint
ALTER TABLE `idealCustomerProfiles` ADD `angle_name` varchar(255);--> statement-breakpoint
ALTER TABLE `icp_angle_suggestions` ADD CONSTRAINT `icp_angle_suggestions_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `icp_angle_suggestions` ADD CONSTRAINT `icp_angle_suggestions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `icp_angle_suggestions` ADD CONSTRAINT `icp_angle_suggestions_icp_id_idealCustomerProfiles_id_fk` FOREIGN KEY (`icp_id`) REFERENCES `idealCustomerProfiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_icp_angle_suggestions_serviceId` ON `icp_angle_suggestions` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_icp_angle_suggestions_userId` ON `icp_angle_suggestions` (`user_id`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_icp_id_idealCustomerProfiles_id_fk` FOREIGN KEY (`icp_id`) REFERENCES `idealCustomerProfiles`(`id`) ON DELETE set null ON UPDATE no action;