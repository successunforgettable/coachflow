/**
 * step2b-concept-awareness-proof.ts — awareness is concept-derived, proven live on both nodes.
 *
 * WHAT THIS HAS TO SHOW, in the order the risk actually sits:
 *
 *   0. THE TOP-UP RESTORED A KILLED STAGE. The concept set is the deck's awareness source now,
 *      so a stage the concept gate kills is a stage that vanishes from every headline, body,
 *      hook and link. Reported against the target mix, not against "did it run".
 *   1. THE DECK IS COHERENT. Every kept row must descend from the concept it names — the
 *      stamped concept's desire AND awareness compared against the row's own, not a non-null
 *      check. A stamp that points at the wrong concept is worse than no stamp.
 *   2. THE GATE'S DESIRE AXIS IS KEYED ON conceptId. Printed from the pool the gate actually
 *      received, so it is shown rather than argued.
 *   3. THE DECK SHAPE AND ITS AWARENESS BANDS. The totals are band-capped, so the number to
 *      watch is the stage mix inside them and whether any surface fell under its floor.
 *   4. NODE 6 IS UNCHANGED — a non-regression run, since step 2b deliberately does not touch it.
 *
 * ⚠️ WRITES TO PRODUCTION on a labelled throwaway, then TEARS DOWN id-scoped and reconciles.
 * Renders no images, so no Cloudinary object is created — verified by checking adCreatives
 * rather than assumed.
 *
 * Usage:  npx tsx server/scripts/step2b-concept-awareness-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, services, idealCustomerProfiles, campaignConcepts, headlines, adCreatives } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { formatLedger, type GateLedger } from "../_core/pdafGate";
import { AWARENESS_STAGES, awarenessPlanForCount, DEFAULT_CONCEPT_COUNT } from "../_core/conceptAxis";

const LOG = `/tmp/step2b-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-STEP2B-CONCEPT-AWARENESS — throwaway, safe to delete";

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

const mixOf = (stages: Array<string | null>) =>
  AWARENESS_STAGES.map((s) => `${s.replace(/_aware/, "")}:${stages.filter((x) => x === s).length}`).join(" ");

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("STEP 2b — awareness is CONCEPT-DERIVED, dedupe removed, top-up restores a killed stage");
  say(`user ${USER_ID}`);
  rule("═");

  const baseline = {
    adCopy: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCopy))[0].n),
    headlines: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(headlines))[0].n),
    adCreatives: Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCreatives))[0].n),
  };
  say(`baseline BEFORE: adCopy ${baseline.adCopy} · headlines ${baseline.headlines} · adCreatives ${baseline.adCreatives}\n`);

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step2b-concept-awareness-proof.ts. Safe to delete.",
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

  // ── PROOF 0: the concept set, and whether the top-up restored a killed stage ─
  say("\ngenerating concepts (polling up to 12 minutes)…");
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  while (Date.now() - tC < 12 * 60 * 1000) {
    concepts = await db
      .select({ id: campaignConcepts.id, desire: campaignConcepts.desire, awareness: campaignConcepts.awareness })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId)).orderBy(campaignConcepts.id);
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  say(`concepts landed: ${concepts.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  if (!concepts.length) throw new Error("no concepts — the deck would take the fallback and this proof would measure the wrong path");
  for (const c of concepts) say(`   concept ${c.id} [${c.awareness}] "${String(c.desire).slice(0, 58)}"`);

  say("\n" + "─".repeat(78));
  say("PROOF 0 — THE TOP-UP: no stage the target mix asks for is left at zero");
  rule();
  const target = awarenessPlanForCount(DEFAULT_CONCEPT_COUNT);
  const setStages = concepts.map((c: any) => String(c.awareness));
  say(`target mix  : ${mixOf(target)}`);
  say(`set delivered: ${mixOf(setStages)}   (${concepts.length}/${DEFAULT_CONCEPT_COUNT} concepts)`);
  const killed = AWARENESS_STAGES.filter(
    (s) => target.filter((t) => t === s).length > 0 && setStages.filter((x) => x === s).length === 0,
  );
  say(killed.length === 0
    ? "✅ every stage the target mix asks for has at least one concept"
    : `🔴 stage(s) still at zero after the top-up: ${killed.join(", ")} — see the top-up log line above for why`);

  // ── NODE 7 ────────────────────────────────────────────────────────────────
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  const pools: any = (globalThis as any).__ZAP_LAST_PDAF_POOLS__;
  const coherence: any = (globalThis as any).__ZAP_LAST_CONCEPT_COHERENCE__;

  // ── PROOF 2 (printed before the shape, because it is the load-bearing one) ──
  say("\n" + "─".repeat(78));
  say("PROOF 2 — THE GATE'S DESIRE AXIS IS KEYED ON conceptId, NOT ON DESIRE TEXT");
  rule();
  const poolDesires: string[] = pools?.desires ?? [];
  const allConceptKeyed = poolDesires.length > 0 && poolDesires.every((d) => /^concept:\d+$/.test(d));
  const poolIds = poolDesires.map((d) => Number(d.split(":")[1]));
  const idsMatchSet = poolIds.length === concepts.length
    && poolIds.every((id) => concepts.some((c: any) => Number(c.id) === id));
  say(`pool.desires (${poolDesires.length}) = ${poolDesires.join(", ")}`);
  say(`${allConceptKeyed ? "✅" : "🔴"} every pool entry is a concept id, not a desire string`);
  say(`${poolIds.length === new Set(poolIds).size ? "✅" : "🔴"} pool entries are unique — keyed on identity, so no text de-duplication`);
  say(`${idsMatchSet ? "✅" : "🔴"} pool has ONE entry per concept in this ICP's set (${poolIds.length}/${concepts.length}) — nothing merged away`);
  say(`pool.awarenessPlan mix = ${mixOf(pools?.awarenessPlan ?? [])}  (the plan the gate repairs toward)`);

  // ── PROOF 1: coherence ────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PROOF 1 — EVERY KEPT ROW DESCENDS FROM THE CONCEPT IT NAMES (desire AND awareness)");
  rule();
  const rows: any[] = await db
    .select({ id: adCopy.id, contentType: adCopy.contentType, desire: adCopy.desire,
              awareness: adCopy.awareness, conceptId: adCopy.conceptId })
    .from(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  const byConcept = new Map<number, any>(concepts.map((c: any) => [Number(c.id), c]));
  const counted = rows.filter((r) => r.contentType !== "link");
  let stamped = 0, unstamped = 0, desireMismatch = 0, stageMoved = 0, dangling = 0;
  const samples: string[] = [];
  for (const r of counted) {
    if (r.conceptId == null) { unstamped += 1; continue; }
    const c = byConcept.get(Number(r.conceptId));
    if (!c) { dangling += 1; samples.push(`   🔴 row ${r.id} → concept ${r.conceptId} NOT in this ICP's set`); continue; }
    stamped += 1;
    if (String(c.desire).trim() !== String(r.desire ?? "").trim()) {
      desireMismatch += 1;
      samples.push(`   🔴 row ${r.id} desire ≠ concept ${c.id}'s desire`);
    }
    if (String(c.awareness) !== String(r.awareness ?? "")) {
      stageMoved += 1;
      samples.push(`   ⚠️  row ${r.id} [${r.awareness}] vs concept ${c.id} [${c.awareness}] — moved by the gate`);
    } else if (samples.filter((s) => s.startsWith("   ✅")).length < 5) {
      samples.push(`   ✅ ${String(r.contentType).padEnd(10)} row ${r.id} → concept ${c.id} [${c.awareness}]`);
    }
  }
  for (const s of samples.slice(0, 24)) say(s);
  say("");
  say(`counted rows (headline/body/image_hook): ${counted.length}`);
  say(`stamped ${stamped} · unstamped ${unstamped} · DESIRE-MISMATCH ${desireMismatch} · DANGLING ${dangling} · stage-moved-by-gate ${stageMoved}`);
  say(`in-generator coherence counter: ${coherence ? JSON.stringify(coherence) : "(absent)"}`);
  const distinct = new Set(counted.map((r) => r.conceptId).filter((v) => v != null));
  say(`distinct concepts represented: ${distinct.size} of ${concepts.length}`);
  say(desireMismatch === 0 && dangling === 0 && stamped > 0
    ? "✅ PASS — no row names a concept it does not descend from."
    : "🔴 FAIL — see above.");
  say(stageMoved === 0
    ? "✅ every kept row also still carries its concept's OWN stage — the gate moved none of them."
    : `⚠️  ${stageMoved} row(s) were moved to a different stage by the distinctness gate. Legitimate: the row still records which concept supplied its desire, but it is no longer a whole-concept instance.`);

  // ── PROOF 3: deck shape + awareness bands ─────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PROOF 3 — DECK SHAPE AND ITS AWARENESS BANDS");
  rule();
  say(ledger ? formatLedger(ledger) : "🔴 NO LEDGER");
  const bySurface = ledger?.bySurface ?? {};
  const kept = (s: string) => bySurface[s]?.kept ?? 0;
  say("");
  say(`KEPT: headline ${kept("headline")} · body ${kept("body")} · image_hook ${kept("image_hook")}   (2a baseline was 12/12/4)`);
  for (const s of ["headline", "body", "image_hook", "link"]) {
    const stages = rows.filter((r) => r.contentType === s).map((r) => String(r.awareness ?? "null"));
    if (stages.length) say(`   ${s.padEnd(11)} n=${String(stages.length).padStart(2)}  ${mixOf(stages)}`);
  }
  say("");
  say(`collapsing pairs: ${ledger?.collapsingPairsBefore} before → ${ledger?.collapsingPairsAfter} after`);
  say(`${(ledger?.surfacesBelowFloor ?? ["x"]).length === 0 ? "✅" : "🔴"} every surface at or above floor` +
    `${(ledger?.surfacesBelowFloor ?? []).length ? ` — below: ${(ledger!.surfacesBelowFloor as any[]).join(", ")}` : ""}`);

  // ── PROOF 4: Node 6 non-regression ────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PROOF 4 — NODE 6 NON-REGRESSION (step 2b does not touch headlinesGenerator)");
  rule();
  const hRes: any = await runHeadlinesGeneration({ userId: USER_ID, serviceId, ...BRIEF } as any);
  const hLedger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  say(hLedger ? formatLedger(hLedger) : "🔴 NO LEDGER");
  const hRows: any[] = await db.select({ id: headlines.id, awareness: headlines.awareness })
    .from(headlines).where(eq(headlines.headlineSetId, hRes.headlineSetId));
  const hSurface = hLedger?.bySurface?.["headline"];
  say("");
  say(`persisted ${hRows.length} · ledger KEPT ${hLedger?.keptCount} · returned ${hRes.count}`);
  say(`${hSurface?.meetsFloor ? "✅" : "🔴"} headline surface at or above floor — KEPT ${hSurface?.kept}/band ${hSurface?.bandMin}-${hSurface?.bandMax}`);
  say(`${hRows.length === hLedger?.keptCount ? "✅" : "🔴"} ledger KEPT equals rows in the database`);
  say(`awareness bands: ${mixOf(hRows.map((r) => String(r.awareness ?? "null")))}`);
  say(`collapsing pairs: ${hLedger?.collapsingPairsBefore} before → ${hLedger?.collapsingPairsAfter} after`);
  say("(Node 6 still takes the cold-weighted plan by design — its table has no conceptId column.)");

  // ── TEARDOWN — executed, id-scoped ────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — id-scoped, executed");
  rule();
  // Nothing rendered, so nothing to sweep — CHECKED, not assumed.
  const creativesNow = Number((await db.select({ n: sql<number>`COUNT(*)` }).from(adCreatives))[0].n);
  say(`adCreatives ${creativesNow} vs baseline ${baseline.adCreatives} — ${creativesNow === baseline.adCreatives
    ? "✅ no creative row was written, so no Cloudinary object exists to sweep"
    : "🔴 creative rows WERE written — sweep Cloudinary via adCreativeTeardown BEFORE deleting them"}`);
  if (creativesNow !== baseline.adCreatives) throw new Error("unexpected adCreatives — stopping before teardown so nothing leaks");

  // adCopy BEFORE the concepts: the FK is ON DELETE SET NULL, so the reverse order would
  // blank every stamp first and the run's own evidence would be destroyed by its cleanup.
  await db.delete(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  await db.delete(headlines).where(and(eq(headlines.userId, USER_ID), eq(headlines.headlineSetId, hRes.headlineSetId)));
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
  console.error("[step2b-proof] FAILED:", e);
  process.exit(1);
});
