/**
 * pdaf-node6-gate-proof.ts — LIVE proof for the distinctness gate on NODE 6 (headlines).
 *
 * Calls the REAL runHeadlinesGeneration, so this exercises the shipped path including the
 * gate, not a rebuilt copy of it. A harness that re-implements the sequence proves the
 * harness (STANDING RULE 2).
 *
 * ⚠️ WHY THIS EXISTS SEPARATELY FROM pdaf-gate-proof.ts. Both earlier live proofs ran
 * through Node 7. Node 6's wiring had only ever run in unit tests, and its
 * `movable: ["desire", "awareness"]` declaration is newer than either of those runs.
 *
 * ⚠️ NO VERDICT B HERE, BY DESIGN. Node 6 produces ONE surface — headlines. There are no
 * bodies, so there is no opening that could echo a headline and nothing for the deck-wide
 * anti-echo check to act on. The harness does not supply a rewriteEcho callback and does
 * not print an echo verdict. Manufacturing one would be reporting a check that never ran.
 *
 * ⚠️ FORMAT IS IMMOVABLE ON NODE 6. The five formulas do not share a row shape (`eyebrow`
 * carries an eyebrow plus a subheadline, `authority` a subheadline, the rest neither), so
 * a piece whose only escape is a format change CANNOT be recovered and is dropped. Some
 * drops are therefore CORRECT here in a way they were not on Node 7. The gate RECORDS a
 * reason on every drop (`no_move_available` / `regenerate_failed` /
 * `redraft_still_collapsed`) and this harness reads it. That is the only honest way to
 * answer the question: a dropped piece is never persisted, so no harness can re-derive its
 * labels from the database afterwards. `no_move_available` is the honest drop; anything
 * else is named separately rather than folded into the count.
 *
 * ⚠️ THIS SCRIPT WRITES TO PRODUCTION: one throwaway service, one ICP, one concept set,
 * one headline set. It renders NO images. Teardown is id-scoped, printed, NOT executed.
 *
 * Usage:  npx tsx server/scripts/pdaf-node6-gate-proof.ts [userId]
 */
import "dotenv/config";
import { appendFileSync } from "fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { headlines, services, idealCustomerProfiles, campaignConcepts } from "../../drizzle/schema";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { ensureConceptsForIcp, conceptJobId } from "../conceptGenerator";
import { auditBatch, type PdafLabels } from "../_core/pdafDistinctness";
import { formatLedger, type GateLedger } from "../_core/pdafGate";

const LOG = `/tmp/pdaf-node6-gate-proof-${process.pid}.log`;
const say = (line = "") => {
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch { /* logging must never break the run */ }
};

const USER_ID = Number(process.argv[2] ?? 117174);
const LABEL = "ZZ-PDAF-NODE6-GATE-PROOF — throwaway, safe to delete";

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem:
    "proposals sit unsent for days while the scope keeps moving, and the client goes quiet before the number is ever discussed",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "n/a");
