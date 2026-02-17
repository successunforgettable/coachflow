ALTER TABLE `landingPages` ADD `productName` text NOT NULL;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `productDescription` text NOT NULL;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `avatarName` text;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `avatarDescription` text;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `originalAngle` json;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `godfatherAngle` json;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `freeAngle` json;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `dollarAngle` json;--> statement-breakpoint
ALTER TABLE `landingPages` ADD `activeAngle` enum('original','godfather','free','dollar') DEFAULT 'original';--> statement-breakpoint
ALTER TABLE `landingPages` DROP COLUMN `angle`;--> statement-breakpoint
ALTER TABLE `landingPages` DROP COLUMN `headline`;--> statement-breakpoint
ALTER TABLE `landingPages` DROP COLUMN `sections`;