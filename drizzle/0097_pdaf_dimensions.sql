-- 0097 — P.D.A.F. distinctness dimensions on the two copy tables (out-of-band)
--
-- Adds FOUR additive nullable columns to `headlines` and the same four to `adCopy`.
-- They record, per generated piece, the four axes the Andromeda copy research says
-- decide whether two ads are one Entity ID or two:
--
--   persona    — who the piece speaks to
--   desire     — the core pain/desire it is about
--   awareness  — the Schwartz stage it was written for
--   format     — the copy architecture it was written to
--
-- Source: docs/andromeda/copy-research/Andromeda_Copy_EntityID_Distinctness.md —
-- "any two copy variants must satisfy AT LEAST TWO of the four dimensions";
-- "If a copy pair differs in 0 or only 1 dimension, they will collapse under a
--  single Entity ID."
--
-- WHY COLUMNS AND NOT A LATER INFERENCE. The distinctness gate must compare the
-- dimensions ASSIGNED at generation time, never a score inferred from the finished
-- text. That is only possible if the assignment is recorded when it is made, which
-- is what these columns are for. The Phase 0 baseline had to recover the axes after
-- the fact precisely because they were never written down; that recovery is a
-- one-off measurement device and is not how the gate will work.
--
-- NAMING. `desire` and `awareness` deliberately match the existing live column names
-- on `campaignConcepts`, so the later persona/pain-widening phase can join the two
-- shapes without a rename. `persona` and `format` are the plain forms; the concept
-- table's nearest equivalents are `personaLabel` and `hookPattern`. Whether
-- hookPattern IS format, or merely correlates with it, is an open question for that
-- phase and is NOT assumed here.
--
-- FORMAT IS NOT A NEW LABEL. By build decision, `format` stores the formula or angle
-- the piece was already written to — `formulaType` for headlines, `bodyAngle` for ad
-- copy bodies. It is denormalised into a common column so one gate can read one axis
-- across both tables. No parallel taxonomy is introduced.
--
-- Safety:
--   * Additive, nullable, no default — existing rows are untouched and read NULL.
--   * No backfill. NULL == "generated before the axes were recorded".
--   * No index — the gate compares within a freshly generated batch held in memory,
--     never by querying on these columns.
--   * MySQL/TiDB: ADD COLUMN ... NULL is metadata-only.
--   * Inert on apply: no code reads or writes these columns until Node 6 ships.
--
-- Migration-before-code gate: apply this BEFORE deploying the code that writes it.
-- Verify after applying:
--   SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
--     FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_NAME IN ('headlines','adCopy')
--      AND COLUMN_NAME IN ('persona','desire','awareness','format')
--    ORDER BY TABLE_NAME, COLUMN_NAME;
--   SELECT COUNT(*) FROM headlines;  -- must equal the pre-apply count
--   SELECT COUNT(*) FROM adCopy;     -- must equal the pre-apply count

ALTER TABLE `headlines` ADD COLUMN `persona`   TEXT        NULL;
ALTER TABLE `headlines` ADD COLUMN `desire`    TEXT        NULL;
ALTER TABLE `headlines` ADD COLUMN `awareness` VARCHAR(32) NULL;
ALTER TABLE `headlines` ADD COLUMN `format`    VARCHAR(64) NULL;

ALTER TABLE `adCopy` ADD COLUMN `persona`   TEXT        NULL;
ALTER TABLE `adCopy` ADD COLUMN `desire`    TEXT        NULL;
ALTER TABLE `adCopy` ADD COLUMN `awareness` VARCHAR(32) NULL;
ALTER TABLE `adCopy` ADD COLUMN `format`    VARCHAR(64) NULL;
