/**
 * node6-guard-proof.ts — Node 6 completes end to end after the array guard.
 *
 * TWO THINGS AT ONCE. It proves the guard did not break the normal path, and it finally
 * gets the clean Node 6 result that step 2a's run never reached: that run crashed on
 * `parsed.headlines.forEach is not a function` BEFORE producing a ledger, so Node 6 has
 * been UNPROVEN — not broken — since the conceptId plumbing landed.
 *
 * ⚠️ A PASS HERE DOES NOT EXERCISE THE GUARD. The guard only fires on an off-shape model
 * response, which cannot be forced live. `headlineItemsGuard.test.ts` covers that branch
 * with the exact bad shape; this run covers the branch the guard sits in front of.
 *
 * Runs WITH a serviceId and a real ICP + concepts, so the desire axis is genuinely live —
 * a no-serviceId run falls back to one deck-constant desire, cannot clear 2-of-4 on more
 * than one axis, and is NOT comparable to the §12.6 runs that kept 12.
 *
 * ⚠️ WRITES TO PRODUCTION. Renders nothing. Prints an id-scoped teardown it does NOT execute.
 *
 * Usage:  npx tsx server/scripts/node6-guard-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { headlines, services, idealCustomerProfiles, campaignConcepts } from "../../drizzle/schema";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { formatLedger, type GateLedger } from "../_core/pdafGate";

const LOG = `/tmp/node6-guard-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};
const rule = (c = "─") => say(c.repeat(78));

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-NODE6-GUARD — throwaway, safe to delete";

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
  say("NODE 6 — END TO END AFTER THE ARRAY GUARD");
  rule("═");

  const [ins] = await db.insert(services).values({
    userId: USER_ID, name: LABEL, category: "consulting",
    description: "Throwaway created by node6-guard-proof.ts. Safe to delete.",
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
    concepts = await db.select({ id: campaignConcepts.id }).from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (concepts.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  say(`concepts landed: ${concepts.length} in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  if (!concepts.length) throw new Error("no concepts — the desire axis would fall back; this would not be comparable to §12.6");

  // ── The run that previously threw ─────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("RUN — the call that crashed on 2026-08-09");
  rule();
  const t0 = Date.now();
  const res: any = await runHeadlinesGeneration({ userId: USER_ID, serviceId, ...BRIEF } as any);
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  say(`✅ completed in ${((Date.now() - t0) / 1000).toFixed(1)}s WITHOUT throwing`);
  say(`headlineSetId=${res.headlineSetId} returned=${res.count}`);

  say("\n" + "─".repeat(78));
  say("GATE LEDGER");
  rule();
  say(ledger ? formatLedger(ledger) : "🔴 NO LEDGER");

  const rows: any[] = await db.select({ id: headlines.id, formulaType: headlines.formulaType })
    .from(headlines).where(eq(headlines.headlineSetId, res.headlineSetId));
  const byFormula = rows.reduce((acc: Record<string, number>, r: any) => {
    acc[String(r.formulaType)] = (acc[String(r.formulaType)] ?? 0) + 1; return acc;
  }, {});

  say("\n" + "─".repeat(78));
  say("ASSERTIONS");
  rule();
  const sl = ledger?.bySurface?.["headline"];
  const oneSurface = Object.keys(ledger?.bySurface ?? {}).length === 1;
  const countsAgree = rows.length === (ledger?.keptCount ?? -1) && rows.length === Number(res.count);
  say(`persisted ${rows.length} · ledger KEPT ${ledger?.keptCount} · returned ${res.count}`);
  say(`by formula: ${Object.entries(byFormula).map(([k, v]) => `${k} ${v}`).join(" · ") || "(none)"}`);
  say(`${oneSurface ? "✅" : "🔴"} exactly one surface in the ledger, as Node 6 should have`);
  say(`${countsAgree ? "✅" : "🔴"} ledger KEPT === rows in the database === returned count`);
  say(`${sl?.meetsFloor ? "✅" : "🔴"} at or above floor — KEPT ${sl?.kept}/band ${sl?.bandMin}-${sl?.bandMax}`);
  say(`${(ledger?.collapsingPairsAfter ?? -1) === 0 ? "✅" : "🔴"} zero collapsing pairs after`);
  say("");
  say("compare against CHECKPOINT §12.11: the ICP-backed Node 6 run kept 12.");
  say("⚠️ This run does NOT exercise the guard — the guard fires only on an off-shape model");
  say("   response, which cannot be forced live. headlineItemsGuard.test.ts covers that.");

  say("\n" + "─".repeat(78));
  say("TEARDOWN — NOT executed. Nothing rendered, so Cloudinary is not involved.");
  rule();
  say(`DELETE FROM headlines WHERE headlineSetId = '${res.headlineSetId}' AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${concepts.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};`);
  say("-- Reconcile: adCopy 5424 · headlines 2174 · adCreatives 405 · protected 29");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[node6-guard-proof] FAILED:", e);
  process.exit(1);
});
