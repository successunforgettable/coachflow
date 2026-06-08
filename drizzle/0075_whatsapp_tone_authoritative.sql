-- Extend whatsappSequences.tone enum from 3 to 4 values.
-- Appends 'authoritative' to the existing 'conversational' / 'professional' / 'urgent' set.
-- Strictly append — preserves original 3 at positions 1-3.
-- Backward compatible: existing rows carry one of the 3 original values; no data migration.
ALTER TABLE `whatsappSequences` MODIFY COLUMN `tone` enum('conversational','professional','urgent','authoritative') DEFAULT 'conversational';
