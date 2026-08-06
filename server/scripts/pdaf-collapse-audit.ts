/**
 * pdaf-collapse-audit.ts — PHASE 0. Read-only baseline: how much of the copy we
 * already generate would collapse to a single Entity ID under the 2-of-4
 * P.D.A.F. rule?
 *
 * ⚠️ STRICTLY READ-ONLY. This script issues SELECT statements and nothing else.
 * It creates no rows, updates no rows, calls no generator, spends no LLM tokens
 * and touches no Cloudinary object. It is safe to run against production, which
 * is the only place the real decks exist.
 *
 * Usage:  npx tsx server/scripts/pdaf-collapse-audit.ts [--limit N] [--verbose]
 *
 * ── WHAT IS MEASURED VS WHAT IS GUESSED ─────────────────────────────────────
 * The gate that ships in Phase 5 will compare dimensions ASSIGNED at generation
 * time. Those columns do not exist yet, so this baseline has to recover the
 * dimensions from what was stored. Three of the four axes are NOT guesswork —
 * they are read straight out of columns the generator already writes:
 *
 *   P (persona)  = the stored targetMarket           — READ, not inferred
 *   D (desire)   = the stored pressingProblem + desiredOutcome
 *                                                    — READ, not inferred
 *   F (format)   = the stored formulaType (Node 6) or bodyAngle (Node 7 body)
 *                                                    — READ, not inferred.
 *                  Per the build decision, format REUSES the formula/angle each
 *                  piece was already written to. No parallel format label is
 *                  invented here.
 *   A (awareness)= not stored anywhere. See below.
 *
 * A is the ONLY estimated axis, and it is estimated by REPLAY rather than by
 * reading the copy: the live generator assigns stages deterministically from
 * awarenessPlanForCount() + angleForStage(). This script imports those exact
 * functions and replays the assignment for the deck's size and angle set. When
 * the replayed angles match the stored angles, the stage each row was written
 * to is recovered exactly. When they do not match — a deck generated before the
 * stage-aware change shipped, or one whose angle set we cannot reconstruct —
 * the stage is marked UNKNOWN and the deck is reported as a RANGE (see below)
 * instead of a single number.
 *
 * NOTHING HERE INSPECTS THE TEXT OF THE COPY. No keyword matching, no LLM
 * classifier, no similarity score. An inferred-from-prose axis would be a
 * different quantity from the one the gate will check, and mixing the two is
 * exactly what this file's separation from pdafDistinctness.ts exists to stop.
 */
import "dotenv/config";
import { desc, eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { headlines, adCopy } from "../../drizzle/schema";
import {
  ALL_BODY_ANGLES,
  PROOF_DEPENDENT_ANGLES,
  angleForStage,
  type BodyAngle,
} from "../adCopyAngles";
import { awarenessPlanForCount } from "../_core/conceptAxis";
import { auditBatch, type PdafLabels } from "./pdafDistinctness";

type Row = Record<string, any>;

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : 400;
})();

/**
 * Group rows by a key, preserving insertion order. Returns an array of entries
 * rather than a Map — the repo's tsconfig target predates Map iteration, and a
 * script is not the place to change a compiler flag.
 */
function groupBy(rows: Row[], key: string): Array<[string, Row[]]> {
  const order: string[] = [];
  const bucket: Record<string, Row[]> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "∅");
    if (!bucket[k]) { bucket[k] = []; order.push(k); }
    bucket[k].push(r);
  }
  return order.map((k) => [k, bucket[k]] as [string, Row[]]);
}

const desireOf = (r: Row): string | null => {
  const parts = [r.pressingProblem, r.desiredOutcome].filter(Boolean).map(String);
  return parts.length ? parts.join(" ⁝ ") : null;
};

/**
 * Replay the generator's own stage assignment for a body deck.
 *
 * Returns a map from angle → stage when the replay reproduces the deck's stored
 * angles exactly, and null when it does not (in which case the deck predates the
 * stage-aware generator, or was produced with an angle set we cannot rebuild).
 */
