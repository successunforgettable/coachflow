-- 0100 — publish-path provenance: which gated adCopy rows produced an ad (travels ALONE)
--
-- Adds THREE nullable columns:
--   adCreatives.headlineAdCopyId       INT NULL   -- the gated headline baked on the picture
--   meta_published_ads.headlineAdCopyId INT NULL  -- the gated headline that shipped
--   meta_published_ads.bodyAdCopyId     INT NULL  -- the gated body that shipped
--
-- WHY THIS EXISTS. Traced 2026-08-09: on the live V2 publish path the Meta headline field
-- was `selectedCreative.headline` — a side-generation inside the image engine carrying no
-- P.D.A.F. axes and never passing the distinctness gate — and the primary text was the
-- LANDING PAGE's subheadline (`deriveDefaultBody`). Of Meta's three fused surfaces, only the
-- baked image hook was gated. The whole copy engine governed a pool that never shipped.
--
-- Step 1 reroutes both surfaces to the gated pool. These columns are how that becomes
-- CHECKABLE rather than asserted: after any publish, the row says which adCopy ids produced
-- it, and a NULL says the legacy path did — which is itself the signal worth having.
--
-- It also closes the traceability gap recorded at CHECKPOINT §8c, where `adSetId` on a
-- published row is written as the literal string "temp" and links back to nothing.
--
-- ⚠️ ADDITIVE AND INERT, exactly like 0097, 0098 and 0099. Three new nullable columns change
-- no existing row and no existing read; every current row carries NULL.
--
-- ⚠️ NOT APPLIED. Written alongside the step-1 build so the code and its schema travel
-- together for review, but applying it is an ALTER TABLE and needs Arfeen's explicit
-- go-ahead in the immediately preceding message (CLAUDE.md §10 — schema-only is NOT an
-- exception). The payload-level proof does NOT require it: the proof constructs the outgoing
-- payload and never writes a published row.
--
-- ⚠️ MIGRATIONS TRAVEL ALONE (CLAUDE.md §5.6). This file is the whole change.
--
-- REVERSIBILITY. Dropping these loses only the provenance links; it destroys no ad and no
-- copy:
--   ALTER TABLE `adCreatives` DROP COLUMN `headlineAdCopyId`;
--   ALTER TABLE `meta_published_ads` DROP COLUMN `headlineAdCopyId`, DROP COLUMN `bodyAdCopyId`;
--
-- IDEMPOTENCE. MySQL has no "ADD COLUMN IF NOT EXISTS". Re-running errors with
-- ER_DUP_FIELDNAME (1060), which is safe — it means the column is already present.
--
-- Verify AFTER applying:
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
--     FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND (TABLE_NAME = 'adCreatives'        AND COLUMN_NAME = 'headlineAdCopyId')
--       OR (TABLE_NAME = 'meta_published_ads' AND COLUMN_NAME IN ('headlineAdCopyId','bodyAdCopyId'));
--   -- expect: 3 rows, all int, all YES

ALTER TABLE `adCreatives`
  ADD COLUMN `headlineAdCopyId` INT NULL AFTER `sourceImageUrl`;

ALTER TABLE `meta_published_ads`
  ADD COLUMN `headlineAdCopyId` INT NULL AFTER `dailyBudget`,
  ADD COLUMN `bodyAdCopyId` INT NULL AFTER `headlineAdCopyId`;
