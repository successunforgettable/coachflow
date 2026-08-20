-- Migration 0104 — the coach's REAL method, and the confidence tag that travels with it.
--
-- TRAVELS ALONE (architectural invariant 6). No UI, no generator change in this commit.
-- Both statements are additive: a new table, and two nullable columns on heroMechanisms.
-- Nothing existing is altered or dropped, so this is safe to apply ahead of the code that
-- reads it — every reader treats absence as "no method captured yet".
--
-- WHY A TABLE AND NOT COLUMNS ON `services`:
-- the method belongs to the COACH and outlives any one campaign. Captured once in a guided
-- chat, it is reused by every later campaign and by every Auto Mode run for that service —
-- which is the whole point of capturing it. `serviceId` is nullable so a coach who describes
-- how they work in general gets one row that serves all their services.

CREATE TABLE `coachMethods` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  -- NULL = the coach's general method, applies to every service they own.
  `serviceId` INT NULL,

  -- The distilled method. `steps` is the ordered spine: [{name, whatHappens}], 2-5 entries.
  `steps` JSON NOT NULL,
  -- {kind: 'sequence'|'isolation'|'synthesis'|'none', description: string}. NULL until known.
  `operationalTwist` JSON NULL,

  -- Georgi's two halves. UMP = why the old vehicle structurally fails. UMS = the countermeasure.
  `ump` TEXT NULL,
  `ums` TEXT NULL,
  -- What the client was doing before — the old vehicle the blame shifts onto.
  `oldVehicle` TEXT NULL,
  -- Optional, from the skippable "what do you do differently" beat.
  `differentiator` TEXT NULL,

  -- THREE-TIER SOURCING. This is the honesty record: it says where the method came from.
  --   coach_stated    — distilled from a guided conversation with the coach
  --   extracted       — mined from material the coach already supplied (Auto Mode)
  --   guarded_fallback— genuinely nothing to work from; invented under the fallback guardrails
  `sourceTier` ENUM('coach_stated','extracted','guarded_fallback') NOT NULL,
  `confidence` ENUM('high','medium','low') NOT NULL DEFAULT 'low',

  -- Verbatim fragments the extractor grounded each step on. Real-or-empty, never paraphrased:
  -- this is what makes a later "is this actually what you said?" check possible.
  `evidence` JSON NULL,
  -- Provenance: the labelled raw material the extractor was fed. Lets a distillation be
  -- re-run or audited without re-interviewing the coach.
  `rawMaterial` JSON NULL,

  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  -- One method per (coach, service). A re-run of the guided chat UPDATEs in place rather than
  -- accumulating rows, so there is never ambiguity about which method is current.
  UNIQUE KEY `coachMethods_user_service_unique` (`userId`, `serviceId`),
  KEY `idx_coachMethods_userId` (`userId`),
  CONSTRAINT `fk_coachMethods_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- The confidence tag travels onto every mechanism generated from the method, so a mechanism
-- can always be traced back to whether a human actually said any of it.
-- Nullable: every one of the 1,095 existing rows predates this and stays valid.
ALTER TABLE `heroMechanisms`
  ADD COLUMN `sourceTier` ENUM('coach_stated','extracted','guarded_fallback') NULL,
  ADD COLUMN `coachMethodId` INT NULL;

ALTER TABLE `heroMechanisms`
  ADD KEY `idx_heroMechanisms_coachMethodId` (`coachMethodId`);
