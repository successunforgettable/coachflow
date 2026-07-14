-- Per-coach webinar/masterclass video URL — additive nullable column on `users`.
--
-- HOLD: prod DDL on the users table. Do NOT apply until Arfeen gives an explicit
-- "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate). This is a
-- SEPARATE gated apply from the webinar template code deploy (migrations isolated — §6).
--
-- Adds ONE nullable column. Backward-compatible: existing rows get NULL; no existing
-- query references it — it is read out-of-band via server/lib/coachVideoUrl.ts (a guarded
-- raw query), NOT the Drizzle `users` schema, precisely so this migration can be applied
-- independently of the code deploy without breaking `select().from(users)` on the auth hot
-- path. Mirrors exactly how 0086 (booking_url) was staged. See that file's header.
--
-- Powers the webinar template's hero media frame with the coach's REAL video (YouTube /
-- Vimeo / hosted). ZAP never fabricates or generates video; when NULL the webinar hero
-- falls back to the coach headshot with no fake play affordance, or omits the media.
-- Operator-captured (via the forthcoming conversational operator-intake), never invented.
--
-- snake_case column name matches the coach_name / coach_background / booking_url convention.

ALTER TABLE `users`
  ADD COLUMN `video_url` VARCHAR(500) NULL;