function recoverStages(deckAngles: string[]): Map<string, string> | null {
  const stored = deckAngles.filter(Boolean) as BodyAngle[];
  if (stored.length === 0) return null;

  // A deck containing a proof-dependent angle proves the coach had real proof
  // at generation time, which is what widened the available angle set.
  const hadProof = stored.some((a) => PROOF_DEPENDENT_ANGLES.includes(a));
  const available = hadProof
    ? [...ALL_BODY_ANGLES]
    : ALL_BODY_ANGLES.filter((a) => !PROOF_DEPENDENT_ANGLES.includes(a));

  // Same loop as adCopyGenerator's slot builder — imported helpers, not a rewrite.
  const plan = awarenessPlanForCount(stored.length);
  const used = new Set<BodyAngle>();
  const replay: Array<{ angle: BodyAngle; stage: string }> = [];
  for (const stage of plan) {
    const mapped = angleForStage(stage, available, used);
    const angle = mapped ?? available.find((a) => !used.has(a));
    if (!angle) break;
    used.add(angle);
    replay.push({ angle, stage });
  }

  const sortedReplay = replay.map((r) => r.angle).slice().sort().join("|");
  const sortedStored = stored.slice().sort().join("|");
  if (sortedReplay !== sortedStored) return null;

  return new Map(replay.map((r) => [r.angle as string, r.stage]));
}

