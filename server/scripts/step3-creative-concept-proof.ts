/**
 * step3-creative-concept-proof.ts — the image-side concept stamp, proven on a real render.
 *
 * ⚠️ REQUIRES MIGRATION 0102. It stamps a column; without the column there is nothing to
 * measure. The script checks for it and refuses rather than producing a misleading green run.
 *
 * ⚠️ THIS ONE RENDERS. Every creative writes THREE Cloudinary objects (source, raw,
 * composited), so teardown goes through `sweepAdCreativeBatch` — read the ids, delete the
 * objects, then delete the rows — and creatives are torn down BEFORE their concepts, because
 * the new FK is ON DELETE SET NULL and would otherwise blank every stamp this run exists to
 * measure. Nothing is published to Meta.
 *
 * WHAT IT MEASURES:
 *   1. Every creative stamped; every conceptId resolves to a concept in THIS ICP's set;
 *      zero dangling, zero pointing outside the set.
 *   2. Each stamp EQUALS the concept of the adCopy row named by `headlineAdCopyId` —
 *      established by joining on ids. No text is compared anywhere.
 *   3. The render deck is otherwise UNDISTURBED: four slots, the same style sequence, and a
 *      Layer 1+2+3 plan line identical to the pre-change deck. This is the plumbing-only
 *      claim and it is the one that could fail quietly.
 *   4. THE A-vs-B GAP — "the concept whose headline this picture bakes" (what we stamp)
 *      versus "the concept the whole picture descends from". The on-picture hook line comes
 *      from a separately-chosen image_hook row, so the two can disagree. Slot i's hook is the
 *      i-th of the four highest-id image_hook rows, which is exactly how `resolveAdBodyTexts`
 *      picks it — so the comparison is derivable FROM IDS ALONE and needs no text matching.
 *
 * Usage:  npx tsx server/scripts/step3-creative-concept-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCreatives, adCopy, services, idealCustomerProfiles, campaignConcepts, headlines } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runAdCreativesGeneration } from "../adCreativesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { sweepAdCreativeBatch } from "../lib/adCreativeTeardown";
import { AD_VARIATIONS } from "../_core/adVariations";
import { awarenessDeckPlan, subTypePlanFor, visibilityTierPlanFor } from "../_core/conceptAxis";

const LOG = `/tmp/step3-creative-concept-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-STEP3-CREATIVE-CONCEPT — throwaway, safe to delete";

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
  say("STEP 3 — the creative records the concept whose headline it bakes");
  say(`user ${USER_ID} · plumbing only: the image deck must come back UNCHANGED`);
  rule("═");

  // Pre-flight: without 0102 every stamp is a silent no-op and the run would "pass" green.
  const col: any = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adCreatives' AND COLUMN_NAME = 'conceptId'
  `).then((r: any) => (Array.isArray(r) ? r[0] : r?.rows ?? r));
  if (!(Array.isArray(col) ? col[0] : col)) {
    throw new Error("migration 0102 is NOT applied — adCreatives has no conceptId column. Refusing to run.");
  }
  say("✅ migration 0102 present\n");

  const baseline = {
    adCopy: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCopy))[0].n),
    headlines: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(headlines))[0].n),
    adCreatives: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCreatives))[0].n),
  };
  say(`baseline BEFORE: adCopy ${baseline.adCopy} · headlines ${baseline.headlines} · adCreatives ${baseline.adCreatives}\n`);

  // ── THE EXPECTED DECK, computed BEFORE the run from the same functions the generator
  // uses. Recording the expectation up front is what makes "undisturbed" checkable rather
  // than a thing asserted after the fact against whatever happened.
  const expectedAwareness = awarenessDeckPlan(AD_VARIATIONS.length);
  const expectedSubType = subTypePlanFor(expectedAwareness);
  const expectedVisibility = visibilityTierPlanFor(expectedAwareness, expectedSubType);
  const expectedPlanLine = AD_VARIATIONS
    .map((v, i) => `${v.style}=${expectedAwareness[i]}/${expectedSubType[i]}/${expectedVisibility[i]}`)
    .join(" ");
  const expectedStyles = AD_VARIATIONS.map((v) => v.style).join(", ");
  say(`EXPECTED plan line : ${expectedPlanLine}`);
  say(`EXPECTED styles    : ${expectedStyles}\n`);

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step3-creative-concept-proof.ts. Safe to delete.",
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
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  while (Date.now() - tC < 12 * 60 * 1000) {
    concepts = await db.select({ id: campaignConcepts.id, awareness: campaignConcepts.awareness, desire: campaignConcepts.desire })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId)).orderBy(campaignConcepts.id);
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  if (!concepts.length) throw new Error("no concepts — the creative would have nothing to descend from");
  say(`concepts: ${concepts.length}`);
  for (const c of concepts) say(`   concept ${c.id} [${c.awareness}]`);

  // ── Node 7, so gated headlines and image hooks exist ──────────────────────
  say("\nrunning Node 7 (ad copy) so gated headlines and image hooks exist…");
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  say(`adSet ${copyRes.adSetId}: headlines ${copyRes.headlineCount} · bodies ${copyRes.bodyCount} · hooks ${copyRes.imageHookCount}`);

  // ── the real four-creative cascade ────────────────────────────────────────
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
      imageUrl: adCreatives.imageUrl, rawImageUrl: adCreatives.rawImageUrl, sourceImageUrl: adCreatives.sourceImageUrl,
    })
    .from(adCreatives)
    .where(and(eq(adCreatives.userId, USER_ID), eq(adCreatives.serviceId, serviceId)))
    .orderBy(adCreatives.variationNumber);
  const batchId = creatives[0]?.batchId;
  if (!batchId) throw new Error("no creatives were produced — nothing to measure");

  // ── 1 + 2: stamped, resolving, and equal to the headline row's concept ────
  say("\n" + "─".repeat(78));
  say("1 + 2 — EVERY CREATIVE STAMPED, EVERY CONCEPT RESOLVING, STAMP == HEADLINE ROW'S CONCEPT");
  rule();
  const conceptIds = new Set(concepts.map((c: any) => Number(c.id)));
  const copyRows: any[] = await db
    .select({ id: adCopy.id, conceptId: adCopy.conceptId, contentType: adCopy.contentType })
    .from(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  const copyConceptById = new Map<number, number | null>(copyRows.map((r) => [Number(r.id), r.conceptId == null ? null : Number(r.conceptId)]));

  let stamped = 0, unstamped = 0, dangling = 0, joinMismatch = 0;
  for (const c of creatives) {
    const viaHeadline = c.headlineAdCopyId == null ? undefined : copyConceptById.get(Number(c.headlineAdCopyId));
    const okJoin = c.conceptId != null && viaHeadline != null && Number(c.conceptId) === Number(viaHeadline);
    if (c.conceptId == null) unstamped++;
    else if (!conceptIds.has(Number(c.conceptId))) { dangling++; }
    else stamped++;
    if (c.conceptId != null && !okJoin) joinMismatch++;
    say(`   creative ${c.id} slot ${c.variationNumber} [${c.designStyle}] ` +
      `conceptId=${c.conceptId ?? "NULL"} · headlineAdCopyId=${c.headlineAdCopyId ?? "NULL"} ` +
      `→ that row's concept=${viaHeadline ?? "n/a"} ${okJoin ? "✅" : "🔴"}`);
  }
  say("");
  say(`creatives ${creatives.length} · stamped ${stamped} · unstamped ${unstamped} · DANGLING ${dangling} · JOIN-MISMATCH ${joinMismatch}`);
  say(stamped === creatives.length && dangling === 0 && joinMismatch === 0
    ? "✅ PASS — every creative carries a concept that resolves, and equals its headline row's concept."
    : "🔴 FAIL — see above.");

  // ── 3: the deck is otherwise undisturbed ─────────────────────────────────
  say("\n" + "─".repeat(78));
  say("3 — THE RENDER DECK IS OTHERWISE UNDISTURBED (the plumbing-only claim)");
  rule();
  const gotStyles = creatives.map((c) => c.designStyle).join(", ");
  const slotsOk = creatives.length === AD_VARIATIONS.length;
  const stylesOk = gotStyles === expectedStyles;
  say(`${slotsOk ? "✅" : "🔴"} slot count ${creatives.length} (expected ${AD_VARIATIONS.length})`);
  say(`${stylesOk ? "✅" : "🔴"} style sequence: ${gotStyles}`);
  say(`   expected      : ${expectedStyles}`);
  say(`EXPECTED plan line: ${expectedPlanLine}`);
  say("⚠️ compare against the `[adCreativesGenerator] LAYER1+2+3 plan:` line in the run output —");
  say("   it is emitted by the generator and must match the expected line above CHARACTER FOR CHARACTER.");

  // ── 4: the A-vs-B gap ─────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("4 — A-vs-B GAP: the headline's concept vs the concept the whole picture descends from");
  rule();
  // Slot i's hook is the i-th of the four highest-id image_hook rows — exactly how
  // resolveAdBodyTexts picks it. Derived from ids, never by matching the composited text.
  const hookRows: any[] = await db
    .select({ id: adCopy.id, conceptId: adCopy.conceptId })
    .from(adCopy)
    .where(and(eq(adCopy.userId, USER_ID), eq(adCopy.serviceId, serviceId), eq(adCopy.contentType, "image_hook")))
    .orderBy(desc(adCopy.id))
    .limit(AD_VARIATIONS.length);
  let agree = 0, disagree = 0, undetermined = 0;
  creatives.forEach((c, i) => {
    const hook = hookRows[i % (hookRows.length || 1)];
    const hookConcept = hook?.conceptId == null ? null : Number(hook.conceptId);
    const headConcept = c.conceptId == null ? null : Number(c.conceptId);
    if (hookConcept == null || headConcept == null) { undetermined++; }
    else if (hookConcept === headConcept) agree++;
    else disagree++;
    say(`   slot ${c.variationNumber}: headline-concept ${headConcept ?? "NULL"} · ` +
      `hook row ${hook?.id ?? "n/a"} concept ${hookConcept ?? "NULL"} · ` +
      `${hookConcept != null && headConcept != null ? (hookConcept === headConcept ? "AGREE" : "DISAGREE") : "undetermined"}`);
  });
  say("");
  say(`agree ${agree} · disagree ${disagree} · undetermined ${undetermined} of ${creatives.length}`);
  say("This is a MEASUREMENT, not a pass/fail. Disagreement is the expected state today: the");
  say("headline and the hook are dealt independently, so a picture can carry words from two");
  say("concepts. The number is what step 4 needs in order to decide whether pairing an image to");
  say("its copy by the stamped concept is sufficient, or whether the hook must be paired too.");

  // ── TEARDOWN — Cloudinary first, creatives before concepts ────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — Cloudinary objects, then creatives, then copy, then concepts");
  rule();
  const sweep = await sweepAdCreativeBatch(db, batchId, USER_ID);
  say(`sweep: rowsFound ${sweep.rowsFound} · rowsDeleted ${sweep.rowsDeleted} · ` +
    `public_ids ${sweep.publicIds.length} · cloudinaryDeleted ${sweep.cloudinaryDeleted} · ` +
    `cloudinaryFailed ${sweep.cloudinaryFailed.length}`);
  for (const f of sweep.cloudinaryFailed) say(`   🔴 cloudinary NOT deleted: ${f}`);
  // THREE objects per creative is the expectation (source, raw, composited). Anything less
  // means one leaked — the failure class the teardown helper exists to prevent.
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
  };
  const protectedRows: any = await db.execute(sql`
    SELECT serviceId, COUNT(*) n FROM adCreatives WHERE serviceId IN (272,273,274,275,276,277,285) GROUP BY serviceId
  `);
  const pr = (Array.isArray(protectedRows) ? protectedRows[0] : (protectedRows as any)?.rows ?? protectedRows) as any[];
  const protectedTotal = (pr ?? []).reduce((a: number, r: any) => a + Number(r.n), 0);
  say("");
  say(`adCopy      ${after.adCopy} ${after.adCopy === baseline.adCopy ? "✅" : "🔴"} (baseline ${baseline.adCopy})`);
  say(`headlines   ${after.headlines} ${after.headlines === baseline.headlines ? "✅" : "🔴"} (baseline ${baseline.headlines})`);
  say(`adCreatives ${after.adCreatives} ${after.adCreatives === baseline.adCreatives ? "✅" : "🔴"} (baseline ${baseline.adCreatives})`);
  say(`protected services total ${protectedTotal} ${protectedTotal === 29 ? "✅" : "🔴"} (expected 29) — ` +
    (pr ?? []).map((r: any) => `${r.serviceId}:${r.n}`).join(" "));
  say(`\nlog: ${LOG}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[step3-creative-concept-proof] FAILED:", e);
  process.exit(1);
});
