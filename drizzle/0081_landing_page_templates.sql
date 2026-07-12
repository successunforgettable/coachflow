-- Landing Page Template System — Sprint 1
-- SUPERSEDED — DO NOT APPLY. The stub-style enum this adds
-- ('executive','energetic','clinical','warm','bold') would re-enable the OLD rejected
-- design across every LP. The template system is being rebuilt per-reference (bespoke
-- builders selected by pageType); publishedStyle values are added one-per-template.
-- The lead-magnet template uses migration 0084 (adds only 'lead_magnet_burchard').
-- Retained for history only.
--
-- HOLD: Do NOT apply until Arfeen gives explicit go-ahead.
-- This is a prod write on the landingPages table.

-- 1. Expand publishedStyle enum to include 5 template style IDs.
--    Existing "text" and "visual" values are preserved for backward
--    compatibility on already-published pages.
ALTER TABLE `landingPages`
  MODIFY COLUMN `publishedStyle`
  ENUM('text','visual','executive','energetic','clinical','warm','bold')
  DEFAULT 'text';

-- Note: guarantee and faq changes are to the JSON blob stored in the
-- angle columns (originalAngle, godfatherAngle, etc.), NOT to table
-- columns. No DDL needed for those — they are TypeScript type changes
-- that affect the generator output shape and renderer expectations.
-- The JSON columns accept any valid JSON regardless of the TS type.
