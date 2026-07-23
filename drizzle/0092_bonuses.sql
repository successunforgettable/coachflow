-- Migration 0092 — bonuses table (forward-sequence step 2, Layer 1: Class-A bonus generation).
-- A distinct entity (NOT services.bonuses, NOT hvcoTitles) holding the 3 generated bonuses per kit
-- (Accelerator / Gap-Filler / Objection-Crusher), each derived from a specific ICP obstacle. Layer-1 columns
-- carry the concept (title/description/type/obstacle/format); the value is coach-supplied ONLY (nullable);
-- assetBody + magnet URLs are reserved for Layer 2 (hosted PDF) and stay NULL in Layer 1. Additive, safe.
-- Applied via direct mysql (no drizzle-kit statement-breakpoints); each statement stands alone.
CREATE TABLE `bonuses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `serviceId` int,
  `campaignId` int,
  `campaignKitId` int,
  `bonusSetId` varchar(191) NOT NULL,
  `bonusType` enum('accelerator','gap_filler','objection_crusher') NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `shortLine` varchar(255) NOT NULL,
  `value` varchar(255),
  `derivedFromObstacle` text NOT NULL,
  `format` varchar(50) NOT NULL,
  `assetBody` json,
  `magnetHtmlUrl` varchar(500),
  `magnetPdfUrl` varchar(500),
  `source` enum('generated','imported') NOT NULL DEFAULT 'generated',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `bonuses_id` PRIMARY KEY(`id`)
);
ALTER TABLE `bonuses` ADD CONSTRAINT `bonuses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `idx_bonuses_userId` ON `bonuses` (`userId`);
CREATE INDEX `idx_bonuses_kit` ON `bonuses` (`campaignKitId`);
CREATE INDEX `idx_bonuses_set` ON `bonuses` (`bonusSetId`);
