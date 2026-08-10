/**
 * step4b-assembly-proof.ts — concept-keyed assembly, proven on a real generated set.
 *
 * ⚠️ REQUIRES MIGRATION 0103. Assembly reads `adCreatives.hookAdCopyId`; without the column
 * the hook agreement is unmeasurable and the run would look green while proving nothing. The
 * script checks and refuses.
 *
 * ⚠️ NO META CALL ANYWHERE. Nothing in this file imports `metaAPI`, `publishToMeta` or
 * `multiAdPublish`. Assembly is read-only: it returns a plan and writes nothing.
 *
 * ⚠️ THIS ONE RENDERS. Every creative writes THREE Cloudinary objects (source, raw,
 * composited). The composites are DOWNLOADED TO DISK BEFORE the sweep — teardown outranks the
 * artefact read, and once the rows are gone the URLs are unrecoverable from the database.
 * Teardown order is fixed: Cloudinary → creatives → copy → concepts, because the 0102 FK is
 * ON DELETE SET NULL and would otherwise blank every stamp this run exists to measure.
 *
 * WHAT IT MEASURES:
 *   1. The hook is now dealt BY CONCEPT — the A-vs-B agreement, by id, against the 3-of-4
 *      disagreement measured on the step-3 run.
 *   2. Any headline-to-concept stamp disagreement, surfaced as a DEFECT.
 *   3. The COHERENCE YIELD: of the concepts in the run, how many produced a complete coherent
 *      ad, and for every one that did not, the reason.
 *   4. Which pictures came out with a BLANK HOOK BAND — the intended visible symptom of a
 *      short hook deck, and the thing Arfeen judges on the pixels.
 *
 * Usage:  npx tsx server/scripts/step4b-assembly-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCreatives, adCopy, services, idealCustomerProfiles, campaignConcepts, headlines } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runAdCreativesGeneration } from "../adCreativesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { sweepAdCreativeBatch } from "../lib/adCreativeTeardown";
import { assembleConceptAds, describeAssembly } from "../_core/adAssembly";
import { AD_VARIATIONS } from "../_core/adVariations";

const LOG = `/tmp/step4b-assembly-proof-${process.pid}.log`;
const IMG_DIR = join(process.cwd(), "docs", "screenshots", "run-2026-08-10-step4b-assembly");
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-STEP4B-ASSEMBLY — throwaway, safe to delete";

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("STEP 4b — CONCEPT-KEYED ASSEMBLY, on a real generated set. NO META CALLS.");
  say(`user ${USER_ID}`);
  rule("═");

  // Pre-flight: without 0103 the hook stamp is a silent no-op and the run would "pass" green.
  const col: any = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adCreatives' AND COLUMN_NAME = 'hookAdCopyId'
  `).then((r: any) => (Array.isArray(r) ? r[0] : r?.rows ?? r));
  if (!(Array.isArray(col) ? col[0] : col)) {
    throw new Error("migration 0103 is NOT applied — adCreatives has no hookAdCopyId column. Refusing to run.");
  }
  say("✅ migration 0103 present\n");

  const baseline = {
    adCopy: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCopy))[0].n),
    headlines: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(headlines))[0].n),
    adCreatives: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCreatives))[0].n),
    concepts: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(campaignConcepts))[0].n),
  };
  say(`baseline BEFORE: adCopy ${baseline.adCopy} · headlines ${baseline.headlines} · ` +
      `adCreatives ${baseline.adCreatives} · campaignConcepts ${baseline.concepts}\n`);

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step4b-assembly-proof.ts. Safe to delete.",
    targetCustomer: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome, painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome,
    frustrations: "scope creeps between the call and the proposal",
    objections: "my clients would never agree to a retainer",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`throwaway service ${serviceId} · ICP ${icpId}`);

  // ── concepts ──────────────────────────────────────────────────────────────
  say("\ngenerating concepts (polling up to 12 minutes)…");
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  const tC = Date.now();
  while (Date.now() - tC < 12 * 60 * 1000) {
    concepts = await db.select({
        id: campaignConcepts.id, awareness: campaignConcepts.awareness, desire: campaignConcepts.desire,
      })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId)).orderBy(campaignConcepts.id);
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  if (!concepts.length) throw new Error("no concepts — assembly would have nothing to key on");
  say(`concepts: ${concepts.length}`);
  for (const c of concepts) say(`   concept ${c.id} [${c.awareness}] — ${String(c.desire).slice(0, 70)}`);

  // ── Node 7 ────────────────────────────────────────────────────────────────
  say("\nrunning Node 7 (ad copy) — gated headlines, bodies and image hooks…");
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  say(`adSet ${copyRes.adSetId}: headlines ${copyRes.headlineCount} · bodies ${copyRes.bodyCount} · hooks ${copyRes.imageHookCount}`);

  // ── the real four-creative cascade, with the new concept-keyed hook deal ──
  say("\nrendering the tabloid cascade (real images — three Cloudinary objects each)…");
  const tR = Date.now();
  await runAdCreativesGeneration({
    userId: USER_ID, serviceId, niche: "operations consulting",
    productName: "The Scope-First Sequence", uniqueMechanism: BRIEF.uniqueMechanism,
    targetAudience: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome,
    pressingProblem: BRIEF.pressingProblem, adType: "lead_gen",
  } as any);
  say(`rendered in ${((Date.now() - tR) / 1000).toFixed(1)}s`);

  const creatives: any[] = await db
    .select({
      id: adCreatives.id, batchId: adCreatives.batchId, designStyle: adCreatives.designStyle,
      variationNumber: adCreatives.variationNumber, headline: adCreatives.headline,
      headlineAdCopyId: adCreatives.headlineAdCopyId, conceptId: adCreatives.conceptId,
      hookAdCopyId: adCreatives.hookAdCopyId, imageUrl: adCreatives.imageUrl,
    })
    .from(adCreatives)
    .where(and(eq(adCreatives.userId, USER_ID), eq(adCreatives.serviceId, serviceId)))
    .orderBy(adCreatives.variationNumber);
  const batchId = creatives[0]?.batchId;
  if (!batchId) throw new Error("no creatives were produced — nothing to measure");

  // ── SAVE THE COMPOSITES BEFORE ANYTHING IS SWEPT ──────────────────────────
  // Teardown outranks the artefact read, and the composited URL lives only on the row.
  say("\n" + "─".repeat(78));
  say("SAVING COMPOSITES TO DISK (before any teardown)");
  rule();
  mkdirSync(IMG_DIR, { recursive: true });
  for (const c of creatives) {
    const blank = c.hookAdCopyId == null;
    const name = `slot-${c.variationNumber}-${c.designStyle}-creative-${c.id}${blank ? "-BLANK-HOOK-BAND" : ""}.png`;
    try {
      const res = await fetch(String(c.imageUrl));
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(IMG_DIR, name), buf);
      say(`   saved ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e: any) {
      say(`   🔴 could NOT save creative ${c.id}: ${String(e?.message ?? e)}`);
    }
  }
  say(`\nimages: ${IMG_DIR}`);

  // ── 1: the hook is dealt BY CONCEPT ───────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("1 — THE A-vs-B GAP, RE-MEASURED BY ID (step 3 measured 3 of 4 DISAGREEING)");
  rule();
  const hookRows: any[] = await db
    .select({ id: adCopy.id, conceptId: adCopy.conceptId, content: adCopy.content })
    .from(adCopy)
    .where(and(eq(adCopy.userId, USER_ID), eq(adCopy.serviceId, serviceId), eq(adCopy.contentType, "image_hook")));
  const hookById = new Map<number, any>(hookRows.map((h) => [Number(h.id), h]));
  say(`image_hook rows generated: ${hookRows.length} for ${AD_VARIATIONS.length} slots`);
  let agree = 0, disagree = 0, noLine = 0;
  for (const c of creatives) {
    const hook = c.hookAdCopyId == null ? null : hookById.get(Number(c.hookAdCopyId));
    const hookConcept = hook?.conceptId == null ? null : Number(hook.conceptId);
    const headConcept = c.conceptId == null ? null : Number(c.conceptId);
    let verdict: string;
    if (c.hookAdCopyId == null) { noLine++; verdict = "NO HOOK LINE (blank band)"; }
    else if (hookConcept != null && headConcept != null && hookConcept === headConcept) { agree++; verdict = "AGREE ✅"; }
    else { disagree++; verdict = "DISAGREE 🔴"; }
    say(`   slot ${c.variationNumber} creative ${c.id}: headline-concept ${headConcept ?? "NULL"} · ` +
        `hook row ${c.hookAdCopyId ?? "none"} concept ${hookConcept ?? "n/a"} → ${verdict}`);
  }
  say("");
  say(`agree ${agree} · disagree ${disagree} · no-line ${noLine} of ${creatives.length}`);
  say("⚠️ A no-line slot is the INTENDED behaviour of a short hook deck, not a failure: the deal");
  say("   never repeats a row, so a slot with nothing left bakes no hook rather than duplicating");
  say("   one already on another picture. Judge those pixels — the file names flag them.");

  // ── 2: stamp disagreement, surfaced as a defect ───────────────────────────
  say("\n" + "─".repeat(78));
  say("2 — HEADLINE-TO-CONCEPT STAMP DISAGREEMENT (a DEFECT if non-zero)");
  rule();
  const copyRows: any[] = await db
    .select({ id: adCopy.id, conceptId: adCopy.conceptId, contentType: adCopy.contentType, awareness: adCopy.awareness })
    .from(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  const copyConceptById = new Map<number, number | null>(
    copyRows.map((r) => [Number(r.id), r.conceptId == null ? null : Number(r.conceptId)]));
  let stampMismatch = 0;
  for (const c of creatives) {
    const via = c.headlineAdCopyId == null ? undefined : copyConceptById.get(Number(c.headlineAdCopyId));
    const ok = c.conceptId != null && via != null && Number(c.conceptId) === Number(via);
    if (!ok) stampMismatch++;
    say(`   creative ${c.id}: conceptId=${c.conceptId ?? "NULL"} · headlineAdCopyId=${c.headlineAdCopyId ?? "NULL"} ` +
        `→ that row's concept=${via ?? "n/a"} ${ok ? "✅" : "🔴 DEFECT"}`);
  }
  say("");
  say(stampMismatch === 0
    ? "✅ zero stamp disagreements — every picture's concept equals its headline row's concept."
    : `🔴 ${stampMismatch} STAMP DISAGREEMENT(S) — a defect in the step-3 stamp, not something assembly repairs.`);

  // ── 3: ASSEMBLY + the coherence yield ─────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("3 — ASSEMBLY (read-only) AND THE COHERENCE YIELD");
  rule();
  const { ads, ledger } = await assembleConceptAds(db, USER_ID, serviceId, { batchId });
  say(describeAssembly(ledger));
  say("");
  say(`ASSEMBLED ADS: ${ads.length}`);
  for (const a of ads) {
    say(`   ── ad on concept ${a.conceptId} [${a.awareness}]`);
    say(`      headline  adCopy ${a.headline.id} [${a.headline.awareness}] concept ${a.headline.conceptId} — "${a.headline.text.slice(0, 60)}"`);
    say(`      body      adCopy ${a.body.id} [${a.body.awareness}] concept ${a.body.conceptId} — "${a.body.text.slice(0, 60)}"`);
    say(`      picture   creative ${a.creative.id} slot ${a.creative.variationNumber}`);
    say(`      hook      row ${a.hook.adCopyId ?? "none"} concept ${a.hook.conceptId ?? "n/a"} → ${a.hook.agreement}`);
  }

  say("");
  say("COHERENCE YIELD — of the concepts that reached the deck:");
  say(`   concepts generated for this ICP : ${concepts.length}`);
  say(`   concepts present in the deck    : ${ledger.conceptsSeen}`);
  say(`   → produced a COMPLETE coherent ad: ${ledger.coherenceYield.conceptsWithAd}`);
  say(`   → shipped short / dropped        : ${ledger.coherenceYield.conceptsWithoutAd}`);
  say(`   bodies consumed                  : ${ledger.gatedPool.bodiesConsumed} of ${ledger.gatedPool.bodies} gated`);
  say(`   creatives seen / eligible        : ${ledger.creativesSeen} / ${ledger.creativesEligible}`);
  say("");
  if (ledger.drops.length === 0) say("   (no drops)");
  else {
    say("   EVERY DROP, WITH ITS REASON:");
    for (const d of ledger.drops) {
      say(`     · ${d.reason}` +
          `${d.conceptId != null ? ` · concept ${d.conceptId}` : ""}` +
          `${d.creativeId != null ? ` · creative ${d.creativeId}` : ""}` +
          `${d.detail ? ` — ${d.detail}` : ""}`);
    }
  }
  say("");
  say(`   hook agreement across assembled ads: match ${ledger.hookAgreement.match} · ` +
      `mismatch ${ledger.hookAgreement.mismatch} · unknown ${ledger.hookAgreement.unknown}`);
  say(`   stamp disagreements surfaced by assembly: ${ledger.conceptStampMismatches.length}`);
  for (const m of ledger.conceptStampMismatches) {
    say(`     🔴 creative ${m.creativeId}: stamped ${m.creativeConceptId}, headline row says ${m.headlineConceptId}`);
  }

  // A body must never appear on two ads. Checked here rather than trusted.
  const bodyIds = ads.map((a) => a.body.id);
  const creativeIds = ads.map((a) => a.creative.id);
  const headlineIds = ads.map((a) => a.headline.id);
  say("");
  say(`${new Set(bodyIds).size === bodyIds.length ? "✅" : "🔴"} every ad has its OWN body (${bodyIds.join(", ") || "none"})`);
  say(`${new Set(headlineIds).size === headlineIds.length ? "✅" : "🔴"} every ad has its OWN headline (${headlineIds.join(", ") || "none"})`);
  say(`${new Set(creativeIds).size === creativeIds.length ? "✅" : "🔴"} every ad has its OWN picture (${creativeIds.join(", ") || "none"})`);
  const stagesOk = ads.every((a) => a.headline.awareness === a.body.awareness);
  say(`${stagesOk ? "✅" : "🔴"} every ad's headline and body share one awareness stage`);

  say("");
  say("🔒 NO META CALL WAS MADE — this script imports no Meta module and publishes nothing.");

  // ── TEARDOWN — Cloudinary first, creatives before concepts ────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — Cloudinary objects, then creatives, then copy, then concepts");
  rule();
  const sweep = await sweepAdCreativeBatch(db, batchId, USER_ID);
  say(`sweep: rowsFound ${sweep.rowsFound} · rowsDeleted ${sweep.rowsDeleted} · ` +
    `public_ids ${sweep.publicIds.length} · cloudinaryDeleted ${sweep.cloudinaryDeleted} · ` +
    `cloudinaryFailed ${sweep.cloudinaryFailed.length}`);
  for (const f of sweep.cloudinaryFailed) say(`   🔴 cloudinary NOT deleted: ${f}`);
  const expectedObjects = creatives.length * 3;
  say(`${sweep.cloudinaryDeleted === expectedObjects ? "✅" : "🔴"} cloudinary ` +
    `${sweep.cloudinaryDeleted}/${expectedObjects} objects cleared (3 per creative)`);

  await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  await db.delete(campaignConcepts).where(and(eq(campaignConcepts.userId, USER_ID), eq(campaignConcepts.icpId, icpId)));
  await db.execute(sql`DELETE FROM jobs WHERE id = ${conceptJobId(icpId)}`);
  await db.delete(idealCustomerProfiles).where(and(eq(idealCustomerProfiles.userId, USER_ID), eq(idealCustomerProfiles.id, icpId)));
  await db.delete(services).where(and(eq(services.userId, USER_ID), eq(services.id, serviceId)));

  const after = {
    adCopy: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCopy))[0].n),
    headlines: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(headlines))[0].n),
    adCreatives: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCreatives))[0].n),
    concepts: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(campaignConcepts))[0].n),
  };
  const protectedRows: any = await db.execute(sql`
    SELECT serviceId, COUNT(*) n FROM adCreatives WHERE serviceId IN (272,273,274,275,276,277,285) GROUP BY serviceId
  `);
  const pr = (Array.isArray(protectedRows) ? protectedRows[0] : (protectedRows as any)?.rows ?? protectedRows) as any[];
  const protectedTotal = (pr ?? []).reduce((a: number, r: any) => a + Number(r.n), 0);
  say("");
  say(`adCopy          ${after.adCopy} ${after.adCopy === baseline.adCopy ? "✅" : "🔴"} (baseline ${baseline.adCopy})`);
  say(`headlines       ${after.headlines} ${after.headlines === baseline.headlines ? "✅" : "🔴"} (baseline ${baseline.headlines})`);
  say(`adCreatives     ${after.adCreatives} ${after.adCreatives === baseline.adCreatives ? "✅" : "🔴"} (baseline ${baseline.adCreatives})`);
  say(`campaignConcepts ${after.concepts} ${after.concepts === baseline.concepts ? "✅" : "🔴"} (baseline ${baseline.concepts})`);
  say(`protected services total ${protectedTotal} ${protectedTotal === 29 ? "✅" : "🔴"} (expected 29) — ` +
    (pr ?? []).map((r: any) => `${r.serviceId}:${r.n}`).join(" "));
  say(`\nimages: ${IMG_DIR}`);
  say(`log: ${LOG}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[step4b-assembly-proof] FAILED:", e);
  process.exit(1);
});
