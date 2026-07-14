import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * The coach's external checkout URL (per-coach — a coach's payment/enrolment link is stable
 * across their sales campaigns). Powers the sales landing-page CTA: a sales page's "Enrol"
 * button points at the coach's real checkout (ZAP has no payment integration), and never a
 * dead button — when absent the sales template falls back to an email capture (`/api/capture-lead`
 * sales mode) so a prospect always has a next step.
 *
 * Read via a GUARDED RAW QUERY, not a typed Drizzle column, on purpose: the
 * `users.checkout_url` column is added by migration 0088 (HELD — authored, not applied).
 * Adding it to the Drizzle `users` schema before that migration applies would put it in every
 * generated `select().from(users)` column list — including the auth hot path (`db.ts`
 * getUserByOpenId) — and break every authenticated request on prod. Reading it out-of-band
 * keeps the code safe to deploy before 0088 is applied.
 *
 * Returns null when the coach hasn't supplied a URL OR when the column doesn't exist yet
 * (pre-0088). Callers treat null as "no checkout URL": the sales CTA reveals an email capture
 * instead of linking out.
 *
 * Post-0088 follow-up (safe once the column exists): promote to a typed `users.checkoutUrl`
 * Drizzle column and drop this guarded reader (mirrors the booking_url / video_url promotions).
 */
export async function getCoachCheckoutUrl(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const res: any = await db.execute(
      sql`SELECT checkout_url AS checkoutUrl FROM users WHERE id = ${userId} LIMIT 1`,
    );
    // drizzle/mysql2 execute returns [rows, fields]; be defensive across shapes.
    const rows = Array.isArray(res) ? res[0] : (res?.rows ?? res);
    const url = Array.isArray(rows) ? rows[0]?.checkoutUrl : rows?.checkoutUrl;
    return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
  } catch {
    // Column not present yet (pre-migration 0088) → treat as absent.
    return null;
  }
}
