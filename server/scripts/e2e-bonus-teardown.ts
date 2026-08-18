/**
 * E2E bonus teardown (forward-sequence step 2, Layer 2) — removes the smoke test account's bonus deliverables
 * from prod after a smoke run, so routine runs leave NOTHING hosted (KV pages + Cloudinary PDFs + DB rows).
 *
 * STRUCTURALLY INCAPABLE of touching a real coach's content — four independent guards, no arbitrary input:
 *   1. The target identity comes ONLY from `E2E_NOPUBLISH_OPENID` (env) — never a CLI arg / userId / slug.
 *   2. That openId must resolve to a real user, or abort.
 *   3. That user's email MUST equal the hard-coded TEST_EMAIL, or abort (a real coach can never match).
 *   4. The openId must be a `native_`-prefixed test identity, or abort.
 *   5. Rows on PROTECTED_SERVICE_IDS are excluded IN THE PREDICATE — guards 1-4 fence the USER,
 *      and that user legitimately OWNS protected services 272-277, so a userId-only delete is
 *      exactly the shape CLAUDE.md section 10 forbids.
 * If any guard fails it exits non-zero WITHOUT deleting anything.
 */
const TEST_EMAIL = "zap-e2e-smoke@mailinator.com"; // the ONLY account this script may ever touch

async function main() {
  const openId = process.env.E2E_NOPUBLISH_OPENID;
  if (!openId) { console.error("[bonus-teardown] ABORT: E2E_NOPUBLISH_OPENID is unset"); process.exit(1); }

  const { getDb } = await import("../db");
  const { users, bonuses } = await import("../../drizzle/schema");
  const { eq, and, or, isNull, notInArray } = await import("drizzle-orm");
  const { PROTECTED_SERVICE_IDS } = await import("../lib/adCreativeTeardown");
  const db = await getDb();
  if (!db) { console.error("[bonus-teardown] ABORT: no db"); process.exit(1); }

  const [u] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!u) { console.error("[bonus-teardown] ABORT: openId resolves to no user"); process.exit(1); }
  if (u.email !== TEST_EMAIL) { console.error(`[bonus-teardown] ABORT: openId resolves to ${u.email}, NOT the test account — refusing`); process.exit(1); }
  if (!String(u.openId).startsWith("native_")) { console.error("[bonus-teardown] ABORT: not a native test identity"); process.exit(1); }

  // GUARD 5 — THE PROTECTED-SERVICE FENCE, ENFORCED IN THE PREDICATE.
  // Guards 1-4 prove WHICH USER. They say nothing about WHICH SERVICE, and user 117174
  // legitimately OWNS protected services 272-277 — so a userId-only delete is exactly the shape
  // CLAUDE.md section 10 forbids. Measured read-only 2026-08-19: 117174 currently holds 0 bonuses
  // rows, so this is a LATENT hole rather than active damage. Fenced anyway, because the fence has
  // to hold on the run AFTER the one that first generates a bonus on a protected service.
  //
  // WARNING: `serviceId` IS NULLABLE, and `NULL NOT IN (...)` evaluates to NULL, not TRUE. Without
  // the isNull() arm every NULL-service row would silently STOP being deleted, orphaning its KV
  // page and its PDF while the script still reported success. The OR readmits them deliberately.
  const notProtected = or(
    isNull(bonuses.serviceId),
    notInArray(bonuses.serviceId, [...PROTECTED_SERVICE_IDS]),
  );
  const scope = and(eq(bonuses.userId, u.id), notProtected);

  // The SAME predicate selects what gets swept. Fencing only the DELETE would destroy a protected
  // row's hosted assets and then leave its DB row pointing at them — worse than either alone.
  const rows = await db.select().from(bonuses).where(scope);
  const { ensureKvNamespace, deleteKvPage } = await import("../lib/cloudflare");
  const { storageDelete } = await import("../storage");
  const ns = await ensureKvNamespace();

  let kv = 0, pdf = 0;
  for (const b of rows) {
    try { await deleteKvPage(ns, `bonus-${b.id}`); kv++; } catch (e) { console.warn(`[bonus-teardown] KV bonus-${b.id}: ${e instanceof Error ? e.message : e}`); }
    try { await storageDelete(`bonuses/${u.id}/${b.id}.pdf`); pdf++; } catch (e) { console.warn(`[bonus-teardown] PDF ${b.id}: ${e instanceof Error ? e.message : e}`); }
  }
  await db.delete(bonuses).where(scope);
  console.log(`[bonus-teardown] ${TEST_EMAIL} (user ${u.id}): removed ${rows.length} bonus rows, ${kv} KV pages, ${pdf} PDFs.`);
  process.exit(0);
}

main().catch((e) => { console.error("[bonus-teardown] fatal:", e); process.exit(1); });
