-- Migration 0090 — campaignKits.campaignFacts (Phase 1 / Problem A: operator facts captured UPFRONT)
-- A single JSON column holding the eventSchedule + price sub-shape of LandingPageContent, populated by the
-- wizard's upfront facts step BEFORE generation, so email/whatsapp/LP generate with real date/venue/price
-- (not hardcoded sequenceLength:3 + [INSERT_*] placeholders). Nullable; existing kits unaffected.
ALTER TABLE `campaignKits` ADD COLUMN `campaignFacts` JSON NULL;
