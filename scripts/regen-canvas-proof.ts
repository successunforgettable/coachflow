/**
 * LIVE PROOF — the two-site canvas + routing fix (2026-08-06), regenerateSingle half.
 *
 * WHAT THIS PROVES, AND WHY IT IS THE REAL PATH:
 * It calls `appRouter.createCaller(ctx).adCreatives.regenerateSingle(...)` — the ACTUAL tRPC
 * procedure, including the `setImmediate` background body that carries the fix. It does NOT
 * re-implement the call sequence. A harness that rebuilt the sequence by hand would prove the
 * harness (STANDING RULE 2: fixtures measure the fixtures).
 *
 * WRITE SCOPE — labelled throwaway rows ONLY, never an existing row:
 *   INSERT 2 rows (labelled via `productName`), regenerate each, then DELETE those 2 ids.
 *   adCreatives goes 405 -> 407 -> 405. No pre-existing row is read-modify-written, so a
 *   mis-captured pre-state cannot damage anything — teardown is a delete of rows we created.
 *
 * ⚠️ TEARDOWN IS ID-SCOPED. `WHERE id IN (...)` plus a userId guard. Never userId alone: smoke user
 * 117174 owns the 25 protected creatives on services 272-277.
 *
 * Rows are NOT on a protected service — they are created fresh against service 263 (user 1).
 *
 * `railway run` block-buffers stdout, so everything is also appended to _progress.log on disk.
 */
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { resolve } from "path";

const STAMP = process.env.PROOF_STAMP || "run-2026-08-06-regen-canvas";
const OUTDIR = resolve(process.cwd(), "docs/screenshots", STAMP);
if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
const log = (m: string) => {
  console.log(m);
  try { appendFileSync(resolve(OUTDIR, "_progress.log"), `${m}\n`); } catch {}
};

const LABEL = "ZZZ-THROWAWAY-CANVAS-PROOF-2026-08-06";
const TEMPLATE_SERVICE = 263;
const USER_ID = 1;
const BASELINE = 405;

// One still life (proves the gpt-image-1 switch) and one person slot (proves the person slots did
// NOT move off Flux — a fix that moved everything would be a regression, not a fix).
const CASES = [
  { style: "screenshot",     expectRenderer: "gpt-image-1",  expectDims: "1024x1280" },
  { style: "person_shocked", expectRenderer: "flux-1.1-pro", expectDims: "896x1088"  },
];

