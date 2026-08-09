-- 0102 — adCreatives rows record the CONCEPT whose headline the picture bakes (travels ALONE)
--
-- Adds ONE nullable column, one foreign key and one index:
--   adCreatives.conceptId INT NULL  →  campaignConcepts(id)  ON DELETE SET NULL
--
-- The image-side mirror of 0101. Step 4 pairs an ad's four surfaces — image, hook, headline,
-- body — so they all descend from ONE concept. That pairing joins on an INTEGER, never on
-- matching desire or awareness text: two concepts can share an awareness stage, `desire` is
-- long free text a generator may rephrase, and a silent mispair produces a plausible-looking
-- ad that is internally incoherent with nothing anywhere to detect it.
--
-- ⚠️ WHAT THE COLUMN MEANS, AND ITS HONEST LIMIT. It records THE CONCEPT WHOSE HEADLINE THIS
-- PICTURE BAKES — the gated `adCopy` row named by `headlineAdCopyId`, and that row's concept.
-- It does NOT mean the picture as a whole descends from that concept:
--
--   · the rendered SCENE still follows `awarenessDeckPlan` (four distinct stages, coldest
--     first), which is its own allocation and is not concept-sourced. A creative stamped with
--     a product_aware concept can therefore depict a solution_aware scene.
--   · the on-picture HOOK line comes from a separate `image_hook` adCopy row chosen
--     independently (`resolveAdBodyTexts`, ORDER BY id DESC), whose identity is discarded. Its
--     concept may differ from this one.
--
-- So the column is truthful about where the picture's WORDS came from and nothing more.
-- Anything that needs "the whole picture descends from concept X" must establish that
-- separately — it is not what this records.
--
-- ⚠️ IMAGE AWARENESS IS DELIBERATELY UNCHANGED BY THIS MIGRATION, for the same reason 0101
-- left copy awareness alone. `awarenessDeckPlan` is not a label: `subTypePlanFor` and
-- `visibilityTierPlanFor` are both DERIVED from it, so moving its source changes what is
-- rendered in three coupled ways. At four slots it would also break the guarantee that
-- function exists to provide — the first four concepts of a SHORT set repeat a stage, and a
-- repeated (awareness × sub-type) cell is a repeated Entity ID. Both concept sets measured
-- live so far were short. That switch belongs after the 4 → 8 cardinality decision.
--
-- ⚠️ ONLY THE TABLOID CASCADE STAMPS. The editorial path and the two router insert sites
-- write NULL, because a creative those paths produce genuinely did not descend from a
-- concept — they are three of the five unwired fan-out sites — and stamping one would be a
-- lie. NULL here means "not concept-keyed", never a default concept.
--
-- ON DELETE SET NULL, matching `serviceId`/`campaignId` on this table and `conceptId` on
-- adCopy. A deleted concept must NOT take a rendered row with it: the three Cloudinary
-- objects would still exist and their URLs are unrecoverable once the row is gone.
--
-- ⚠️ TEARDOWN ORDER, WHICH THIS MIGRATION CHANGES. Creatives must be torn down BEFORE their
-- concepts or the FK blanks every stamp first — and adCreatives teardown must clear Cloudinary
-- before the rows go, since the URLs live only on the row. The full order is therefore:
--   read the three Cloudinary ids → delete the objects → delete adCreatives → delete adCopy
--   → delete campaignConcepts.
-- `server/lib/adCreativeTeardown.ts` already does the first three steps in that order.
--
-- ⚠️ ADDITIVE AND INERT, like 0097 / 0098 / 0099 / 0100 / 0101. A new nullable column changes
-- no existing row and no existing read; all 405 current rows simply carry NULL. NO BACKFILL —
-- those rows predate concepts on this path and NULL is the truthful value for them.
--
-- ⚠️ MIGRATIONS TRAVEL ALONE (CLAUDE.md §5.6). This file is the whole change.
--
-- REVERSIBILITY:
--   ALTER TABLE `adCreatives` DROP FOREIGN KEY `adCreatives_conceptId_campaignConcepts_id_fk`;
--   DROP INDEX `idx_adCreatives_conceptId` ON `adCreatives`;
--   ALTER TABLE `adCreatives` DROP COLUMN `conceptId`;
--
-- IDEMPOTENCE. Re-running errors with ER_DUP_FIELDNAME (1060) / ER_DUP_KEYNAME (1061), which
-- is safe — it means the change is already present.
--
-- Verify AFTER applying:
--   SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='adCreatives' AND COLUMN_NAME='conceptId';
--   SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='adCreatives' AND COLUMN_NAME='conceptId';
--   SELECT COUNT(*) total, COUNT(conceptId) stamped FROM adCreatives;
--   -- expect: int / YES, one FK to campaignConcepts, and 405 / 0

ALTER TABLE `adCreatives`
  ADD COLUMN `conceptId` INT NULL AFTER `headlineAdCopyId`;

CREATE INDEX `idx_adCreatives_conceptId` ON `adCreatives` (`conceptId`);

ALTER TABLE `adCreatives`
  ADD CONSTRAINT `adCreatives_conceptId_campaignConcepts_id_fk`
  FOREIGN KEY (`conceptId`) REFERENCES `campaignConcepts`(`id`) ON DELETE SET NULL;
