/**
 * One-time backfill: encrypt existing plaintext OAuth tokens in-place.
 *
 * Reads all rows from meta_access_tokens and ghl_access_tokens,
 * encrypts any plaintext tokens (skips already-encrypted ones),
 * and UPDATE-in-place.
 *
 * REQUIRES: TOKEN_ENCRYPTION_KEY env var set before running.
 *
 * DO NOT RUN without Arfeen's explicit go — this is a prod DB write.
 *
 * Usage (after TOKEN_ENCRYPTION_KEY is in Railway env):
 *   railway run --environment production --service coachflow \
 *     npx tsx server/scripts/backfill-encrypt-tokens.ts
 */
import { getDb } from "../db";
import { metaAccessTokens, ghlAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { encryptToken, isEncrypted } from "../_core/tokenCrypto";

async function backfill() {
  const db = await getDb();
  if (!db) { console.error("Database not available"); process.exit(1); }

  // ── Meta access tokens ──
  const metaRows = await db.select().from(metaAccessTokens);
  let metaUpdated = 0;
  for (const row of metaRows) {
    if (isEncrypted(row.accessToken)) {
      console.log(`  meta user=${row.userId} — already encrypted, skipping`);
      continue;
    }
    await db.update(metaAccessTokens)
      .set({ accessToken: encryptToken(row.accessToken) })
      .where(eq(metaAccessTokens.id, row.id));
    metaUpdated++;
    console.log(`  meta user=${row.userId} — encrypted`);
  }
  console.log(`Meta: ${metaUpdated} of ${metaRows.length} tokens encrypted.`);

  // ── GHL access tokens ──
  const ghlRows = await db.select().from(ghlAccessTokens);
  let ghlUpdated = 0;
  for (const row of ghlRows) {
    let changed = false;
    const updates: Record<string, string> = {};

    if (!isEncrypted(row.accessToken)) {
      updates.accessToken = encryptToken(row.accessToken);
      changed = true;
    }
    if (row.refreshToken && !isEncrypted(row.refreshToken)) {
      updates.refreshToken = encryptToken(row.refreshToken);
      changed = true;
    }

    if (!changed) {
      console.log(`  ghl user=${row.userId} — already encrypted, skipping`);
      continue;
    }

    await db.update(ghlAccessTokens)
      .set(updates as any)
      .where(eq(ghlAccessTokens.id, row.id));
    ghlUpdated++;
    console.log(`  ghl user=${row.userId} — encrypted`);
  }
  console.log(`GHL: ${ghlUpdated} of ${ghlRows.length} tokens encrypted.`);

  console.log("\nBackfill complete.");
  process.exit(0);
}

backfill().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
