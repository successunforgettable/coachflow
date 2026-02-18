ALTER TABLE `adCopy` MODIFY COLUMN `targetMarket` varchar(52);--> statement-breakpoint
ALTER TABLE `adCopy` MODIFY COLUMN `pressingProblem` varchar(48);--> statement-breakpoint
ALTER TABLE `adCopy` MODIFY COLUMN `desiredOutcome` varchar(25);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `adCallToAction` varchar(100);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `productCategory` varchar(79);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `specificProductName` varchar(72);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `listBenefits` text;--> statement-breakpoint
ALTER TABLE `adCopy` ADD `specificTechnology` varchar(23);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `scientificStudies` varchar(31);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `credibleAuthority` varchar(70);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `featuredIn` varchar(65);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `numberOfReviews` varchar(20);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `averageReviewRating` varchar(10);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `totalCustomers` varchar(20);--> statement-breakpoint
ALTER TABLE `adCopy` ADD `testimonials` text;