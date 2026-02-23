ALTER TABLE `headlines` ADD `complianceScore` int DEFAULT 100;--> statement-breakpoint
ALTER TABLE `headlines` ADD `complianceVersion` varchar(20);--> statement-breakpoint
ALTER TABLE `headlines` ADD `complianceCheckedAt` timestamp;