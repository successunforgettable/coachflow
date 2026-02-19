CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`assetId` varchar(255),
	`assetType` varchar(50),
	`eventType` enum('email_open','email_click','link_click','conversion','purchase') NOT NULL,
	`userIdentifier` varchar(255),
	`metadata` json,
	`revenue` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `campaign_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`metricDate` date NOT NULL,
	`emailOpens` int DEFAULT 0,
	`emailClicks` int DEFAULT 0,
	`linkClicks` int DEFAULT 0,
	`conversions` int DEFAULT 0,
	`revenue` decimal(10,2) DEFAULT '0',
	`spend` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_campaign_date` UNIQUE(`campaignId`,`metricDate`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `description` text;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_assets` ADD CONSTRAINT `campaign_assets_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_links` ADD CONSTRAINT `campaign_links_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_links` ADD CONSTRAINT `campaign_links_sourceAssetId_campaign_assets_id_fk` FOREIGN KEY (`sourceAssetId`) REFERENCES `campaign_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_links` ADD CONSTRAINT `campaign_links_targetAssetId_campaign_assets_id_fk` FOREIGN KEY (`targetAssetId`) REFERENCES `campaign_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_metrics` ADD CONSTRAINT `campaign_metrics_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_analytics_campaign` ON `analytics_events` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_analytics_asset` ON `analytics_events` (`assetId`);--> statement-breakpoint
CREATE INDEX `idx_analytics_eventType` ON `analytics_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_analytics_createdAt` ON `analytics_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_campaign_assets_campaignId` ON `campaign_assets` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_campaign_assets_assetType` ON `campaign_assets` (`assetType`);--> statement-breakpoint
CREATE INDEX `idx_campaign_links_campaignId` ON `campaign_links` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_campaign_links_sourceAssetId` ON `campaign_links` (`sourceAssetId`);--> statement-breakpoint
CREATE INDEX `idx_campaign_links_targetAssetId` ON `campaign_links` (`targetAssetId`);--> statement-breakpoint
CREATE INDEX `idx_campaignMetrics_date` ON `campaign_metrics` (`metricDate`);