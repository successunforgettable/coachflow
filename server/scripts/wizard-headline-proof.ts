/**
 * wizard-headline-proof.ts — LIVE proof for the two cheap image-sprint fixes.
 *
 * A: SWEEP COMPLETENESS (migration 0099). Every render uploads THREE Cloudinary objects
 *    — an intermediate `generated/…` plus the raw and composited copies — and only the
 *    latter two were ever recorded on the row, so the guarded sweep cleared two of three
 *    and leaked one per render, permanently. `adCreatives.sourceImageUrl` now records the
 *    intermediate so the sweep can see all three.
 *
 * B: WIZARD HEADLINES. The wizard's `adCreatives.generate` passed no headlines, so it fell
 *    through to the legacy HEADLINE_FORMULAS templates. The `benefit` formula is
 *    `${MECHANISM}: HOW IT WORKS`, which at a 24-character mechanism name is 38 characters
 *    against a 37-character fitter — so `fitTitle` always ate the word "WORKS" and baked
 *    "…: HOW IT…" onto the picture. The Auto Mode cascade never had this, because it passes
 *    contextual headlines. Only wizard users saw it.
 *
 * ⚠️ CALLS THE REAL tRPC PROCEDURE — `appRouter.createCaller(ctx).adCreatives.generate(...)`
 * — not a rebuilt sequence. A rebuilt sequence would prove the harness (STANDING RULE 2).
 *
 * ⚠️ RENDERS REAL IMAGES and creates real Cloudinary objects.
 *
 * ⚠️ TEARDOWN IS NOT EXECUTED. It is DRY-RUN only, which resolves and reports the public
 * ids without deleting anything — enough to prove all three objects per row are now
 * reachable, while the destructive step waits for Arfeen's separate word.
 *
 * Usage:  npx tsx server/scripts/wizard-headline-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync, writeFileSync, mkdirSync } from "fs";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCreatives, services, idealCustomerProfiles } from "../../drizzle/schema";

const LOG = `/tmp/wizard-headline-proof-${process.pid}.log`;
const OUTDIR = `docs/screenshots/run-wizard-headline-proof`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-WIZARD-HEADLINE-PROOF — throwaway, safe to delete";

// A mechanism name long enough to reproduce the defect: the legacy formula would emit
// "THE SCOPE-FIRST SEQUENCE: HOW IT WORKS" = 38 chars against a 37-char fitter.
const MECHANISM = "The Scope-First Sequence";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("WIZARD HEADLINE + SWEEP COMPLETENESS — LIVE PROOF");
  say(`user ${USER_ID} · RENDERS REAL IMAGES · teardown DRY-RUN ONLY`);
  rule("═");

  // ── PRE-FLIGHT: migration 0099 must be applied ────────────────────────────
  const cols: any = await db.execute(sql`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adCreatives'
       AND COLUMN_NAME = 'sourceImageUrl'
  `).then((r: any) => (Array.isArray(r) ? r[0] : r?.rows ?? r));
  const found = Array.isArray(cols) ? cols[0] : cols;
  if (!found) {
    throw new Error(
      "migration 0099 is NOT applied — adCreatives has no `sourceImageUrl` column. Apply it " +
      "before running this proof; the intermediate would go unrecorded and leak exactly as before.",
    );
  }
  say(`adCreatives.sourceImageUrl = ${found.COLUMN_TYPE} · nullable ${found.IS_NULLABLE}`);
  say("✅ migration 0099 present\n");

  // ── Throwaway service + ICP ───────────────────────────────────────────────
  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway service created by wizard-headline-proof.ts. Safe to delete.",
    targetCustomer: "operations consultants who bill by the hour and want to move to retainers",
    mainBenefit: "a booked retainer conversation within two weeks of first contact",
    painPoints: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet",
  } as any);
  const serviceId = Number((ins as any).insertId);
  say(`created throwaway service id=${serviceId}`);

  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly.",
    pains: "proposals sit unsent while the scope keeps moving",
    fears: "that raising the model loses the client entirely",
    goals: "a booked retainer conversation within two weeks",
    frustrations: "scope creeps between the call and the proposal",
    objections: "my clients would never agree to a retainer",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`created throwaway ICP id=${icpId}\n`);

  // ── Drive the REAL wizard procedure ───────────────────────────────────────
  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller({
    user: { id: USER_ID, subscriptionTier: "pro", role: "admin" },
    req: {} as any,
    res: {} as any,
  } as any);

  say("calling the REAL adCreatives.generate (the wizard path)…");
  const t0 = Date.now();
  const res: any = await caller.adCreatives.generate({
    serviceId,
    niche: "operations consulting",
    productName: MECHANISM,
    uniqueMechanism: MECHANISM,
    targetAudience: "operations consultants who bill by the hour",
    mainBenefit: "a booked retainer conversation within two weeks of first contact",
    pressingProblem: "proposals sit unsent for days while the scope keeps moving",
    adType: "lead_gen",
  } as any);
  const batchId = res.batchId;
  say(`generated batchId=${batchId} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  const rows: any[] = await db
    .select({
      id: adCreatives.id, headline: adCreatives.headline, headlineFormula: adCreatives.headlineFormula,
      designStyle: adCreatives.designStyle, imageFormat: adCreatives.imageFormat,
      imageUrl: adCreatives.imageUrl, rawImageUrl: adCreatives.rawImageUrl,
      sourceImageUrl: adCreatives.sourceImageUrl,
    })
    .from(adCreatives).where(and(eq(adCreatives.batchId, batchId), eq(adCreatives.userId, USER_ID)));

  // ── B. Headlines are contextual, not the truncated template ───────────────
  say("─".repeat(78));
  say("B. THE HEADLINE IS CONTEXTUAL, NOT THE TRUNCATED TEMPLATE");
  rule();
  const LEGACY = `${MECHANISM.toUpperCase()}: HOW IT`;   // what the old formula baked, post-cut
  let truncated = 0, legacy = 0, tooLong = 0;
  for (const r of rows) {
    const h = String(r.headline ?? "");
    const isTrunc = h.includes("…");
    const isLegacy = h.toUpperCase().startsWith(LEGACY);
    if (isTrunc) truncated += 1;
    if (isLegacy) legacy += 1;
    if (h.length > 38) tooLong += 1;
    say(`   [${r.headlineFormula}] (${h.length} chars)${isTrunc ? " 🔴ELLIPSIS" : ""}${isLegacy ? " 🔴LEGACY" : ""} ${h}`);
  }
  say("");
  say(`ellipsis-truncated: ${truncated} · legacy-template: ${legacy} · over 38 chars: ${tooLong}`);
  say(truncated === 0 && legacy === 0 && tooLong === 0
    ? "✅ PASS — every headline is contextual, within the house limit, and un-truncated."
    : "🔴 FAIL — see the flags above.");

  // ── A. The intermediate is recorded ───────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("A. THE INTERMEDIATE RENDER IS RECORDED ON THE ROW (migration 0099)");
  rule();
  const missingSrc = rows.filter((r) => !r.sourceImageUrl);
  for (const r of rows) {
    say(`   row ${r.id} [${r.designStyle}] sourceImageUrl=${r.sourceImageUrl ? "SET" : "🔴NULL"}`);
  }
  say(missingSrc.length === 0
    ? `✅ PASS — all ${rows.length} rows carry the intermediate url.`
    : `🔴 FAIL — ${missingSrc.length} row(s) missing it.`);

  // ── Render the composites for judgement ───────────────────────────────────
  say("\n" + "─".repeat(78));
  say("THE COMPOSITES — the only thing that proves the headline on the picture");
  rule();
  mkdirSync(OUTDIR, { recursive: true });
  for (const [i, c] of Array.from(rows.entries())) {
    for (const [kind, url] of [["composite", c.imageUrl], ["raw", c.rawImageUrl]] as const) {
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const f = `${OUTDIR}/${String(i + 1).padStart(2, "0")}-${c.designStyle}-${kind}.png`;
      writeFileSync(f, buf);
      say(`   saved ${f} (${(buf.length / 1024).toFixed(0)}KB, ${c.imageFormat})`);
    }
  }
  say("");
  say("⚠️ JUDGE THE COMPOSITE, NEVER THE RAW.");

  // ── Teardown — DRY RUN ONLY, proving three ids per row are reachable ──────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — DRY RUN ONLY. Nothing is deleted here.");
  rule();
  const { sweepAdCreativeBatch } = await import("../lib/adCreativeTeardown");
  const dry = await sweepAdCreativeBatch(db, batchId, USER_ID, { dryRun: true });
  say(`rowsFound ${dry.rowsFound} · publicIds ${dry.publicIds.length} · rowsDeleted ${dry.rowsDeleted} (dryRun ${dry.dryRun})`);
  for (const id of dry.publicIds) say(`   ${id}`);
  const perRow = rows.length ? dry.publicIds.length / rows.length : 0;
  say("");
  say(perRow === 3
    ? `✅ PASS — ${perRow} objects resolved per row. The intermediate is now inside the sweep's reach.`
    : `🔴 FAIL — ${perRow} objects per row; expected 3.`);

  say("\nTO EXECUTE THE REAL TEARDOWN (held for Arfeen's word):");
  say(`  sweepAdCreativeBatch(db, '${batchId}', ${USER_ID})   -- deletes ${dry.publicIds.length} Cloudinary objects, then ${rows.length} rows`);
  say(`  DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};`);
  say(`  DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};`);
  say("");
  say("-- Reconcile after teardown: adCreatives 405 · adCopy 5424 · headlines 2174 · jobs 0");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[wizard-headline-proof] FAILED:", e);
  process.exit(1);
});
