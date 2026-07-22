-- A10 (item 4): add 'needs_publish' to nodeStatuses.status so the LP node can carry an explicit
-- non-complete state when publish fails (gated on publicUrl, not generatedId). Additive, safe.
ALTER TABLE `nodeStatuses` MODIFY COLUMN `status` enum('generated','imported','stale','dismissed','needs_publish') NOT NULL DEFAULT 'generated';
