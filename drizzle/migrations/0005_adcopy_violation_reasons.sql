-- Adds adCopy.violationReasons for W5 Phase 2 (Node 7 Ad Copy compliance
-- rewrite engine). Mirror of 0004 for the adCopy table.
--
-- Purpose: ship the specific ComplianceIssue[].reason list to the client
-- alongside each ad copy row so the warning panel shows the actual issue
-- count and surfaces the plain-English reasons without re-running
-- checkCompliance on every render. Also used server-side by
-- generateMore's "prefer stored over live" path (the W5 R5 silent-return
-- fix) so manually-seeded QA rows and historically-flagged rows with
-- later-pruned phrases still produce rewrites.
--
-- Populated at generate time via adCopy.generateAsync (both the main
-- and network-retry branches). Nullable: legacy rows predating this
-- column keep violationReasons = NULL and the panel falls back to the
-- cached rewrite row's reasons. Backfill via
-- admin.backfillAdCopyViolationReasons is optional.
--
-- Apply AFTER 0004_add_violation_reasons.sql.

ALTER TABLE `adCopy` ADD COLUMN `violationReasons` JSON NULL;
