-- Adds rawImageUrl to adCreatives.
--
-- Purpose: store the raw Flux output (before headline compositing) as a
-- separate Cloudinary asset so recompositeText can always start from a clean
-- background. Without this column, text-only re-renders composite on top of
-- the already-composited image and leave ghost pixels when the new headline's
-- layout differs from the old one.
--
-- Nullable + no backfill: legacy rows keep rawImageUrl = NULL and continue to
-- recomposite from imageUrl (with the ghost-pixel caveat, logged as [LEGACY]).
-- New rows written by generateAsync / regenerateSingle will populate both URLs.

ALTER TABLE `adCreatives` ADD COLUMN `rawImageUrl` VARCHAR(500) NULL;
