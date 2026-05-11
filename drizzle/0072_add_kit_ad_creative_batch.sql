-- Phase C C1 (Sprint B+1 + Phase C, 2026-05-11): add selectedAdCreativeBatchId
-- pointer to campaignKits. The Auto Mode cascade's new step 9 (adCreatives)
-- produces a batchId (varchar(100), matches adCreatives.batchId shape) that
-- groups the 5 generated ad image variations.
--
-- Nullable so legacy kits (kit 11 / 13 / 14 / 15 etc. predating C1) keep
-- their existing status='complete' without retroactive incomplete flagging.
-- New Auto Mode runs after this migration get the column populated by
-- autoSelectBest's adCreatives wire.
--
-- PHASE C C1 PROD-APPLY GATE (per Phase 0 / Reaper Option α memory note —
-- DB schema phases require migration-applied-to-prod verification before
-- C1 is declared complete): Railway does not auto-run drizzle migrations
-- in this workstream. After this commit ships, the migration MUST be
-- applied manually against trolley.proxy.rlwy.net:14382 / railway DB before
-- the C1 cascade is probed end-to-end. Verification query:
--   SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
--   FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA='railway'
--     AND TABLE_NAME='campaignKits'
--     AND COLUMN_NAME='selectedAdCreativeBatchId';
-- Expected: COLUMN_TYPE='varchar(100)', IS_NULLABLE='YES'.

ALTER TABLE campaignKits
  ADD COLUMN selectedAdCreativeBatchId VARCHAR(100) NULL;
