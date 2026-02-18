ALTER TABLE `offers` ADD `productName` text NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `godfatherAngle` json;--> statement-breakpoint
ALTER TABLE `offers` ADD `freeAngle` json;--> statement-breakpoint
ALTER TABLE `offers` ADD `dollarAngle` json;--> statement-breakpoint
ALTER TABLE `offers` ADD `activeAngle` enum('godfather','free','dollar') DEFAULT 'godfather';--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `headline`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `whatIncluded`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `bonuses`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `guarantee`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `price`;