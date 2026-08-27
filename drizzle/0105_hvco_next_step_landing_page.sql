-- 0105 — the magnet's free-next-step destination, as an EXPLICIT pointer to a specific page.
--
-- 🔴 NOT APPLIED. Migrations 0097-0104 are applied to production; THIS ONE IS NOT, and applying it
-- needs Arfeen's explicit word. Committing a file under drizzle/ is not applying it.
--
-- ⚠️ HARD ORDERING CONSTRAINT — READ BEFORE THE NEXT PUSH. `hvcoTitles` is read with a bare
-- `db.select().from(hvcoTitles)` in 15 of its 22 call sites, and a bare select emits every column
-- declared in `drizzle/schema.ts`. The moment the matching schema column ships, those queries name
-- `nextStepLandingPageId` in their SQL — so against a database where this migration has NOT run
-- they fail with ERROR 1054 Unknown column. THIS MIGRATION MUST BE APPLIED BEFORE THE CODE
-- DEPLOYS, and a push to `railway-build` IS a deploy.
--
-- WHY A COLUMN ON hvcoTitles RATHER THAN ON campaignKits. A kit-level pointer would force
-- `publishLeadMagnet({hvcoId})` to hop serviceId -> first ICP for that service -> kit, and that
-- middle hop is a .limit(1) on a loose join: right when there is one ICP, silently wrong when there
-- are several. Here it is read off a row the publisher already holds, with no join. The pairing is
-- per-magnet because the free-event page answers the gap THAT magnet leaves behind — a content
-- decision, not a chronological one.
--
-- WHY ON DELETE SET NULL. This is a LIVE POINTER, not provenance. 0103's note records that SET NULL
-- is wrong for provenance because it erases the record of what was baked into an artefact that
-- still exists. The opposite holds here: if the page is deleted the magnet must drop to the honest
-- text card with no button, never point at a row that is gone.
--
-- Additive and nullable with NO BACKFILL, so every existing row stays valid and resolves exactly as
-- it does today — outcome "no-pointer", the tier-3 text card, which is the behaviour of 100% of
-- production rows right now.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THIS MIGRATION IS TWO STATEMENTS AND MySQL DDL IS NOT TRANSACTIONAL. A PARTIAL APPLICATION IS
--    POSSIBLE, AND IT WAS OBSERVED — NOT PREDICTED.
--
-- On the 2026-08-27 local rehearsal the second statement failed (the table rebuild revalidates
-- hvcoTitles' EXISTING userId FK, and the rehearsal copy had no `users` table). The first statement
-- had already committed. The result was the half-applied state: COLUMN CREATED, FOREIGN KEY MISSING
-- — and re-running the file then fails on `Duplicate column name 'nextStepLandingPageId'`, so the
-- obvious recovery is blocked too.
--
-- AFTER APPLYING, VERIFY BOTH LANDED. Neither alone is success:
--
--   SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
--     FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hvcoTitles'
--      AND COLUMN_NAME = 'nextStepLandingPageId';
--   -- expect exactly one row: int, IS_NULLABLE = YES
--
--   SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE, kcu.REFERENCED_TABLE_NAME
--     FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
--     JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
--       ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
--      AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
--    WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND kcu.TABLE_NAME = 'hvcoTitles'
--      AND kcu.COLUMN_NAME = 'nextStepLandingPageId';
--   -- expect exactly one row: DELETE_RULE = SET NULL, REFERENCED_TABLE_NAME = landingPages
--
-- IF ONLY THE COLUMN LANDED: do NOT re-run this file. Run the second ALTER on its own (the
-- ADD CONSTRAINT block below), having first fixed whatever made it fail. DO NOT PUSH THE CODE in
-- that state: the column is enough to stop ERROR 1054, so the application will run and look healthy
-- while a deleted landing page leaves a DANGLING pointer instead of being nulled — the exact silent
-- wrong-bridge failure this design exists to refuse.
--
-- IF ONLY THE CONSTRAINT LANDED: impossible — it references the column.
--
-- PRE-FLIGHT, because the rebuild revalidates hvcoTitles' three EXISTING foreign keys
-- (userId → users, serviceId → services, campaignId → campaigns) across all rows. A single orphan
-- aborts the ALTER partway. Measured read-only on production 2026-08-28: campaignId 0 non-null /
-- 0 orphans · serviceId 6,689 non-null / 0 orphans · userId 6,689 non-null / 0 orphans. Re-run that
-- count on the day rather than trusting this line.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE `hvcoTitles`
  ADD COLUMN `nextStepLandingPageId` int NULL;

ALTER TABLE `hvcoTitles`
  ADD CONSTRAINT `hvcoTitles_nextStepLandingPageId_landingPages_id_fk`
  FOREIGN KEY (`nextStepLandingPageId`) REFERENCES `landingPages`(`id`)
  ON DELETE SET NULL;
