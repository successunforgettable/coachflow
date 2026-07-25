-- Migration 0093 — campaignConcepts table (Andromeda per-concept fan-out source; EXECUTION_BRIEF §2/§8).
-- "One person, many angles": N concepts vary Desire × Awareness WITHIN one ICP (persona fixed to the ICP).
-- Distinct from icp_angle_suggestions (per-service, pre-ICP onboarding persona-picker). Each row carries the
-- ad-copy payload {hook, headline, shortText, longText} read downstream by ad copy, the video-script generator,
-- and the LP hook variant. awareness = Schwartz 5-stage enum; hookPattern = the 6 named patterns. Additive,
-- zero risk to onboarding. DRAFT-only — nothing here reaches Meta until the separate publishToMeta action.
-- Applied via direct mysql (no drizzle-kit statement-breakpoints); each statement stands alone.
-- ⚠️ PROD-WRITE GATE: apply to prod ONLY on Arfeen's explicit "execute" — NOT applied autonomously.
CREATE TABLE `campaignConcepts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `icpId` int NOT NULL,
  `serviceId` int,
  `campaignId` int,
  `conceptSetId` varchar(191) NOT NULL,
  `personaLabel` varchar(255),
  `desire` text NOT NULL,
  `awareness` enum('unaware','problem_aware','solution_aware','product_aware','most_aware') NOT NULL,
  `hookPattern` enum('problem_first','founder_authenticity','social_proof','aspirational_transformation','meme_humor','data_chart') NOT NULL,
  `hook` text NOT NULL,
  `headline` text NOT NULL,
  `shortText` text NOT NULL,
  `longText` text NOT NULL,
  `status` enum('draft','selected','dismissed') NOT NULL DEFAULT 'draft',
  `rating` int DEFAULT 0,
  `source` enum('generated','imported') NOT NULL DEFAULT 'generated',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `campaignConcepts_id` PRIMARY KEY(`id`)
);
ALTER TABLE `campaignConcepts` ADD CONSTRAINT `campaignConcepts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `campaignConcepts` ADD CONSTRAINT `campaignConcepts_icpId_icp_id_fk` FOREIGN KEY (`icpId`) REFERENCES `idealCustomerProfiles`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `idx_campaignConcepts_userId` ON `campaignConcepts` (`userId`);
CREATE INDEX `idx_campaignConcepts_icpId` ON `campaignConcepts` (`icpId`);
CREATE INDEX `idx_campaignConcepts_set` ON `campaignConcepts` (`conceptSetId`);