function pct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("═".repeat(78));
  console.log("PHASE 0 — P.D.A.F. COLLAPSE BASELINE (read-only, no writes)");
  console.log("Rule: a pair differing on fewer than 2 of 4 axes collapses to one Entity ID.");
  console.log("═".repeat(78));

  // ── POPULATION 1: Node 6 headline sets ────────────────────────────────────
  const headlineRows: Row[] = await db
    .select({
      id: headlines.id,
      headlineSetId: headlines.headlineSetId,
      formulaType: headlines.formulaType,
      targetMarket: headlines.targetMarket,
      pressingProblem: headlines.pressingProblem,
      desiredOutcome: headlines.desiredOutcome,
    })
    .from(headlines)
    .orderBy(desc(headlines.id))
    .limit(LIMIT);

  const headlineSets = groupBy(headlineRows, "headlineSetId");
  let n6Pairs = 0;
  let n6Collapse = 0;
  const n6Hist = [0, 0, 0, 0, 0];

  for (const [setId, rows] of headlineSets) {
    if (rows.length < 2) continue;
    const items = rows.map((r: Row) => ({
      id: r.id as number,
      labels: {
        persona: r.targetMarket ?? null,
        desire: desireOf(r),
        // STRUCTURAL FACT, not an estimate: Node 6 assigns no awareness stage.
        awareness: null,
        format: r.formulaType ?? null,
      } satisfies PdafLabels,
    }));
    const audit = auditBatch(items);
    n6Pairs += audit.pairCount;
    n6Collapse += audit.collapsingPairs.length;
    audit.differingHistogram.forEach((v, i) => (n6Hist[i] += v));
    if (VERBOSE) {
      console.log(`  set ${setId}: ${audit.itemCount} headlines, ${audit.pairCount} pairs, ` +
        `${audit.collapsingPairs.length} collapsing (${pct(audit.collapseRate)})`);
    }
  }

  // ── POPULATION 2 + 3: Node 7 decks (headline rows and body rows) ──────────
  const adCopyRows: Row[] = await db
    .select({
      id: adCopy.id,
      adSetId: adCopy.adSetId,
      contentType: adCopy.contentType,
      bodyAngle: adCopy.bodyAngle,
      targetMarket: adCopy.targetMarket,
      pressingProblem: adCopy.pressingProblem,
      desiredOutcome: adCopy.desiredOutcome,
    })
    .from(adCopy)
    .orderBy(desc(adCopy.id))
    .limit(LIMIT * 3);

  const decks = groupBy(adCopyRows, "adSetId");

  let n7hPairs = 0, n7hCollapse = 0;
  let bodyPairs = 0, bodyCollapseLow = 0, bodyCollapseHigh = 0;
  let decksRecovered = 0, decksUnknown = 0;
  const bodyHist = [0, 0, 0, 0, 0];

  for (const [setId, rows] of decks) {
    // --- Node 7 headline rows ---
    const hRows = rows.filter((r: Row) => r.contentType === "headline");
    if (hRows.length >= 2) {
      const items = hRows.map((r: Row) => ({
        id: r.id as number,
        labels: {
          persona: r.targetMarket ?? null,
          desire: desireOf(r),
          awareness: null,      // Node 7 headlines carry no stage either.
          format: null,         // No formula/angle is recorded for these rows at all.
        } satisfies PdafLabels,
      }));
      const audit = auditBatch(items);
      n7hPairs += audit.pairCount;
      n7hCollapse += audit.collapsingPairs.length;
    }

    // --- Node 7 body rows ---
    const bRows = rows.filter((r: Row) => r.contentType === "body");
    if (bRows.length < 2) continue;

    const stageMap = recoverStages(bRows.map((r: Row) => String(r.bodyAngle ?? "")));
    if (stageMap) decksRecovered++; else decksUnknown++;

    // LOW bound  — stages as recovered (UNKNOWN decks: every stage null → no
    //              help from axis A, which is what a pre-stage deck really was).
    // HIGH bound — for UNKNOWN decks only, the optimistic reading in which every
    //              row happened to carry a different stage.
    const lowItems = bRows.map((r: Row) => ({
      id: r.id as number,
      labels: {
        persona: r.targetMarket ?? null,
        desire: desireOf(r),
        awareness: stageMap ? (stageMap.get(String(r.bodyAngle)) ?? null) : null,
        format: r.bodyAngle ?? null,
      } satisfies PdafLabels,
    }));
    const lowAudit = auditBatch(lowItems);

    const highItems = bRows.map((r: Row, i: number) => ({
      id: r.id as number,
      labels: {
        ...lowItems[i].labels,
        awareness: stageMap ? lowItems[i].labels.awareness : `unknown-${i}`,
      } satisfies PdafLabels,
    }));
    const highAudit = auditBatch(highItems);

    bodyPairs += lowAudit.pairCount;
    bodyCollapseLow += highAudit.collapsingPairs.length;   // fewest collapses
    bodyCollapseHigh += lowAudit.collapsingPairs.length;   // most collapses
    lowAudit.differingHistogram.forEach((v, i) => (bodyHist[i] += v));

    if (VERBOSE) {
      console.log(`  deck ${setId}: ${lowAudit.itemCount} bodies, ${lowAudit.pairCount} pairs, ` +
        `stages ${stageMap ? "RECOVERED" : "UNKNOWN"}, ` +
        `${lowAudit.collapsingPairs.length} collapsing (${pct(lowAudit.collapseRate)})`);
    }
  }

  // ── REPORT ────────────────────────────────────────────────────────────────
  const line = (label: string, collapse: number, pairs: number) =>
    console.log(`${label.padEnd(34)} ${String(collapse).padStart(6)} / ${String(pairs).padEnd(6)}  ${pct(pairs ? collapse / pairs : NaN)}`);

  console.log("\n" + "─".repeat(78));
  console.log("COLLAPSING PAIRS (differ on 0 or 1 of 4 axes)");
  console.log("─".repeat(78));
  console.log(`${"population".padEnd(34)} ${"collapse / pairs".padStart(15)}  rate`);
  line("Node 6 — headline sets", n6Collapse, n6Pairs);
  line("Node 7 — headline rows", n7hCollapse, n7hPairs);
  if (bodyCollapseLow === bodyCollapseHigh) {
    line("Node 7 — body decks", bodyCollapseHigh, bodyPairs);
  } else {
    line("Node 7 — body decks (worst)", bodyCollapseHigh, bodyPairs);
    line("Node 7 — body decks (best)", bodyCollapseLow, bodyPairs);
  }

  const totalPairs = n6Pairs + n7hPairs + bodyPairs;
  const totalLow = n6Collapse + n7hCollapse + bodyCollapseLow;
  const totalHigh = n6Collapse + n7hCollapse + bodyCollapseHigh;
  console.log("─".repeat(78));
  if (totalLow === totalHigh) {
    line("ALL COPY", totalHigh, totalPairs);
  } else {
    line("ALL COPY (worst case)", totalHigh, totalPairs);
    line("ALL COPY (best case)", totalLow, totalPairs);
  }

  console.log("\nAxes-differing histogram, body decks (0..4):", bodyHist.join(" · "));
  console.log(`Body decks with stages recovered by replay: ${decksRecovered}; unknown: ${decksUnknown}`);
  console.log(`Headline sets audited: ${headlineSets.filter(([, r]) => r.length >= 2).length}`);
  console.log("\nReminder: A (awareness) is the only estimated axis, recovered by replaying the");
  console.log("generator's own deterministic assignment — never by reading the copy text.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[pdaf-audit] FAILED:", e);
    process.exit(1);
  });
