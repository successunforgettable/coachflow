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

ALTER TABLE `hvcoTitles`
  ADD COLUMN `nextStepLandingPageId` int NULL;

ALTER TABLE `hvcoTitles`
  ADD CONSTRAINT `hvcoTitles_nextStepLandingPageId_landingPages_id_fk`
  FOREIGN KEY (`nextStepLandingPageId`) REFERENCES `landingPages`(`id`)
  ON DELETE SET NULL;
