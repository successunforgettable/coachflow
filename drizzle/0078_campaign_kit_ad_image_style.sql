-- Adds adImageStyle column to campaignKits for style preference.
-- Purely additive: nullable varchar, no default, existing rows get NULL.
-- NULL = photo_ad (the existing Flux pipeline, backward-compatible).
ALTER TABLE `campaignKits` ADD COLUMN `adImageStyle` VARCHAR(50) NULL;
