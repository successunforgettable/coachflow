-- Lead-Magnet Delivery sprint. Two additive changes, nothing destructive:
--   1. Two nullable URL columns on hvcoTitles for the published deliverable
--      (branded hosted HTML page + PDF). Sparse — same population rule as
--      assetBody (only the selected title of a lead_magnet_download campaign).
--   2. New capturedLeads table: ZAP-owned opt-in capture. PII is encrypted at
--      rest (emailEncrypted/nameEncrypted); emailHash/ipHash are one-way. FK to
--      users is ON DELETE CASCADE so deleting a customer purges their leads;
--      retention is bounded by purgeAfter (24-month reaper). submissionData +
--      resultBand are quiz forward-compat (built now; quiz ships next sprint
--      with no re-migration) — NULL for the three static formats.
--
-- Additive only: the ALTERs add NULLable columns (zero backfill); the CREATE is a
-- brand-new table. No existing row is touched.

ALTER TABLE `hvcoTitles` ADD COLUMN `magnetHtmlUrl` VARCHAR(500) NULL;
ALTER TABLE `hvcoTitles` ADD COLUMN `magnetPdfUrl` VARCHAR(500) NULL;

CREATE TABLE `capturedLeads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `serviceId` INT NULL,
  `campaignId` INT NULL,
  `hvcoId` INT NULL,
  `emailEncrypted` VARCHAR(512) NOT NULL,
  `emailHash` VARCHAR(64) NOT NULL,
  `nameEncrypted` VARCHAR(512) NULL,
  `consentGiven` BOOLEAN NOT NULL DEFAULT false,
  `consentText` TEXT NULL,
  `privacyPolicyUrl` VARCHAR(500) NULL,
  `sourceSlug` VARCHAR(255) NULL,
  `ipHash` VARCHAR(64) NULL,
  `userAgent` VARCHAR(500) NULL,
  `magnetHtmlUrl` VARCHAR(500) NULL,
  `magnetPdfUrl` VARCHAR(500) NULL,
  `submissionData` JSON NULL,
  `resultBand` VARCHAR(120) NULL,
  `deliveredAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `purgeAfter` TIMESTAMP NULL,
  INDEX `idx_capturedLeads_userId` (`userId`),
  INDEX `idx_capturedLeads_purgeAfter` (`purgeAfter`),
  UNIQUE KEY `uq_capturedLeads_dedup` (`userId`, `emailHash`, `hvcoId`),
  CONSTRAINT `fk_capturedLeads_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_capturedLeads_service` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_capturedLeads_campaign` FOREIGN KEY (`campaignId`) REFERENCES `campaigns` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_capturedLeads_hvco` FOREIGN KEY (`hvcoId`) REFERENCES `hvcoTitles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
