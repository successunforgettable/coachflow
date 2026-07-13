-- Landing-page templates 2–9 — additive publishedStyle enum values (one file, all 8).
--
-- HOLD: prod DDL on the landingPages table. Do NOT apply until Arfeen gives an
-- explicit "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate).
--
-- Adds the 8 per-reference template styleMode values (one per template 2–9, incl.
-- variants) ON TOP OF the current prod enum from migration 0084
-- ('text','visual','lead_magnet_burchard'). Batched into ONE file so the prod enum
-- is widened once, not eight times as templates land.
--
-- DELIBERATELY EXCLUDES 'executive'/'energetic'/'clinical'/'warm'/'bold' (same stance
-- as 0084): those legacy render-only styles must never persist as a published style —
-- re-adding them to prod would re-enable shipping the rejected energetic design across
-- non-lead-magnet LPs. They remain in the schema.ts TS enum only as a superset so the
-- legacy renderTemplate path type-checks; they are not a valid prod publishedStyle.
--
-- Adding an enum VALUE does not render anything: each value only takes effect once its
-- template builder is registered (server/lib/templates/renderRegistry.ts) and its
-- pageType routes to it. Until then, orchestration stages those page types as
-- review-drafts (styleForPageType → null), so this migration is inert on its own.
--
-- 0081 remains SUPERSEDED — do NOT apply it.

ALTER TABLE `landingPages`
  MODIFY COLUMN `publishedStyle`
  ENUM(
    'text',
    'visual',
    'lead_magnet_burchard',
    'discovery_burchard_performance',
    'webinar_rajsekar_coaching',
    'webinar_rajsekar_marketing',
    'event_iman_gadzhi',
    'event_hormozi',
    'sales_ali_abdaal',
    'sales_jenna_kutcher',
    'lead_magnet_jeff_walker'
  )
  DEFAULT 'text';
