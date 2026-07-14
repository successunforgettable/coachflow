import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * The coach's real webinar/masterclass video URL (per-coach). Powers the webinar template's
 * hero media frame. ZAP NEVER fabricates or generates video — this is a real coach-supplied
 * URL (YouTube / Vimeo / hosted) or nothing. When absent, the webinar template falls back to
 * the coach's headshot in the 16:9 frame with NO fake play affordance, and omits the media
 * entirely if there's no headshot either.
 *
 * `users.video_url` is now a TYPED Drizzle column (`users.videoUrl`) — migration 0087 is
 * applied on prod, so the earlier guarded raw query (needed while the column might not exist)
 * has been dropped in favour of a normal typed select. Selecting only the one column keeps
 * this off the auth hot path's concern list (mirrors the booking_url promotion).
 *
 * Returns null when the coach hasn't supplied a URL.
 */
export async function getCoachVideoUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ videoUrl: users.videoUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const url = row?.videoUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    return null;
  }
}
