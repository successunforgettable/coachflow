-- Image Slot System — Sprint A
-- HOLD: Do NOT apply until Arfeen gives explicit go-ahead.
-- This is a prod write on the coachAssets table.

-- 1. Add optional landingPageId FK for per-LP scoping.
--    NULL = per-user asset (headshot, logo, press_logo, social_proof).
--    Set = per-LP asset (hero_image).
--    Existing rows all have NULL — no data migration needed.
ALTER TABLE `coachAssets`
  ADD COLUMN `landingPageId` INT NULL AFTER `userId`;

ALTER TABLE `coachAssets`
  ADD INDEX `idx_coachAssets_landingPageId` (`landingPageId`);

ALTER TABLE `coachAssets`
  ADD CONSTRAINT `fk_coachAssets_landingPageId`
  FOREIGN KEY (`landingPageId`) REFERENCES `landingPages`(`id`)
  ON DELETE CASCADE;
