-- Migration 0095 — conceptScripts table (Andromeda per-concept video SCRIPT; a coach records it himself).
-- One script per campaignConcepts row, written to that concept's persona/desire/awareness/hookPattern.
-- NEW table (NOT videoScripts) — keyed on conceptId, and deliberately decoupled from the videoScripts
-- credit-render economy (renderVideoFromScript charges credits by duration; Andromeda scripts must never
-- accidentally hit it). Scenes are human-presenter fields (spokenLine/onScreenText/deliveryNote), no
-- render/pexels fields. Additive, zero risk. DRAFT-only — nothing reaches Meta until publishToMeta.
-- Applied via direct mysql (no drizzle-kit statement-breakpoints); each statement stands alone.
-- ⚠️ PROD-WRITE GATE: apply to prod ONLY on Arfeen's explicit "execute" — NOT applied autonomously.
CREATE TABLE `conceptScripts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `conceptId` int NOT NULL,
  `icpId` int,
  `serviceId` int,
  `campaignId` int,
  `scriptSetId` varchar(191) NOT NULL,
  `awareness` enum('unaware','problem_aware','solution_aware','product_aware','most_aware') NOT NULL,
  `hookPattern` enum('problem_first','founder_authenticity','social_proof','aspirational_transformation','meme_humor','data_chart','direct_offer_urgency') NOT NULL,
  `targetLengthSeconds` int NOT NULL,
  `scenes` json NOT NULL,
  `teleprompter` text NOT NULL,
  `status` enum('draft','selected','dismissed') NOT NULL DEFAULT 'draft',
  `source` enum('generated','imported') NOT NULL DEFAULT 'generated',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `conceptScripts_id` PRIMARY KEY(`id`)
);
ALTER TABLE `conceptScripts` ADD CONSTRAINT `conceptScripts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `conceptScripts` ADD CONSTRAINT `conceptScripts_conceptId_campaignConcepts_id_fk` FOREIGN KEY (`conceptId`) REFERENCES `campaignConcepts`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `idx_conceptScripts_userId` ON `conceptScripts` (`userId`);
CREATE INDEX `idx_conceptScripts_conceptId` ON `conceptScripts` (`conceptId`);
CREATE INDEX `idx_conceptScripts_set` ON `conceptScripts` (`scriptSetId`);
