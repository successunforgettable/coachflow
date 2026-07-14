import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * The coach's real webinar/masterclass video URL (per-coach). Powers the webinar template's
 * hero media frame. ZAP NEVER fabricates or generates video — this is a real coach-supplied
 * URL (YouTube / Vimeo / hosted) or nothing. When absent, the webinar template falls back to
 * the coach's headshot in the 16:9 frame with NO fake play affordance (an inert play button on
 * a static photo would imply a video that isn't there), and omits the media entirely if there's
 * no headshot either.
 *
 * Read via a GUARDED RAW QUERY, not a typed Drizzle column, ON PURPOSE — exactly as
 * `booking_url` was before migration 0086: the `users.video_url` column is added by migration
 * 0087 (HELD — a separate gated apply). Adding it to the Drizzle `users` schema before that
 * migration applies would put it in every generated `select().from(users)` — including the auth
 * hot path (`db.ts` getUserByOpenId) — and break every authenticated request on prod. Reading it
 * out-of-band keeps this code safe to deploy BEFORE 0087 is applied.
 *
 * Returns null when the coach hasn't supplied a URL OR when the column doesn't exist yet
 * (pre-0087). Post-0087 follow-up (safe once the column exists): promote to a typed
 * `users.videoUrl` Drizzle column and drop this guarded reader (mirrors the booking_url
 * promotion this session).
 */
export async function getCoachVideoUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const res: any = await db.execute(
      sql`SELECT video_url AS videoUrl FROM users WHERE id = ${userId} LIMIT 1`,
    );
    // drizzle/mysql2 execute returns [rows, fields]; be defensive across shapes.
    const rows = Array.isArray(res) ? res[0] : (res?.rows ?? res);
    const url = Array.isArray(rows) ? rows[0]?.videoUrl : rows?.videoUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    // Column not present yet (pre-migration 0087) → treat as absent.
    return null;
  }
}
