/**
 * E2E bonus teardown (forward-sequence step 2, Layer 2) — removes the smoke test account's bonus deliverables
 * from prod after a smoke run, so routine runs leave NOTHING hosted (KV pages + Cloudinary PDFs + DB rows).
 *
 * STRUCTURALLY INCAPABLE of touching a real coach's content — four independent guards, no arbitrary input:
 *   1. The target identity comes ONLY from `E2E_NOPUBLISH_OPENID` (env) — never a CLI arg / userId / slug.
 *   2. That openId must resolve to a real user, or abort.
 *   3. That user's email MUST equal the hard-coded TEST_EMAIL, or abort (a real coach can never match).
 *   4. The openId must be a `native_`-prefixed test identity, or abort.
 *   Only that ONE user's bonuses are ever selected/deleted (WHERE userId = <that user>).
 * If any guard fails it exits non-zero WITHOUT deleting anything.
 */
const TEST_EMAIL = "zap-e2e-smoke@mailinator.com"; // the ONLY account this script may ever touch

async function main() {
  const openId = process.env.E2E_NOPUBLISH_OPENID;
  if (!openId) { console.error("[bonus-teardown] ABORT: E2E_NOPUBLISH_OPENID is unset"); process.exit(1); }

  const { getDb } = await import("../db");
  const { users, bonuses } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) { console.error("[bonus-teardown] ABORT: no db"); process.exit(1); }

  const [u] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!u) { console.error("[bonus-teardown] ABORT: openId resolves to no user"); process.exit(1); }
  if (u.email !== TEST_EMAIL) { console.error(`[bonus-teardown] ABORT: openId resolves to ${u.email}, NOT the test account — refusing`); process.exit(1); }
  if (!String(u.openId).startsWith("native_")) { console.error("[bonus-teardown] ABORT: not a native test identity"); process.exit(1); }

  const rows = await db.select().from(bonuses).where(eq(bonuses.userId, u.id));
  const { ensureKvNamespace, deleteKvPage } = await import("../lib/cloudflare");
  const { storageDelete } = await import("../storage");
  const ns = await ensureKvNamespace();

  let kv = 0, pdf = 0;
  for (const b of rows) {
    try { await deleteKvPage(ns, `bonus-${b.id}`); kv++; } catch (e) { console.warn(`[bonus-teardown] KV bonus-${b.id}: ${e instanceof Error ? e.message : e}`); }
    try { await storageDelete(`bonuses/${u.id}/${b.id}.pdf`); pdf++; } catch (e) { console.warn(`[bonus-teardown] PDF ${b.id}: ${e instanceof Error ? e.message : e}`); }
  }
  await db.delete(bonuses).where(eq(bonuses.userId, u.id));
  console.log(`[bonus-teardown] ${TEST_EMAIL} (user ${u.id}): removed ${rows.length} bonus rows, ${kv} KV pages, ${pdf} PDFs.`);
  process.exit(0);
}

main().catch((e) => { console.error("[bonus-teardown] fatal:", e); process.exit(1); });
