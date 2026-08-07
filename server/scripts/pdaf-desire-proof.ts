/**
 * pdaf-desire-proof.ts — live proof for Steps 2–4: the desire axis bound into
 * Node 6 and Node 7, measured on the stamped columns.
 *
 * ⚠️ WRITES TO PRODUCTION. Runs the REAL runAdCopyGeneration and
 * runHeadlinesGeneration against an EXISTING labelled throwaway service+ICP that
 * already carries a concept set (created by pdaf-step1-proof.ts), so this run adds
 * only copy rows. Renders no images: adCreatives untouched, Cloudinary uninvolved.
 * Teardown printed at the end, NOT executed here.
 *
 * LINKS ARE EXCLUDED FROM THE COLLAPSE METRIC by build decision: a 30-character CTA
 * surface is not one of the three fused surfaces (image / headline / body), so
 * link-vs-link collapse is not a real delivery signal. They keep their awareness
 * stamp for coordination and are reported separately, never counted.
 *
 * Usage:  npx tsx server/scripts/pdaf-desire-proof.ts <serviceId> <icpId> [userId]
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, headlines, campaignConcepts } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { auditBatch, type PdafLabels } from "../_core/pdafDistinctness";

const SERVICE_ID = Number(process.argv[2]);
const ICP_ID = Number(process.argv[3]);
const USER_ID = Number(process.argv[4] ?? 1);
if (!SERVICE_ID || !ICP_ID) throw new Error("usage: pdaf-desire-proof.ts <serviceId> <icpId> [userId]");

const BRIEF = {
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  pressingProblem: "proposals sit unsent for days while the scope keeps moving, and the client goes quiet before the number is ever discussed",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

const pct = (n: number) => (Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`);
const labelsOf = (r: any): PdafLabels => ({
  persona: r.persona ?? null, desire: r.desire ?? null,
  awareness: r.awareness ?? null, format: r.format ?? null,
});

function report(title: string, rows: any[], baseline: string) {
  const a = auditBatch(rows.map((r) => ({ id: r.id, labels: labelsOf(r) })));
  const desires = new Set(rows.map((r) => String(r.desire ?? "")));
  console.log(`\n${title}`);
  console.log(`  rows ${a.itemCount} · distinct desires ${desires.size}`);
  console.log(`  pairs ${a.pairCount} · collapsing ${a.collapsingPairs.length} (${pct(a.collapseRate)})`);
  console.log(`  histogram 0..4: ${a.differingHistogram.join(" · ")}`);
  console.log(`  ${baseline}`);
  return a;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("═".repeat(78));
  console.log("STEPS 2–4 PROOF — the desire axis, measured on stamped columns");
  console.log(`service=${SERVICE_ID} icp=${ICP_ID}`);
  console.log("═".repeat(78));

  const concepts = await db.select({ desire: campaignConcepts.desire })
    .from(campaignConcepts).where(eq(campaignConcepts.icpId, ICP_ID));
  const conceptDesires = Array.from(new Set(concepts.map((c: any) => String(c.desire))));
  console.log(`\nconcept set carries ${conceptDesires.length} distinct desires — the axis's raw material`);

  // ── Node 7 ────────────────────────────────────────────────────────────────
  const t7 = Date.now();
  const res7 = await runAdCopyGeneration({
    userId: USER_ID, serviceId: SERVICE_ID,
    adType: "lead_gen", adStyle: "direct", adCallToAction: "Book a Call",
    productCategory: "consulting engagement design",
    specificProductName: "The Scope-First Sequence",
    ...BRIEF,
  });
  console.log(`\nNode 7 generated in ${((Date.now() - t7) / 1000).toFixed(1)}s — adSetId=${res7.adSetId}`);

  const copyRows: any[] = await db.select({
    id: adCopy.id, contentType: adCopy.contentType, content: adCopy.content,
    persona: adCopy.persona, desire: adCopy.desire, awareness: adCopy.awareness, format: adCopy.format,
  }).from(adCopy).where(eq(adCopy.adSetId, res7.adSetId));

  const n7heads = copyRows.filter((r) => r.contentType === "headline");
  const n7bodies = copyRows.filter((r) => r.contentType === "body");
  const n7links = copyRows.filter((r) => r.contentType === "link");

  console.log("\n" + "─".repeat(78));
  console.log("NODE 7 — COLLAPSE ON THE STAMPED AXES (links excluded by decision)");
  console.log("─".repeat(78));
  report("HEADLINES", n7heads, "was 100.0% before any stage; 37.1% with stage+format only");
  report("BODIES", n7bodies, "was 26.7% with stage+format only");
  report("HEADLINES + BODIES (the fused surfaces)", [...n7heads, ...n7bodies], "");
  console.log(`\n  links: ${n7links.length} rows, stage stamped, EXCLUDED from the metric.`);

  // ── Node 6 ────────────────────────────────────────────────────────────────
  const t6 = Date.now();
  const res6 = await runHeadlinesGeneration({ userId: USER_ID, serviceId: SERVICE_ID, ...BRIEF });
  console.log(`\nNode 6 generated ${res6.count} headlines in ${((Date.now() - t6) / 1000).toFixed(1)}s — set=${res6.headlineSetId}`);

  const headRows: any[] = await db.select({
    id: headlines.id, headline: headlines.headline, formulaType: headlines.formulaType,
    persona: headlines.persona, desire: headlines.desire, awareness: headlines.awareness, format: headlines.format,
  }).from(headlines).where(eq(headlines.headlineSetId, res6.headlineSetId));

  console.log("\n" + "─".repeat(78));
  console.log("NODE 6 — COLLAPSE ON THE STAMPED AXES");
  console.log("─".repeat(78));
  report("HEADLINES", headRows, "was 100.0% before any stage; 42.3% with stage+format only");

  // ── Did the desire actually change the copy? ──────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("DESIRE IS VISIBLE IN THE COPY, not just stamped on the row");
  console.log("─".repeat(78));
  const seen = new Set<string>();
  for (const r of headRows) {
    const d = String(r.desire ?? "");
    if (seen.has(d) || !d) continue;
    seen.add(d);
    console.log(`\n  desire: ${d.slice(0, 84)}`);
    headRows.filter((x) => String(x.desire) === d).slice(0, 2)
      .forEach((x) => console.log(`    · [${x.awareness}/${x.format}] ${x.headline}`));
  }

  // ── Teardown ──────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("TEARDOWN — id-scoped, NOT executed here");
  console.log("─".repeat(78));
  console.log(`DELETE FROM adCopy    WHERE adSetId = '${res7.adSetId}' AND userId = ${USER_ID};   -- ${copyRows.length} rows`);
  console.log(`DELETE FROM headlines WHERE headlineSetId = '${res6.headlineSetId}' AND userId = ${USER_ID};   -- ${headRows.length} rows`);
  console.log("-- plus the step-1 fixture (concepts, script, kit, icp, service) — see pdaf-step1-proof output");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[desire-proof] FAILED:", e);
  process.exit(1);
});
