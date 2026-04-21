-- Creates the complianceRewrites table used by the W5 Compliance Rewrite
-- Engine (Phase 1 — headlines; Phases 2-4 extend to ad copy and landing pages).
--
-- Behind ENABLE_COMPLIANCE_REWRITES env flag. When flag is false (production
-- default during development), no rows are ever inserted and the feature is
-- invisible to users — so applying this migration is safe even before flipping
-- the flag.
--
-- Indexed on (userId, sourceTable, sourceId) for the O(1) fetch-by-item path
-- used by getForItem when the panel expands on a flagged card.

CREATE TABLE `complianceRewrites` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `contentType` enum('headline','adCopy','landingPage') NOT NULL,
  `sourceTable` varchar(64) NOT NULL,
  `sourceId` int NOT NULL,
  `originalText` text NOT NULL,
  `rewrittenText` text NOT NULL,
  `violationReasons` json NOT NULL,
  `complianceScore` int NOT NULL,
  `userAccepted` boolean NOT NULL DEFAULT false,
  `userDismissed` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `complianceRewrites_id_pk` PRIMARY KEY(`id`),
  CONSTRAINT `complianceRewrites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `complianceRewrites_source_idx` (`userId`, `sourceTable`, `sourceId`)
);
