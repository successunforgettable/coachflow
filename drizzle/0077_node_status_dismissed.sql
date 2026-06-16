-- Adds 'dismissed' to the nodeStatuses.status enum.
-- Purely additive: does NOT alter, remove, or touch existing rows or values.
-- Existing 'generated', 'imported', 'stale' rows are unaffected.
ALTER TABLE `nodeStatuses` MODIFY COLUMN `status` ENUM('generated','imported','stale','dismissed') NOT NULL DEFAULT 'generated';
