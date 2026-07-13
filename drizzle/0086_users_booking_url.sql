-- Per-coach booking URL — additive nullable column on `users`.
--
-- HOLD: prod DDL on the users table. Do NOT apply until Arfeen gives an explicit
-- "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate).
--
-- Adds ONE nullable column. Backward-compatible: existing rows get NULL; no existing
-- query references it (it is read out-of-band via server/lib/coachBookingUrl.ts, not the
-- Drizzle `users` schema, precisely so this migration can be applied independently of the
-- code deploy without breaking `select().from(users)` — see that file's header).
--
-- Fills the discovery landing-page "Book a Discovery Call" CTA destination AND the
-- pre-existing email/whatsapp [INSERT_BOOKING_URL] fallback gap (one per-coach source).
-- Operator-captured, never fabricated; when NULL the coach's discovery page stages as a
-- review-draft instead of publishing a dead booking button.
--
-- snake_case column name matches the coach_name / coach_background / coach_gender convention.

ALTER TABLE `users`
  ADD COLUMN `booking_url` VARCHAR(500) NULL;
