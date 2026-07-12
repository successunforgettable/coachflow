-- Lead-magnet Burchard template — additive publishedStyle enum value.
--
-- HOLD: prod DDL on the landingPages table. Do NOT apply until Arfeen gives an
-- explicit "execute" in the immediately-preceding message (CLAUDE.md §10 hard gate).
--
-- Adds ONLY 'lead_magnet_burchard' to the current prod enum ('text','visual').
-- Deliberately does NOT introduce 'executive'/'energetic'/'clinical'/'warm'/'bold'
-- (that is migration 0081, which is SUPERSEDED and must not be applied — applying it
-- would re-enable the old rejected stub-style design across every LP).
--
-- This lights up the bespoke Burchard lead-magnet template WITHOUT shipping the old
-- design. Other page types keep their current pre-existing behaviour (out of scope).

ALTER TABLE `landingPages`
  MODIFY COLUMN `publishedStyle`
  ENUM('text','visual','lead_magnet_burchard')
  DEFAULT 'text';
