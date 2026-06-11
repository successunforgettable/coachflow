-- Trail Sprint 1 — three additive schema changes.
-- All are net-new: nullable column append + two new tables.
-- No existing columns modified, no existing behaviour affected.
-- isComplete check reads selected*Id columns (unchanged).
-- Cascade prereqs read selected*Id columns (unchanged).

-- 1. Add path enum to campaignKits (nullable — pre-Trail kits get NULL)
ALTER TABLE `campaignKits`
  ADD COLUMN `path` enum('auto','manual','has_assets') DEFAULT NULL;

-- 2. Create nodeStatuses table (explicit node status tracking)
CREATE TABLE `nodeStatuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaignKitId` int NOT NULL,
  `nodeType` varchar(30) NOT NULL,
  `status` enum('generated','imported','stale') NOT NULL DEFAULT 'generated',
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nodeStatuses_kitId_nodeType_unique` (`campaignKitId`, `nodeType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Create chatTranscripts table (persisted chat messages per kit)
CREATE TABLE `chatTranscripts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaignKitId` int NOT NULL,
  `messages` json NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `chatTranscripts_kitId_unique` (`campaignKitId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