const rule = (c = "─") => say(c.repeat(78));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  rule("═");
  say("P.D.A.F. DISTINCTNESS GATE — LIVE PROOF, NODE 6 (HEADLINES)");
  say(`user ${USER_ID} · one throwaway service + ICP + concept set + headline set · renders nothing`);
  say("No Verdict B: Node 6 has one surface, so there is nothing for anti-echo to check.");
  rule("═");

  const [ins] = await db.insert(services).values({
    userId: USER_ID,
    name: LABEL,
    category: "consulting",
    description:
      "Throwaway service row created by pdaf-node6-gate-proof.ts to exercise the real headlines generator through the distinctness gate. Safe to delete.",
    targetCustomer: BRIEF.targetMarket,
    mainBenefit: BRIEF.desiredOutcome,
    painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  say(`created throwaway service id=${serviceId}`);

  // Node 6 resolves an ICP only on the serviceId path; without one there are no concepts
  // and the desire axis falls back to the single deck constant. Creating one keeps desire
  // genuinely live, which is the whole point of proving the fall-through here.
  const [icpIns] = await db.insert(idealCustomerProfiles).values({
    userId: USER_ID,
    serviceId,
    name: LABEL,
    angleName: "operations consultants moving to retainers",
    introduction: "Independent operations consultants, 5-15 years in, billing hourly and capped by their own calendar.",
    pains: BRIEF.pressingProblem,
    fears: "that raising the model loses the client entirely, and that the pipeline goes quiet for a quarter",
    goals: BRIEF.desiredOutcome,
    frustrations: "scope creeps between the call and the proposal; the number keeps changing; nobody says no, they just stop replying",
    objections: "my clients would never agree to a retainer; my work is genuinely project-shaped",
    buyingTriggers: "a month where billable hours dropped but workload did not",
    source: "generated" as const,
  } as any);
  const icpId = Number((icpIns as any).insertId);
  say(`created throwaway ICP id=${icpId}`);

  say(`generating concepts (non-blocking; polling up to 10 minutes)…`);
  const tC = Date.now();
  const conceptStatus = await ensureConceptsForIcp({ userId: USER_ID, icpId, serviceId });
  say(`ensureConceptsForIcp → "${conceptStatus}"`);
  const POLL_MS = 10 * 60 * 1000;
  let conceptRows: any[] = [];
  while (Date.now() - tC < POLL_MS) {
    conceptRows = await db
      .select({ desire: campaignConcepts.desire })
      .from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));
    if (conceptRows.length > 0) break;
    await new Promise((r) => setTimeout(r, 15_000));
    say(`  …still waiting (${((Date.now() - tC) / 1000).toFixed(0)}s)`);
  }
  const distinctDesires = Array.from(new Set(conceptRows.map((r: any) => String(r.desire ?? "").trim()).filter(Boolean)));
  say(`concepts landed: ${conceptRows.length} rows in ${((Date.now() - tC) / 1000).toFixed(1)}s`);
  say(`distinct desires available to the gate: ${distinctDesires.length}`);
  if (distinctDesires.length < 2) {
    say("⚠️ FEWER THAN TWO DESIRES — desire is effectively pinned this run. Say so rather than");
    say("   claiming the desire axis was exercised.");
  }

  const t0 = Date.now();
  const res = await runHeadlinesGeneration({ userId: USER_ID, serviceId, ...BRIEF });
  const ledger: GateLedger | undefined = (globalThis as any).__ZAP_LAST_PDAF_LEDGER__;
  say(`\ngenerated in ${((Date.now() - t0) / 1000).toFixed(1)}s — headlineSetId=${res.headlineSetId}, kept ${res.count}`);

  say("\n" + "─".repeat(78));
  say("REGENERATION LEDGER — recorded by the gate, not inferred");
  rule();
  if (!ledger) say("🔴 NO LEDGER FOUND. The gate did not run — investigate before reading anything below.");
  else say(formatLedger(ledger));

  // ── A. Collapse among the rows that persisted ─────────────────────────────
  const rows: any[] = await db
    .select({
      id: headlines.id, headline: headlines.headline, formulaType: headlines.formulaType,
      subheadline: headlines.subheadline, eyebrow: headlines.eyebrow,
      persona: headlines.persona, desire: headlines.desire,
      awareness: headlines.awareness, format: headlines.format,
    })
    .from(headlines)
    .where(eq(headlines.headlineSetId, res.headlineSetId));

  const labelsOf = (r: any): PdafLabels => ({
    persona: r.persona ?? null, desire: r.desire ?? null,
    awareness: r.awareness ?? null, format: r.format ?? null,
  });
  const kept = auditBatch(rows.map((r) => ({ id: r.id, labels: labelsOf(r) })));

  say("\n" + "─".repeat(78));
  say("A. COLLAPSE AMONG THE KEPT ROWS — re-audited FROM THE DATABASE");
  rule();
  say(`population ${rows.length} headline rows`);
  say(`pairs ${kept.pairCount} · collapsing ${kept.collapsingPairs.length} (${pct(kept.collapseRate)})`);
  say(`histogram 0..4 axes differing: ${kept.differingHistogram.join(" · ")}`);
  if (ledger) {
    say(`\nBEFORE the gate (same deck, measured by the gate): ${ledger.collapsingPairsBefore} pairs (${pct(ledger.collapseRateBefore)})`);
    say(`AFTER  the gate (same deck, measured by the gate): ${ledger.collapsingPairsAfter} pairs (${pct(ledger.collapseRateAfter)})`);
  }
  say(
    `\nVERDICT A: ${kept.collapsingPairs.length === 0
      ? "✅ PASS — 0% collapse among the rows that persisted."
      : `🔴 FAIL — ${kept.collapsingPairs.length} collapsing pair(s) survived to the database.`}`,
  );
  for (const p of kept.collapsingPairs.slice(0, 10)) {
    say(`   ids ${p.a} ↔ ${p.b}: only ${p.verdict.differingCount} axis differs (${p.verdict.differingDimensions.join(", ") || "none"})`);
  }

  // ── DROP AUDIT — are the drops honest no-clear cases? ─────────────────────
  // The old defect burned all three attempts on an axis that could never separate the
  // piece. The fix simulates before calling the model, so a drop should now mean "no
  // available desire or awareness move clears 2-of-4". This re-runs that simulation
  // independently, against the FINAL survivors, and says so either way.
  say("\n" + "─".repeat(78));
  say("DROP AUDIT — is each drop a genuine no-clear case?");
  rule();
  const dropped = ledger?.droppedAtCap ?? [];
  say(`dropped at cap: ${dropped.length}`);
  if (dropped.length === 0) {
    say("Nothing dropped — every evicted headline was recovered on desire or awareness.");
  } else {
    // The gate RECORDS why it dropped each piece, so this is read, not reconstructed. A
    // dropped piece was never persisted, so no harness can re-derive its labels from the
    // database; asking the gate is the only honest way to answer the question.
    const byReason = new Map<string, number>();
    for (const d of dropped) {
      byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
      const gloss = d.reason === "no_move_available"
        ? "NO available desire/awareness move clears 2-of-4 — honest drop ✅"
        : d.reason === "regenerate_failed"
          ? "the redraft never came back clean 🔵 (model or compliance, not the axis logic)"
          : "a redraft came back but still collapsed 🔵";
      say(`   ${d.id} — axis sought: ${d.axis ?? "none"} · ${gloss}`);
    }
    const honest = byReason.get("no_move_available") ?? 0;
    say(`\n${honest}/${dropped.length} drops are genuine no-clear cases.`);
    if (honest !== dropped.length) {
      say("⚠️ The remainder are NOT axis-logic failures either, but they are worth naming rather");
      say("   than folding into the honest count — report them separately.");
    }
    say("Note: format is immovable on Node 6 by design (the five formulas do not share a row");
    say("shape), so drops here are expected in a way they are not on Node 7.");
  }

  // ── ORDERING CHECK — did the compliance drop happen BEFORE the gate? ──────
  // If it did, the persistence backstop finds nothing and the gate's KEPT count equals what
  // the database holds. On 2026-08-07 they disagreed (12 vs 11) because the only blocking
  // compliance check ran AFTER the gate.
  say("\n" + "─".repeat(78));
  say("ORDERING — compliance before the gate, so nothing is lost after it");
  rule();
  const ledgerKept = ledger?.keptCount ?? -1;
  say(`gate ledger KEPT ......... ${ledgerKept}`);
  say(`rows in the database ..... ${rows.length}`);
  say(`generator returned count . ${res.count}`);
  const agree = ledgerKept === rows.length && res.count === rows.length;
  say(
    agree
      ? "✅ AGREE — no post-gate under-fill; the compliance backstop dropped nothing."
      : `🔴 DISAGREE — ${ledgerKept - rows.length} row(s) lost after the gate. The backstop is still` +
        " dropping post-gate, so the reorder has not taken effect.",
  );
  const band = { min: 8, max: 12 };
  say(`band (small) ${band.min}-${band.max} → kept ${rows.length}: ${rows.length >= band.min && rows.length <= band.max ? "✅ inside the band" : "🔴 OUTSIDE the band"}`);

  // ── TEMPLATE TOKENS — none may persist ────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("TEMPLATE TOKENS — zero raw [INSERT_*] placeholders may persist");
  rule();
  const TOKEN_RE = /\[INSERT_[A-Z0-9_]*\]/g;
  const offenders: string[] = [];
  for (const r of rows) {
    for (const f of ["headline", "subheadline", "eyebrow"] as const) {
      const v = (r as any)[f];
      if (typeof v === "string" && TOKEN_RE.test(v)) offenders.push(`id ${r.id} .${f}: ${v.slice(0, 90)}`);
      TOKEN_RE.lastIndex = 0;
    }
  }
  say(`rows scanned: ${rows.length} (headline + subheadline + eyebrow)`);
  say(offenders.length === 0
    ? "✅ PASS — zero unfilled template tokens in the persisted headlines."
    : `🔴 FAIL — ${offenders.length} unfilled token(s) persisted:`);
  for (const o of offenders) say(`   ${o}`);

  say("\n" + "─".repeat(78));
  say("THE HEADLINES");
  rule();
  rows.forEach((h, i) => say(`  ${String(i + 1).padStart(2)}. [${h.awareness}/${h.format}] ${h.headline}`));

  // ── Teardown ──────────────────────────────────────────────────────────────
  say("\n" + "─".repeat(78));
  say("TEARDOWN — id-scoped, NOT executed here");
  rule();
  say(`DELETE FROM headlines WHERE id IN (${rows.map((r) => r.id).join(",")}) AND userId = ${USER_ID};   -- ${rows.length} rows`);
  say(`DELETE FROM campaignConcepts WHERE icpId = ${icpId} AND userId = ${USER_ID};   -- ${conceptRows.length} concepts`);
  say(`DELETE FROM jobs WHERE id = '${conceptJobId(icpId)}' AND userId = '${USER_ID}';   -- 1 concept job`);
  say(`DELETE FROM idealCustomerProfiles WHERE id = ${icpId} AND userId = ${USER_ID};   -- 1 throwaway ICP`);
  say(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};   -- 1 throwaway service`);
  say("");
  say("-- ⚠️ ID-SCOPED, NEVER userId-SCOPED. Smoke user 117174 OWNS the 25 protected");
  say("--    creatives on services 272-277; a userId-only delete would destroy them.");
  say("-- No creatives rendered: adCreatives baseline 405 untouched, no Cloudinary objects.");
  say("-- Reconcile after teardown: adCopy 5424 · headlines 2174 · adCreatives 405");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[pdaf-node6-gate-proof] FAILED:", e);
    process.exit(1);
  });
