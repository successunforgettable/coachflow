-- WhatsApp wire commit 1/3: persist user-selected tone per generated sequence.
-- NULLable, no default — existing rows stay NULL ("tone wasn't tracked at generation time").
-- No backfill. Tone-conditional prompt rules land in commit 2; UI exposure lands in commit 3.
ALTER TABLE `whatsappSequences` ADD `tone` enum('conversational','professional','urgent');
