/**
 * pdaf-node6-proof.ts — live proof for the Node 6 awareness-stage change.
 *
 * Calls the REAL runHeadlinesGeneration (same function the tRPC procedures and the
 * Auto Mode orchestrator call) so the proof exercises the shipped path rather than a
 * rebuilt copy of it. Then reads the rows back and re-runs the Phase 0 collapse
 * measurement against the freshly generated set.
 *
 * ⚠️ THIS SCRIPT WRITES TO PRODUCTION. It inserts one labelled throwaway headline
 * set and nothing else. It deliberately passes NO serviceId, which means the
 * generator skips its service/ICP/kit/source-of-truth lookups and its auto-select
 * step — so the only rows created anywhere are the headlines themselves, all sharing
 * one headlineSetId. Teardown is therefore a single id-scoped delete, printed at the
 * end and NOT executed here.
 *
 * The collapse number printed at the end reads the STAMPED columns — persona,
 * desire, awareness, format as written at generation time. It is not the Phase 0
 * recovery-by-replay. This is the first measurement taken the way the Phase 5 gate
 * will actually work.
 *
 * Usage:  npx tsx server/scripts/pdaf-node6-proof.ts [userId]
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { headlines } from "../../drizzle/schema";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { auditBatch, type PdafLabels } from "./pdafDistinctness";

const USER_ID = Number(process.argv[2] ?? 1);

// A realistic brief, so the headlines can be judged as copy rather than as filler.
const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem:
    "proposals sit unsent for days while the scope keeps moving, and the client goes quiet before the number is ever discussed",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

function pct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("═".repeat(78));
  console.log("NODE 6 AWARENESS PROOF — live generation against production");
  console.log(`user=${USER_ID}  serviceId=none (minimal footprint: headline rows only)`);
  console.log("═".repeat(78));

  const t0 = Date.now();
  const res = await runHeadlinesGeneration({
    userId: USER_ID,
    ...BRIEF,
  });
  console.log(`\ngenerated ${res.count} headlines in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`headlineSetId = ${res.headlineSetId}`);

  const rows = await db
    .select({
      id: headlines.id,
      formulaType: headlines.formulaType,
      headline: headlines.headline,
      subheadline: headlines.subheadline,
      eyebrow: headlines.eyebrow,
      persona: headlines.persona,
      desire: headlines.desire,
      awareness: headlines.awareness,
      format: headlines.format,
      complianceScore: headlines.complianceScore,
    })
    .from(headlines)
    .where(eq(headlines.headlineSetId, res.headlineSetId));

  // ── 1. Is the stage actually stamped on every row? ────────────────────────
  const missing = rows.filter((r: any) => !r.awareness).length;
  const stageCounts: Record<string, number> = {};
  for (const r of rows as any[]) stageCounts[String(r.awareness)] = (stageCounts[String(r.awareness)] ?? 0) + 1;

  console.log("\n" + "─".repeat(78));
  console.log("1. STAGE STAMPED PER ROW");
  console.log("─".repeat(78));
  console.log(`rows with no awareness value: ${missing} (must be 0)`);
  console.log("distribution:", JSON.stringify(stageCounts));
  console.log("axes present on row 1:", JSON.stringify({
    persona: (rows[0] as any)?.persona?.slice(0, 40) + "…",
    desire: (rows[0] as any)?.desire?.slice(0, 40) + "…",
    awareness: (rows[0] as any)?.awareness,
    format: (rows[0] as any)?.format,
  }));

  // ── 2. Read the copy, grouped by stage ────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("2. THE HEADLINES, GROUPED BY STAGE  (judge these as copy)");
  console.log("─".repeat(78));
  const order = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"];
  for (const stage of order) {
    const inStage = (rows as any[]).filter((r) => r.awareness === stage);
    if (!inStage.length) continue;
    console.log(`\n### ${stage.replace(/_/g, " ").toUpperCase()} (${inStage.length})`);
    for (const r of inStage) {
      const eb = r.eyebrow ? `[${r.eyebrow}] ` : "";
      const sub = r.subheadline ? `\n      ↳ ${r.subheadline}` : "";
      console.log(`  · (${r.formulaType}) ${eb}${r.headline}${sub}`);
    }
  }

  // ── 3. The collapse number, from the STAMPED axes ─────────────────────────
  const items = (rows as any[]).map((r) => ({
    id: r.id as number,
    labels: {
      persona: r.persona ?? null,
      desire: r.desire ?? null,
      awareness: r.awareness ?? null,
      format: r.format ?? null,
    } satisfies PdafLabels,
  }));
  const audit = auditBatch(items);

  console.log("\n" + "─".repeat(78));
  console.log("3. COLLAPSE MEASUREMENT — from the stamped columns, not inferred");
  console.log("─".repeat(78));
  console.log(`headlines .......... ${audit.itemCount}`);
  console.log(`pairs .............. ${audit.pairCount}`);
  console.log(`collapsing pairs ... ${audit.collapsingPairs.length}  (${pct(audit.collapseRate)})`);
  console.log(`axes-differing histogram (0..4): ${audit.differingHistogram.join(" · ")}`);
  console.log(`\nPhase 0 baseline for Node 6 was 1809 / 1809 pairs = 100.0% collapsing.`);

  // ── 4. Teardown, printed only ─────────────────────────────────────────────
  const ids = (rows as any[]).map((r) => r.id).join(",");
  console.log("\n" + "─".repeat(78));
  console.log("4. TEARDOWN — id-scoped, NOT executed by this script");
  console.log("─".repeat(78));
  console.log(`DELETE FROM headlines WHERE id IN (${ids}) AND userId = ${USER_ID};`);
  console.log(`-- ${(rows as any[]).length} rows, headlineSetId = ${res.headlineSetId}`);
  console.log("-- No creatives, no Cloudinary objects, no service/ICP rows were created.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[node6-proof] FAILED:", e);
    process.exit(1);
  });
