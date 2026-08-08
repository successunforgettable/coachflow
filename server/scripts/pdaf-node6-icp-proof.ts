/**
 * pdaf-node6-icp-proof.ts — Node 6 re-proof WITH a live desire axis.
 *
 * WHY THIS EXISTS ALONGSIDE `pdaf-node6-proof.ts`. That harness deliberately passes NO
 * serviceId, to keep its footprint to headline rows alone. The cost is that the generator
 * then resolves no ICP, finds no concepts, and falls back to a SINGLE deck-constant desire
 * — and with persona pinned, desire constant and Node 6 unable to move format, only
 * awareness can move. At most one axis can differ, 2-of-4 is unreachable, and recovery is
 * arithmetically impossible. Its 2026-08-08 run showed exactly that: evicted 21,
 * **recovered 0**, KEPT 4 — where 4 is the number of awareness stages, i.e. the ceiling of
 * a mutually-distinct set when P and D are both constant.
 *
 * That run is a correct measurement of the no-service path. It is NOT comparable to the
 * runs recorded at CHECKPOINT §12.6 (which kept 12), because those had a real ICP and 8
 * concepts, so desire was genuinely live. Re-proving the per-surface rework against the
 * no-service path would be comparing two different configurations and calling the
 * difference a regression.
 *
 * This script builds the §12.6 configuration: throwaway service + ICP + concepts, then the
 * REAL runHeadlinesGeneration with a serviceId. Node 6 has ONE surface, so per-surface
 * grouping should be a transparent no-op — that is the claim under test, live rather than
 * argued.
 *
 * ⚠️ WRITES TO PRODUCTION. Prints an id-scoped teardown it does NOT execute.
 *
 * Usage:  npx tsx server/scripts/pdaf-node6-icp-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { headlines, services, idealCustomerProfiles, campaignConcepts } from "../../drizzle/schema";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { formatLedger, type GateLedger } from "../_core/pdafGate";

const LOG = `/tmp/pdaf-node6-icp-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-NODE6-ICP-PROOF — throwaway, safe to delete";

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
  say("NODE 6 — PER-SURFACE RE-PROOF, WITH A LIVE DESIRE AXIS");
  say(`user ${USER_ID} · headline rows + one throwaway service/ICP/concept set`);
  rule("═");

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway service created by pdaf-node6-icp-proof.ts. Safe to delete.",
    targetCustomer: BRIEF.targetMarket, mainBenefit: BRIEF.desiredOutcome, painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  say(`created throwaway service id=${serviceId}`);

  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID, serviceId, name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly and capped by their own calendar.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and that the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome,
    frustrations: "scope creeps between the call and the proposal; the number keeps changing",
    objections: "my clients would never agree to a retainer; my work is genuinely project-shaped",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`created throwaway ICP id=${icpId}`);

  say("generating concepts (non-blocking; polling up to 10 minutes)…");
  const tC = Date.now();
  await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  let conceptRows: any[] = [];
  while (Date.now() - tC < 10 * 60 * 1000) {
    conceptRows = await db.select({ desire: campaignConcepts.desire })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (conceptRows.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
    say(`  …still waiting (${((Date.now() - tC) / 1000).toFixed(0)}s)`);
  }
  say(`concepts landed: ${conceptRows.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  if (conceptRows.length === 0) {
    throw new Error("no concepts landed — the desire axis would fall back to a constant and this proof would measure the wrong path");
  }

  const res: any = await runHeadlinesGeneration({ userId: USER_ID, serviceId, ...BRIEF } as any);
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;

  say("\n" + "─".repeat(78));
  say("GATE LEDGER — recorded by the gate, not inferred");
  rule();
  say(ledger ? formatLedger(ledger) : "🔴 NO LEDGER FOUND — investigate before reading anything below.");

  say("\n" + "─".repeat(78));
  say("NODE 6 IS A SINGLE-SURFACE NODE — per-surface must be a no-op");
  rule();
  const rows: any[] = await db
    .select({ id: headlines.id })
    .from(headlines).where(eq(headlines.headlineSetId, res.headlineSetId));
  const sl = ledger?.bySurface?.["headline"];
  say(`surfaces in the ledger: ${Object.keys(ledger?.bySurface ?? {}).join(", ") || "(none)"}`);
  say(`persisted rows: ${rows.length} · ledger KEPT: ${ledger?.keptCount ?? "?"} · returned: ${res.count ?? "?"}`);
  if (sl) {
    say(`headline surface: pop ${sl.populationSize} · collapse ${sl.collapsingPairsBefore} -> ${sl.collapsingPairsAfter} · ` +
        `evicted ${sl.evicted} recovered ${sl.recovered} dropped ${sl.dropped} trimmed ${sl.trimmed} · ` +
        `KEPT ${sl.kept}/band ${sl.bandMin}-${sl.bandMax} ${sl.meetsFloor ? "✅" : "🔴 BELOW FLOOR"}`);
  }
  const oneSurface = Object.keys(ledger?.bySurface ?? {}).length === 1;
  const agrees = sl ? sl.kept === (ledger?.keptCount ?? -1) : false;
  const countsAgree = rows.length === (ledger?.keptCount ?? -1);
  say("");
  say(oneSurface ? "✅ exactly one surface, as expected for Node 6." : "🔴 more than one surface — unexpected for Node 6.");
  say(agrees ? "✅ the per-surface row equals the aggregate — no double counting." : "🔴 per-surface and aggregate disagree.");
  say(countsAgree ? "✅ ledger KEPT equals the rows actually in the database." : `🔴 ledger says ${ledger?.keptCount}, database holds ${rows.length}.`);
  say(sl?.meetsFloor
    ? "✅ PASS — the surface is at or above its floor with a live desire axis."
    : "🔴 BELOW FLOOR — compare against CHECKPOINT §12.6 (which kept 12) before calling this a regression.");

  say("\n" + "─".repeat(78));
  say("TEARDOWN — NOT executed here.");
  rule();
  say(`DELETE FROM headlines WHERE headlineSetId = '${res.headlineSetId}' AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${conceptRows.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';   -- 1 concept job`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};   -- 1 throwaway ICP`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};   -- 1 throwaway service`);
  say("");
  say("-- No images are rendered by this proof, so Cloudinary is not involved.");
  say("-- Reconcile after teardown: headlines 2174 · adCopy 5424 · adCreatives 405 · jobs 0");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[pdaf-node6-icp-proof] FAILED:", e);
  process.exit(1);
});
