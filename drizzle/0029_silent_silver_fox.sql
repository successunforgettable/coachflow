ALTER TABLE `services` ADD `totalCustomers` int;--> statement-breakpoint
ALTER TABLE `services` ADD `averageRating` decimal(3,2);--> statement-breakpoint
ALTER TABLE `services` ADD `totalReviews` int;--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial1Name` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial1Title` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial1Quote` text;--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial2Name` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial2Title` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial2Quote` text;--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial3Name` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial3Title` varchar(255);--> statement-breakpoint
ALTER TABLE `services` ADD `testimonial3Quote` text;--> statement-breakpoint
ALTER TABLE `services` ADD `pressFeatures` text;