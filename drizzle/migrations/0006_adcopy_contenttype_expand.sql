-- W5 Phase 2 R2 — expand complianceRewrites.contentType to cover the ad copy
-- sub-types ('body', 'link') so Phase 2 INSERTs of flagged bodies and links
-- stop failing with "Data truncated for column 'contentType'".
--
-- Root cause: adCopy.contentType and complianceRewrites.contentType share a
-- column name but were designed with different semantics —
--   adCopy.contentType              = 'headline' | 'body' | 'link'
--     (sub-type within Node 7 — which ad copy fragment this row is)
--   complianceRewrites.contentType  = 'headline' | 'adCopy' | 'landingPage'
--     (source surface — which generator node produced the rewrite target)
-- Phase 2 code writes row.contentType verbatim into complianceRewrites, so
-- 'body' and 'link' rows hit the enum wall. Every one of those INSERTs has
-- been failing at the DB layer, which is why the table currently holds
-- zero 'body' or 'link' rows — no corrupt data to clean up.
--
-- Fix: append 'body' and 'link' at the END of the enum. MySQL / TiDB store
-- enum values as 1-based integer offsets into the declared list, so
-- appending is non-breaking:
--   'headline'     → index 1 (unchanged)
--   'adCopy'       → index 2 (unchanged)
--   'landingPage'  → index 3 (unchanged)
--   'body'         → index 4 (new)
--   'link'         → index 5 (new)
-- Inserting new values in the MIDDLE would re-index existing rows and
-- silently corrupt the stored data. Appending is the safe path.
--
-- Apply anytime; no data migration, no downtime — this rewrites enum
-- metadata only. Post-migration, complianceRewrites.contentType encodes
-- "what kind of text fragment was rewritten" (complementary to sourceTable
-- which encodes "which node produced it"). Phase 3 landing page regions
-- (hero / cta / body / testimonial / faq) can use the same 'body' value
-- or append further members when that phase lands.

ALTER TABLE `complianceRewrites`
  MODIFY COLUMN `contentType`
  ENUM('headline', 'adCopy', 'landingPage', 'body', 'link') NOT NULL;
