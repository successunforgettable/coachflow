-- Email Sequence wire commit 1/3: extend the sequenceType enum from 3 to 6 values.
-- Adds nurture / launch / re-engagement to the existing welcome / engagement / sales.
-- Existing rows with the 3 original values stay valid — backward compatible.
-- The 3 new values are exposed via the wizard UI in commit 3; the 3 existing
-- event-anchored values stay accessible via direct API call but are not in the wizard.
ALTER TABLE `emailSequences` MODIFY COLUMN `sequenceType` enum('welcome','engagement','sales','nurture','launch','re-engagement');
