ALTER TABLE `services` ADD `whyProblemExists` text;--> statement-breakpoint
ALTER TABLE `services` ADD `hvcoTopic` varchar(300);--> statement-breakpoint
ALTER TABLE `services` ADD `mechanismDescriptor` enum('AI','System','Framework','Method','Blueprint','Process');--> statement-breakpoint
ALTER TABLE `services` ADD `applicationMethod` varchar(150);--> statement-breakpoint
ALTER TABLE `services` ADD `avatarName` varchar(100);--> statement-breakpoint
ALTER TABLE `services` ADD `avatarTitle` varchar(100);