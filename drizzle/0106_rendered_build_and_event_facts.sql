-- 0106 — the renderer stamp, and the event facts we already hold.
--
-- 🔴 NOT APPLIED. 0097-0105 are applied to production; THIS ONE IS NOT, and applying it needs
-- Arfeen's explicit word. A file under drizzle/ is not an applied migration.
--
-- ⚠️ SAME DEPLOY-ORDERING CONSTRAINT AS 0105, FOR THE SAME REASON. `landingPages` and `hvcoTitles`
-- are both read with bare `db.select()` calls, and a bare select emits every column declared in
-- schema.ts. Ship the matching schema without this migration and those queries fail with
-- ERROR 1054 Unknown column — across the board, not only on the new paths. THE MIGRATION LEADS
-- THE DEPLOY. (0105 proved this the hard way: the failure was reproduced in rehearsal before it
-- could happen live.)
--
-- ⚠️ TWO STATEMENTS ADDING FIVE COLUMNS, AND MySQL DDL IS NOT TRANSACTIONAL — 0105's lesson
-- applied. Read the count carefully, because this header is what you will be reading while
-- recovering a half-applied migration: it is exactly TWO `ALTER TABLE` statements —
--   1. `landingPages`  ADD renderedBuild, eventDate, eventTime, eventTimezone   (4 columns)
--   2. `hvcoTitles`    ADD renderedBuild                                        (1 column)
-- The ADD COLUMNs are grouped into ONE ALTER PER TABLE to keep the statement count as low as
-- possible, so the only half-applied state reachable is "table 1 done, table 2 not" (or the
-- reverse). There is NO FOREIGN KEY here, so the table rebuild revalidates nothing and the orphan
-- class that could abort 0105 partway cannot arise. Verify each column after applying; see the
-- block at the end.
--
-- (Corrected 2026-08-28: this line read "FOUR STATEMENTS", which counted the ADD COLUMNs rather
-- than the statements and contradicted "ONE ALTER PER TABLE" three lines below it. Harmless on a
-- clean apply; misleading in exactly the situation the header exists for.)
--
-- ── WHY renderedBuild ─────────────────────────────────────────────────────────────────────────
-- A published page's HTML is BAKED INTO CLOUDFLARE KV at publish and never re-rendered until
-- something republishes it. The renderer keeps moving. Nothing recorded which build baked which
-- page, so the gap was invisible — and it is real: republishing magnet 5686 on 2026-08-28 grew the
-- deliverable 17,152 -> 21,310 bytes and converted <pre> blocks to structured markdown, all of it
-- from 10582b9, which had deployed long before. The page had simply been frozen since before it.
--
-- With the stamp, "how stale is production" is one query:
--   SELECT renderedBuild, COUNT(*) FROM landingPages WHERE publicUrl IS NOT NULL GROUP BY 1;
-- NULL is the honest value for every existing row: unknown age. There is no backfill because
-- there is nothing true to backfill with.
--
-- ── WHY THE EVENT FACTS ───────────────────────────────────────────────────────────────────────
-- The coach supplies date, time and timezone at intake; today they survive only as text
-- SUBSTITUTED INTO the page's HTML, so nothing can read them back. Recording the fact we already
-- hold costs nothing now and saves a second migration when the expiry decision lands — a page
-- advertising a date that has passed is worse than no page, and any degraded state will need to
-- READ the date, not grep it out of markup.
--
-- Stored as varchar, deliberately: these are the coach's own words ("March 14th", "2pm", "GMT"),
-- and parsing them into DATE/TIME here would invent a normalisation nobody has designed. The
-- expiry decision can normalise when it is taken.
--
-- All columns additive and NULLABLE with NO BACKFILL, so every existing row stays valid and every
-- read path behaves exactly as it does today.

ALTER TABLE `landingPages`
  ADD COLUMN `renderedBuild` varchar(40) NULL,
  ADD COLUMN `eventDate` varchar(64) NULL,
  ADD COLUMN `eventTime` varchar(64) NULL,
  ADD COLUMN `eventTimezone` varchar(64) NULL;

ALTER TABLE `hvcoTitles`
  ADD COLUMN `renderedBuild` varchar(40) NULL;

-- ── VERIFY AFTER APPLYING — five columns across two tables ────────────────────────────────────
--   SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
--     FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND (   (TABLE_NAME = 'landingPages'
--               AND COLUMN_NAME IN ('renderedBuild','eventDate','eventTime','eventTimezone'))
--           OR (TABLE_NAME = 'hvcoTitles' AND COLUMN_NAME = 'renderedBuild'))
--    ORDER BY TABLE_NAME, COLUMN_NAME;
--   -- expect 5 rows, every one IS_NULLABLE = YES
--
--   SELECT COUNT(*) AS total, SUM(renderedBuild IS NOT NULL) AS stamped FROM landingPages;
--   -- expect stamped = 0 (no backfill)
--
-- IF ONLY ONE ALTER LANDED: do NOT re-run the file — the landed one fails on Duplicate column
-- name. Run the missing ALTER alone.
