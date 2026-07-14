import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * The coach's booking URL (per-coach — a coach's calendar link is stable across all
 * their campaigns). Single source that fills BOTH the discovery landing-page CTA and the
 * email/whatsapp `[INSERT_BOOKING_URL]` fallback (previously never populated).
 *
 * `users.booking_url` is now a TYPED Drizzle column (`users.bookingUrl`) — migration 0086
 * is applied on prod, so the earlier guarded raw query (needed while the column might not
 * exist) has been dropped in favour of a normal typed select. Selecting only the one column
 * keeps this off the auth hot path's concern list.
 *
 * Returns null when the coach hasn't supplied a URL. Callers treat null as "no booking URL":
 * discovery stages a review-draft (never a dead "Book a Call" button); email/whatsapp keep
 * their [INSERT_BOOKING_URL] token.
 */
export async function getCoachBookingUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ bookingUrl: users.bookingUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const url = row?.bookingUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    return null;
  }
}