async function main() {
  const { getDb } = await import("../server/db");
  const { adCreatives, jobs } = await import("../drizzle/schema");
  const { eq, and, inArray, count } = await import("drizzle-orm");
  const { appRouter } = await import("../server/routers");

  const db = await getDb();
  if (!db) throw new Error("No DB");

  const total = async () => (await db.select({ n: count() }).from(adCreatives))[0].n;

  const startCount = await total();
  log(`[pre] adCreatives = ${startCount} (baseline ${BASELINE})`);
  if (startCount !== BASELINE) log(`[pre] ⚠️ NOT AT BASELINE — investigate before trusting teardown`);

  // Template values copied from a real row so niche/problem are coherent; nothing is mutated there.
  const [tpl] = await db.select().from(adCreatives).where(eq(adCreatives.serviceId, TEMPLATE_SERVICE)).limit(1);
  if (!tpl) throw new Error(`No template row on service ${TEMPLATE_SERVICE}`);

  const createdIds: number[] = [];
  try {
    for (const c of CASES) {
      const res = await db.insert(adCreatives).values({
        userId: USER_ID,
        serviceId: tpl.serviceId,
        campaignId: tpl.campaignId ?? null,
        niche: tpl.niche,
        productName: LABEL,                 // the label — how teardown and any human identifies these
        uniqueMechanism: tpl.uniqueMechanism,
        targetAudience: tpl.targetAudience,
        mainBenefit: tpl.mainBenefit,
        pressingProblem: tpl.pressingProblem,
        adType: tpl.adType,
        designStyle: c.style as any,
        headlineFormula: tpl.headlineFormula,
        headline: tpl.headline,
        imageUrl: "https://placeholder.invalid/pre-regen.png",
        imageFormat: "1080x1080",           // deliberately the OLD lie — the fix must overwrite it
        complianceChecked: true,
      } as any);
      const id = Number((res as any)[0].insertId);
      createdIds.push(id);
      log(`[setup] created throwaway id=${id} style=${c.style} imageFormat=1080x1080 (pre-fix value)`);
    }

    const caller = appRouter.createCaller({
      user: { id: USER_ID, subscriptionTier: "pro", role: "admin" },
      req: {} as any,
      res: {} as any,
    } as any);

    // ── Drive the REAL procedure ────────────────────────────────────────────
    const jobIds: Record<number, string> = {};
    for (const id of createdIds) {
      const r: any = await caller.adCreatives.regenerateSingle({ id });
      jobIds[id] = r.jobId;
      log(`[run] regenerateSingle(id=${id}) -> job ${r.jobId}`);
    }

    // ── Wait for the background jobs ────────────────────────────────────────
    const deadline = Date.now() + 6 * 60 * 1000;
    const pending = new Set(createdIds);
    while (pending.size && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      for (const id of [...pending]) {
        const [j] = await db.select().from(jobs).where(eq(jobs.id, jobIds[id])).limit(1);
        if (!j) continue;
        if (j.status === "complete") { pending.delete(id); log(`[job] id=${id} COMPLETE`); }
        else if (j.status === "failed") { pending.delete(id); log(`[job] id=${id} FAILED: ${j.error}`); }
      }
      if (pending.size) log(`[job] waiting on ${[...pending].join(",")} …`);
    }
    if (pending.size) log(`[job] ⚠️ TIMED OUT waiting on ${[...pending].join(",")}`);

    // ── Read back, download, measure ────────────────────────────────────────
    const sharp = (await import("sharp")).default;
    for (let i = 0; i < createdIds.length; i++) {
      const id = createdIds[i];
      const c = CASES[i];
      const [row] = await db.select().from(adCreatives).where(eq(adCreatives.id, id)).limit(1);
      if (!row || !row.imageUrl || row.imageUrl.includes("placeholder.invalid")) {
        log(`[result] id=${id} style=${c.style} — NO NEW IMAGE (row unchanged)`);
        continue;
      }
      for (const [kind, url] of [["composited", row.imageUrl], ["raw", row.rawImageUrl]] as const) {
        if (!url) continue;
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        const m = await sharp(buf).metadata();
        const file = resolve(OUTDIR, `${c.style}-${kind}.png`);
        writeFileSync(file, buf);
        log(`[result] id=${id} ${c.style} ${kind}: ${m.width}x${m.height} -> ${file}`);
      }
      const ratio = row.imageFormat;
      const ok = ratio === c.expectDims;
      log(`[verify] id=${id} ${c.style}: imageFormat="${ratio}" expected="${c.expectDims}" ${ok ? "✅" : "🔴"} (expected renderer ${c.expectRenderer})`);
    }
  } finally {
    // ── TEARDOWN — id-scoped, with a userId guard, ALWAYS runs ──────────────
    if (createdIds.length) {
      log(`[teardown] deleting ids ${createdIds.join(",")} (id-scoped + userId guard)`);
      await db.delete(adCreatives).where(
        and(inArray(adCreatives.id, createdIds), eq(adCreatives.userId, USER_ID)),
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
    const endCount = await total();
    log(`[post] adCreatives = ${endCount} (baseline ${BASELINE}) ${endCount === BASELINE ? "✅ RECONCILED" : "🔴 NOT RECONCILED"}`);
    const [runningRow] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, "running"));
    log(`[post] running jobs = ${runningRow?.n ?? "?"}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { log(`FATAL: ${e?.stack || e}`); process.exit(1); });
