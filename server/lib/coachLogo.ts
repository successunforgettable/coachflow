/**
 * coachLogo — the single source of truth for a coach's brand logo.
 *
 * A logo is captured today via the existing AssetUploadPanel (/api/upload-asset →
 * user.saveCoachAsset), stored per-user in coachAssets (assetType='logo',
 * landingPageId IS NULL) on Cloudinary, and already rendered on landing pages.
 * This resolver is the ONE place that reads it, so the lead-magnet publisher and
 * the (parked) ad-image logo slot share the same source — never a second copy.
 */
import { getDb } from "../db";
import { coachAssets } from "../../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";

/** The coach's per-user logo URL, or null when they haven't added one. */
export async function getCoachLogoUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ url: coachAssets.url })
    .from(coachAssets)
    .where(and(
      eq(coachAssets.userId, userId),
      eq(coachAssets.assetType, "logo"),
      isNull(coachAssets.landingPageId),
    ))
    .limit(1);
  return row?.url ?? null;
}
