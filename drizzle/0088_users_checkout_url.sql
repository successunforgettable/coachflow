-- Per-coach external checkout URL — additive nullable column on `users`.
--
-- HOLD: prod DDL on the users table. Do NOT apply until Arfeen gives an explicit
-- "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate). This is a
-- SEPARATE gated apply from the sales template code deploy (migrations isolated — §6).
--
-- Adds ONE nullable column. Backward-compatible: existing rows get NULL; no existing
-- query references it — it is read out-of-band via server/lib/coachCheckoutUrl.ts (a guarded
-- raw query), NOT the Drizzle `users` schema, precisely so this migration can be applied
-- independently of the code deploy without breaking `select().from(users)` on the auth hot
-- path. Mirrors exactly how 0086 (booking_url) and 0087 (video_url) were staged.
--
-- Powers the sales template's CTA with the coach's REAL external checkout/enrolment link
-- (ZAP has no payment integration). When NULL, the sales CTA reveals an on-page email capture
-- (/api/capture-lead sales mode) so a prospect always has a next step — never a dead button.
-- Operator-captured (via the forthcoming conversational operator-intake), never invented.
--
-- snake_case column name matches the coach_name / booking_url / video_url convention.
--
-- Post-apply follow-up (safe once the column exists): promote to a typed `users.checkoutUrl`
-- Drizzle column and drop the guarded reader (mirrors the booking_url / video_url promotions).

ALTER TABLE `users`
  ADD COLUMN `checkout_url` VARCHAR(500) NULL;
