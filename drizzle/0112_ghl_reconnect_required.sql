-- 0112 — GHL connection: record that a renewal was REJECTED, so the coach is asked to reconnect
--        (travels ALONE — architectural invariant 6)
--
-- Adds TWO nullable columns to `ghl_access_tokens`. Alters nothing else. Backfills nothing.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- ZAP stored GHL's renewal key but never used it, so every connection died about a day after it was made
-- (GHL_DELIVERY_RELIABILITY_PROPOSAL_2026-09-24 §A). Renewal now runs on read. When GHL REJECTS the key
-- (a 4xx on the token endpoint, or no key stored), the connection cannot recover without the coach, and
-- that has to be recorded somewhere the Settings page and the push window can read — otherwise it is a
-- silent failure. GHL being down (5xx / network) records NOTHING: that is transient.
--
--   reconnectRequiredAt  set when a renewal is rejected; NULL = no known problem. A fresh connection
--                        (the OAuth callback's delete-then-insert) leaves it NULL.
--   lastRenewalError     GHL's status + message from that rejection, for diagnosis. Never shown raw.
--
-- ── ORDER ───────────────────────────────────────────────────────────────────────────────────
-- The code that reads these columns MUST NOT be deployed before this migration is applied: the schema
-- names them, so every read of ghl_access_tokens would fail with "Unknown column".
-- NOT APPLIED. Applying it to production needs Arfeen's explicit go-ahead.

ALTER TABLE `ghl_access_tokens`
  ADD COLUMN `reconnectRequiredAt` TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN `lastRenewalError` VARCHAR(512) NULL DEFAULT NULL;
