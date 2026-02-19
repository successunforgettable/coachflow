CREATE TABLE `campaign_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`assetType` enum('headline','hvco','hero_mechanism','ad_copy','email_sequence','whatsapp_sequence','landing_page','offer','icp') NOT NULL,
	`assetId` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`sourceAssetId` int NOT NULL,
	`targetAssetId` int NOT NULL,
	`linkType` enum('leads_to','supports','requires') NOT NULL DEFAULT 'leads_to',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `description` text;--> statement-breakpoint
CREATE INDEX `idx_campaignAssets_campaignId` ON `campaign_assets` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_campaignAssets_assetType` ON `campaign_assets` (`assetType`);--> statement-breakpoint
CREATE INDEX `idx_campaignLinks_campaignId` ON `campaign_links` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_campaignLinks_sourceAssetId` ON `campaign_links` (`sourceAssetId`);--> statement-breakpoint
CREATE INDEX `idx_campaignLinks_targetAssetId` ON `campaign_links` (`targetAssetId`);