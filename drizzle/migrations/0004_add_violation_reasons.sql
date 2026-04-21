-- Adds headlines.violationReasons for W5 Phase 1 R2.
--
-- Purpose: ship the specific ComplianceIssue[].reason list to the client
-- alongside each headline so the warning panel shows the actual violation
-- count (not a "1 issue" floor) and surfaces the plain-English reasons
-- without re-running checkCompliance on every render.
--
-- Populated at generate time via the headlines.generate(Async) procedures.
-- Nullable: legacy rows predating this column keep violationReasons = NULL
-- and the panel falls back to the cached rewrite row's violationReasons.
-- Backfill is NOT required — legacy flagged rows continue to work via the
-- fallback path; new rows written post-deploy will populate the column.
--
-- Apply AFTER 0003_compliance_rewrites.sql.

ALTER TABLE `headlines` ADD COLUMN `violationReasons` JSON NULL;
