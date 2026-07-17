-- Landing-page proof-LIGHT variants — additive publishedStyle enum values (sales + webinar).
--
-- HOLD: prod DDL on the landingPages table. Do NOT apply until Arfeen gives an
-- explicit "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate).
--
-- Adds the two proof-LIGHT styleMode values ON TOP OF the current prod enum (from 0085):
--   · 'webinar_rajsekar_light'  — the default webinar variant (teacher/value-forward)
--   · 'sales_ali_abdaal_light'  — the default sales variant (offer/method-forward)
--
-- WHY: the reference-faithful RICH sales/webinar pages need 6–30 real testimonials, but the cascade
-- hard-caps testimonials at 3 (services.testimonial1/2/3; the unlimited `testimonials` library table
-- is NOT wired into LP generation, and proofMetrics/caseStudies are never populated). So the rich
-- pages read sparse for every real coach today. The proof-LIGHT variants are properly-composed pages
-- for a coach with little/no proof and become the DEFAULT for sales_page + webinar_registration;
-- the rich variants stay dormant (pageType:null) and are upgraded to only when a coach has enough
-- real proof (resolveSalesStyle / resolveWebinarStyle, mirroring the event free-vs-paid discriminator).
--
-- Adding an enum VALUE does not render anything: the light variants are already wired in
-- renderRegistry.ts and become the auto-selected defaults the moment this widening is applied.
-- Until applied, a fresh publish of these page types would fail to persist the light styleMode
-- (enum truncation), so this migration must land before the light defaults go live in prod.
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
    'webinar_rajsekar_light',
    'webinar_rajsekar_marketing',
    'event_iman_gadzhi',
    'event_hormozi',
    'sales_ali_abdaal',
    'sales_ali_abdaal_light',
    'sales_jenna_kutcher',
    'lead_magnet_jeff_walker'
  )
  DEFAULT 'text';
