import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * The coach's external checkout URL (per-coach — a coach's payment/enrolment link is stable
 * across their sales campaigns). Powers the sales landing-page CTA: a sales page's "Enrol"
 * button points at the coach's real checkout (ZAP has no payment integration), and never a
 * dead button — when absent the sales template falls back to an email capture (`/api/capture-lead`
 * sales mode) so a prospect always has a next step.
 *
 * `users.checkout_url` is now a TYPED Drizzle column (`users.checkoutUrl`) — migration 0088 is
 * applied on prod, so the earlier guarded raw query (needed while the column might not exist)
 * has been dropped in favour of a normal typed select. Selecting only the one column keeps
 * this off the auth hot path's concern list (mirrors the booking_url / video_url promotions).
 *
 * Returns null when the coach hasn't supplied a URL.
 */
export async function getCoachCheckoutUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ checkoutUrl: users.checkoutUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const url = row?.checkoutUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    return null;
  }
}
