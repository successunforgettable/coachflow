-- 0101 — adCopy rows record the CONCEPT they came from (travels ALONE)
--
-- Adds ONE nullable column, one foreign key and one index:
--   adCopy.conceptId INT NULL  →  campaignConcepts(id)  ON DELETE SET NULL
--
-- WHY THIS EXISTS. Step 4 pairs an ad's four surfaces — image, hook, headline, body — so
-- they all descend from ONE persona/desire/awareness concept and are internally coherent.
-- That pairing must join on an INTEGER, never on matching desire or awareness text:
--
--   · two concepts can share an awareness stage, so awareness alone cannot identify one;
--   · `desire` is long free text that generation may lightly rephrase, so string equality
--     is not reliable and string SIMILARITY is a guess;
--   · a silent mispair produces a plausible-looking ad that is internally incoherent, with
--     nothing anywhere to detect it. An integer join either matches or it does not.
--
-- ⚠️ THE COLUMN IS THE SMALL HALF. Before this, the concept's identity was DESTROYED in the
-- pipeline: `adCopyGenerator` selected only `desire` and then de-duplicated by that string,
-- so two concepts sharing a desire collapsed into one entry and the row id never travelled
-- at all. The plumbing change that carries the concept RECORD is what makes this column
-- meaningful; the column on its own would only ever be NULL.
--
-- ⚠️ AWARENESS IS DELIBERATELY UNCHANGED BY THIS MIGRATION. A piece's desire comes from a
-- concept while its awareness still comes from the cold-weighted `awarenessPlanForCount`
-- allocation, so a stamped row is truthful about WHICH CONCEPT SUPPLIED ITS DESIRE and
-- nothing more. Making awareness concept-derived too is a separate, deliberate change with
-- its own live re-proof, because it moves the deck's stage mix and the per-surface gate
-- results were measured under cold weighting.
--
-- ON DELETE SET NULL, matching the existing `serviceId` pattern on this table. Every proof
-- run in this chapter tears its concepts down, and a dangling id pointing at a deleted
-- concept would be worse than an honest NULL.
--
-- ⚠️ ADDITIVE AND INERT, like 0097 / 0098 / 0099 / 0100. A new nullable column changes no
-- existing row and no existing read; all 5424 current rows simply carry NULL, which
-- assembly must read as "not concept-keyed" and never as a default concept.
--
-- ⚠️ MIGRATIONS TRAVEL ALONE (CLAUDE.md §5.6). This file is the whole change.
--
-- REVERSIBILITY:
--   ALTER TABLE `adCopy` DROP FOREIGN KEY `adCopy_conceptId_campaignConcepts_id_fk`;
--   DROP INDEX `idx_adCopy_conceptId` ON `adCopy`;
--   ALTER TABLE `adCopy` DROP COLUMN `conceptId`;
--
-- IDEMPOTENCE. Re-running errors with ER_DUP_FIELDNAME (1060) / ER_DUP_KEYNAME (1061),
-- which is safe — it means the change is already present.
--
-- Verify AFTER applying:
--   SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='adCopy' AND COLUMN_NAME='conceptId';
--   SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='adCopy' AND COLUMN_NAME='conceptId';
--   -- expect: int / YES, and one FK to campaignConcepts

ALTER TABLE `adCopy`
  ADD COLUMN `conceptId` INT NULL AFTER `format`;

CREATE INDEX `idx_adCopy_conceptId` ON `adCopy` (`conceptId`);

ALTER TABLE `adCopy`
  ADD CONSTRAINT `adCopy_conceptId_campaignConcepts_id_fk`
  FOREIGN KEY (`conceptId`) REFERENCES `campaignConcepts`(`id`) ON DELETE SET NULL;
