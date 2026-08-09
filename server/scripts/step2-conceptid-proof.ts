/**
 * step2-conceptid-proof.ts — the concept-id plumbing and stamp, proven in isolation.
 *
 * THREE THINGS TO SHOW, and the first is the one that could go wrong quietly:
 *
 *   1. THE DECK SHAPE IS UNDISTURBED. Awareness still comes from the cold-weighted
 *      `awarenessPlanForCount`, unchanged by this half. The per-surface deck must come back
 *      the same as the shape already proven twice: headlines 12, bodies 12, hooks 4, zero
 *      collapsing pairs, every surface at or above floor. Anything else means the plumbing
 *      moved something it had no business moving.
 *   2. EVERY GATED ROW CARRIES A conceptId THAT ACTUALLY RESOLVES. Not "the column is
 *      non-null" — the stamped concept's `desire` must EQUAL the row's own `desire`. A
 *      stamp that points at the wrong concept is worse than no stamp, because it looks
 *      complete.
 *   3. NODE 6 IS UNCHANGED. `dealAcrossSlots` turned out to be already generic (`<T>`), so
 *      its signature did NOT change and `headlinesGenerator` was never touched — but that
 *      is a claim to test live rather than argue.
 *
 * Both nodes run against ONE throwaway so the ~7-minute concept generation is paid once.
 *
 * ⚠️ WRITES TO PRODUCTION. Renders nothing, so Cloudinary is not involved. Prints an
 * id-scoped teardown it does NOT execute.
 *
 * Usage:  npx tsx server/scripts/step2-conceptid-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, services, idealCustomerProfiles, campaignConcepts, headlines } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { formatLedger, type GateLedger } from "../_core/pdafGate";

const LOG = `/tmp/step2-conceptid-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-STEP2-CONCEPTID — throwaway, safe to delete";

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
  say("STEP 2 (first half) — conceptId plumbing and stamp");
  say(`user ${USER_ID} · awareness source UNCHANGED (cold-weighted allocation)`);
  rule("═");

  // Pre-flight: 0101 must be applied or every stamp would silently be a no-op column.
  const col: any = await db.execute(sql`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adCopy' AND COLUMN_NAME = 'conceptId'
  `).then((r: any) => (Array.isArray(r) ? r[0] : r?.rows ?? r));
  if (!(Array.isArray(col) ? col[0] : col)) throw new Error("migration 0101 is NOT applied — adCopy has no conceptId column");
  say("✅ migration 0101 present\n");

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by step2-conceptid-proof.ts. Safe to delete.",
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

  say("generating concepts (polling up to 10 minutes)…");
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let concepts: any[] = [];
  while (Date.now() - tC < 10 * 60 * 1000) {
    concepts = await db.select({ id: campaignConcepts.id, desire: campaignConcepts.desire, awareness: campaignConcepts.awareness })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  say(`concepts landed: ${concepts.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  if (!concepts.length) throw new Error("no concepts — the desire axis would fall back and this proof would measure the wrong path");
  for (const c of concepts) say(`   concept ${c.id} [${c.awareness}] "${String(c.desire).slice(0, 60)}"`);

  // ── NODE 7 ────────────────────────────────────────────────────────────────
  const copyRes: any = await runAdCopyGeneration({
    userId: USER_ID, serviceId, adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    targetMarket: BRIEF.targetMarket, productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence", pressingProblem: BRIEF.pressingProblem,
    desiredOutcome: BRIEF.desiredOutcome, uniqueMechanism: BRIEF.uniqueMechanism,
  } as any);
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;

  say("\n" + "─".repeat(78));
  say("PROOF 1 — THE DECK SHAPE IS UNDISTURBED");
  rule();
  say(ledger ? formatLedger(ledger) : "🔴 NO LEDGER");
  const bySurface = ledger?.bySurface ?? {};
  const kept = (s: string) => bySurface[s]?.kept ?? 0;
  const shapeOk = kept("headline") === 12 && kept("body") === 12 && kept("image_hook") === 4;
  const collapseOk = (ledger?.collapsingPairsAfter ?? -1) === 0;
  const floorsOk = (ledger?.surfacesBelowFloor ?? ["x"]).length === 0;
  say("");
  say(`${shapeOk ? "✅" : "🔴"} shape headline 12 / body 12 / hook 4 — got ${kept("headline")}/${kept("body")}/${kept("image_hook")}`);
  say(`${collapseOk ? "✅" : "🔴"} zero collapsing pairs after — got ${ledger?.collapsingPairsAfter}`);
  say(`${floorsOk ? "✅" : "🔴"} every surface at or above floor`);

  // ── PROOF 2: the stamp RESOLVES to the concept whose desire the row carries ─
  say("\n" + "─".repeat(78));
  say("PROOF 2 — conceptId RESOLVES (stamped concept's desire === row's desire)");
  rule();
  const rows: any[] = await db
    .select({ id: adCopy.id, contentType: adCopy.contentType, desire: adCopy.desire,
              awareness: adCopy.awareness, conceptId: adCopy.conceptId, content: adCopy.content })
    .from(adCopy).where(and(eq(adCopy.userId, USER_ID), eq(adCopy.adSetId, copyRes.adSetId)));
  const byConcept = new Map<number, any>(concepts.map((c: any) => [Number(c.id), c]));
  const counted = rows.filter((r) => r.contentType !== "link");
  let stamped = 0, unstamped = 0, mismatched = 0, dangling = 0;
  const samples: string[] = [];
  for (const r of counted) {
    if (r.conceptId == null) { unstamped += 1; continue; }
    stamped += 1;
    const c = byConcept.get(Number(r.conceptId));
    if (!c) { dangling += 1; samples.push(`   🔴 row ${r.id} → concept ${r.conceptId} NOT in this ICP's set`); continue; }
    const match = String(c.desire).trim() === String(r.desire ?? "").trim();
    if (!match) { mismatched += 1; samples.push(`   🔴 row ${r.id} desire "${String(r.desire).slice(0, 45)}" ≠ concept ${c.id} "${String(c.desire).slice(0, 45)}"`); }
    else if (samples.filter((s) => s.startsWith("   ✅")).length < 6) {
      samples.push(`   ✅ ${String(r.contentType).padEnd(10)} row ${r.id} → concept ${c.id} [${c.awareness}] "${String(c.desire).slice(0, 48)}"`);
    }
  }
  for (const s of samples) say(s);
  say("");
  say(`counted rows (headline/body/image_hook): ${counted.length}`);
  say(`stamped ${stamped} · unstamped ${unstamped} · MISMATCHED ${mismatched} · DANGLING ${dangling}`);
  const distinct = new Set(counted.map((r) => r.conceptId).filter((v) => v != null));
  say(`distinct concepts represented: ${distinct.size} of ${concepts.length}`);
  say(mismatched === 0 && dangling === 0 && stamped > 0
    ? "✅ PASS — every stamp resolves to the concept whose desire the row actually carries."
    : "🔴 FAIL — a stamp does not match its own desire; see above.");
  if (unstamped > 0) say(`NOTE: ${unstamped} row(s) unstamped — expected only where the deck-constant fallback supplied the desire.`);

  // ── PROOF 3: Node 6 unchanged ─────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("PROOF 3 — NODE 6 UNCHANGED (dealAcrossSlots was already generic; headlinesGenerator untouched)");
  rule();
  const hRes: any = await runHeadlinesGeneration({ userId: USER_ID, serviceId, ...BRIEF } as any);
  const hLedger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  say(hLedger ? formatLedger(hLedger) : "🔴 NO LEDGER");
  const hRows: any[] = await db.select({ id: headlines.id }).from(headlines).where(eq(headlines.headlineSetId, hRes.headlineSetId));
  const hSurface = hLedger?.bySurface?.["headline"];
  say("");
  say(`persisted ${hRows.length} · ledger KEPT ${hLedger?.keptCount} · returned ${hRes.count}`);
  say(`${hSurface?.meetsFloor ? "✅" : "🔴"} headline surface at or above floor — KEPT ${hSurface?.kept}/band ${hSurface?.bandMin}-${hSurface?.bandMax}`);
  say(`${hRows.length === hLedger?.keptCount ? "✅" : "🔴"} ledger KEPT equals rows in the database`);
  say("(compare against CHECKPOINT §12.11: the ICP-backed Node 6 run kept 12)");

  // ── Teardown, printed only ────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — NOT executed. No images rendered, so Cloudinary is not involved.");
  rule();
  say(`DELETE FROM adCopy WHERE adSetId = '${copyRes.adSetId}' AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM headlines WHERE headlineSetId = '${hRes.headlineSetId}' AND userId = ${USER_ID};   -- ${hRows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${concepts.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};`);
  say("-- ⚠️ adCopy rows must go BEFORE the concepts, or the FK sets their conceptId to NULL first.");
  say("-- Reconcile: adCopy 5424 · headlines 2174 · adCreatives 405 · protected 29");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[step2-conceptid-proof] FAILED:", e);
  process.exit(1);
});
