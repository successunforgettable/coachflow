import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * The coach's booking URL (per-coach — a coach's calendar link is stable across all
 * their campaigns). Single source that fills BOTH the discovery landing-page CTA and the
 * email/whatsapp `[INSERT_BOOKING_URL]` fallback (previously never populated).
 *
 * Read via a GUARDED RAW QUERY, not a typed Drizzle column, on purpose: the
 * `users.booking_url` column is added by migration 0086 (HELD). Adding it to the Drizzle
 * `users` schema before that migration applies would put it in every generated
 * `select().from(users)` column list — including the auth hot path (`db.ts` getUserByOpenId)
 * — and break every authenticated request on prod. Reading it out-of-band keeps the code
 * safe to deploy before 0086 is applied.
 *
 * Returns null when the coach hasn't supplied a URL OR when the column doesn't exist yet
 * (pre-0086). Callers treat null as "no booking URL": discovery stages a review-draft
 * (never a dead "Book a Call" button); email/whatsapp keep their [INSERT_BOOKING_URL] token.
 *
 * Post-0086 follow-up (safe once the column exists): promote to a typed `users.bookingUrl`
 * Drizzle column and drop this guarded reader.
 */
export async function getCoachBookingUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const res: any = await db.execute(
      sql`SELECT booking_url AS bookingUrl FROM users WHERE id = ${userId} LIMIT 1`,
    );
    // drizzle/mysql2 execute returns [rows, fields]; be defensive across shapes.
    const rows = Array.isArray(res) ? res[0] : (res?.rows ?? res);
    const url = Array.isArray(rows) ? rows[0]?.bookingUrl : rows?.bookingUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    // Column not present yet (pre-migration 0086) → treat as absent.
    return null;
  }
}
