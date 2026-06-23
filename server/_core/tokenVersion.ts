/**
 * Token version helpers for session revocation.
 *
 * The tokenVersion column lives in the users table but is NOT in the
 * Drizzle schema (to avoid breaking `select().from(users)` before the
 * migration runs). All access is via raw SQL.
 *
 * incrementTokenVersion: called on password reset / change password to
 * invalidate all existing sessions for the user.
 *
 * getTokenVersion: called by the SDK's authenticateRequest to compare
 * the JWT's embedded version against the DB. Lives in sdk.ts (private).
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * Increment the user's tokenVersion, invalidating all existing sessions.
 * Returns the new version, or null if the column doesn't exist yet.
 */
export async function incrementTokenVersion(userId: number): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    await db.execute(
      sql`UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ${userId}`
    );
    // Read back the new version
    const result: any = await db.execute(
      sql`SELECT tokenVersion FROM users WHERE id = ${userId} LIMIT 1`
    );
    const row = result?.[0]?.[0] ?? result?.[0];
    return typeof row?.tokenVersion === "number" ? row.tokenVersion : null;
  } catch {
    // Column doesn't exist yet (pre-migration) — no-op
    return null;
  }
}
