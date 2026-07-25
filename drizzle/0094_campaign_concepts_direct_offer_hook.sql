-- Migration 0094 — add the 7th hook pattern `direct_offer_urgency` to campaignConcepts.hookPattern.
-- The Most-Aware close (a REAL coach-supplied deadline/offer, never fabricated scarcity). Its generated copy
-- is screened by the existing complianceFilter guards (screenConceptCompliance) — this migration is the DB
-- half only.
--
-- ENUM-WIDENING DECISION: the value is APPENDED to the end of the existing enum. MySQL treats an
-- append-to-end enum change as metadata-only (existing rows keep their integer index; no row rewrite),
-- and campaignConcepts is currently EMPTY on prod (0 rows, verified this session) — so this is a safe,
-- near-instant, additive ALTER on the existing 0093 table. NOT a new table.
--
-- ⚠️ PROD-WRITE GATE: apply to prod ONLY on Arfeen's explicit "execute" — NOT applied autonomously.
ALTER TABLE `campaignConcepts` MODIFY COLUMN `hookPattern`
  enum('problem_first','founder_authenticity','social_proof','aspirational_transformation','meme_humor','data_chart','direct_offer_urgency') NOT NULL;
