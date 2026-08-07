/**
 * pdaf-node7-proof.ts — live proof for the Node 7 awareness + field-chaining change.
 *
 * Calls the REAL runAdCopyGeneration, so the proof exercises the shipped path
 * including its output gate and capped regeneration, not a rebuilt copy of it.
 *
 * ⚠️ THIS SCRIPT WRITES TO PRODUCTION. It creates ONE labelled throwaway service
 * and one ad-copy set. It renders no images, so no creative rows and no Cloudinary
 * objects are produced and the adCreatives baseline is untouched. Teardown is
 * id-scoped, printed at the end, and NOT executed here.
 *
 * What it checks:
 *   1. awareness + format stamped on every row, INCLUDING headlines and links
 *      (which previously carried no stage at all)
 *   2. the collapse count on the headline rows, from the STAMPED axes
 *   3. whether each body's opening echoes its headline — the chaining claim
 *   4. the whole-deck collapse number, comparable to the Phase 0 baseline
 *
 * Usage:  npx tsx server/scripts/pdaf-node7-proof.ts [userId]
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adCopy, services } from "../../drizzle/schema";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { auditBatch, type PdafLabels } from "../_core/pdafDistinctness";

const USER_ID = Number(process.argv[2] ?? 1);
const LABEL = "ZZ-PDAF-PROOF — throwaway, safe to delete";

const BRIEF = {
  adType: "lead_gen" as const,
  adStyle: "direct",
  adCallToAction: "Book a Call",
  targetMarket: "operations consultants who bill by the hour and want to move to retainers",
  productCategory: "consulting engagement design",
  specificProductName: "The Scope-First Sequence",
  pressingProblem:
    "proposals sit unsent for days while the scope keeps moving, and the client goes quiet before the number is ever discussed",
  desiredOutcome: "a booked retainer conversation within two weeks of first contact",
  uniqueMechanism: "the Scope-First Sequence",
};

const STOP = new Set(("a an the and or but if then than that this these those of to in on for with without your you " +
  "is are was were be been being it its as at by from into over under about after before while what which who whom " +
  "how why when where do does did done can could should would will shall may might must not no nor so such very " +
  "i me my we our us they them their he she his her one two three").split(" "));

const contentWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

function pct(n: number): string {
  return Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("═".repeat(78));
  console.log("NODE 7 PROOF — awareness stage on all surfaces + field chaining");
  console.log("═".repeat(78));

  // ── Labelled throwaway service ────────────────────────────────────────────
  const [ins] = await db.insert(services).values({
    userId: USER_ID,
    name: LABEL,
    category: "consulting",
    description:
      "Throwaway service row created by pdaf-node7-proof.ts to exercise the real ad-copy generator. Safe to delete.",
    targetCustomer: BRIEF.targetMarket,
    mainBenefit: BRIEF.desiredOutcome,
    painPoints: BRIEF.pressingProblem,
  } as any);
  const serviceId = Number((ins as any).insertId);
  console.log(`created throwaway service id=${serviceId}`);

  const t0 = Date.now();
  const res = await runAdCopyGeneration({ userId: USER_ID, serviceId, ...BRIEF });
  console.log(
    `\ngenerated in ${((Date.now() - t0) / 1000).toFixed(1)}s — adSetId=${res.adSetId}\n` +
    `headlines=${res.headlineCount} bodies=${res.bodyCount} links=${res.linkCount} ` +
    `(generated ${res.generatedCount}, dropped by gate ${res.droppedCount})`,
  );

  const rows: any[] = await db
    .select({
      id: adCopy.id, contentType: adCopy.contentType, content: adCopy.content,
      bodyAngle: adCopy.bodyAngle, persona: adCopy.persona, desire: adCopy.desire,
      awareness: adCopy.awareness, format: adCopy.format,
    })
    .from(adCopy)
    .where(eq(adCopy.adSetId, res.adSetId));

  const byType = (t: string) => rows.filter((r) => r.contentType === t);
  const heads = byType("headline");
  const bodies = byType("body");
  const links = byType("link");

  // ── 1. Axes stamped everywhere ────────────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("1. AXES STAMPED PER ROW");
  console.log("─".repeat(78));
  for (const [label, set] of [["headline", heads], ["body", bodies], ["link", links]] as const) {
    const noStage = set.filter((r) => !r.awareness).length;
    const noFormat = set.filter((r) => !r.format).length;
    const dist: Record<string, number> = {};
    for (const r of set) dist[String(r.awareness)] = (dist[String(r.awareness)] ?? 0) + 1;
    console.log(`${label.padEnd(9)} n=${String(set.length).padStart(2)}  missing stage=${noStage}  missing format=${noFormat}  ${JSON.stringify(dist)}`);
  }

  // ── 2. Collapse on the headline rows ──────────────────────────────────────
  const labelsOf = (r: any): PdafLabels => ({
    persona: r.persona ?? null, desire: r.desire ?? null,
    awareness: r.awareness ?? null, format: r.format ?? null,
  });
  const headAudit = auditBatch(heads.map((r) => ({ id: r.id, labels: labelsOf(r) })));
  console.log("\n" + "─".repeat(78));
  console.log("2. COLLAPSE — NODE 7 HEADLINE ROWS (stamped axes)");
  console.log("─".repeat(78));
  console.log(`pairs ${headAudit.pairCount}, collapsing ${headAudit.collapsingPairs.length} (${pct(headAudit.collapseRate)})`);
  console.log(`histogram 0..4: ${headAudit.differingHistogram.join(" · ")}`);
  console.log(`Phase 0 baseline: 1911 / 1911 = 100.0% collapsing.`);

  // ── 3. Does the body echo the headline? ───────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("3. CHAINING — does each body's opening echo a headline?");
  console.log("─".repeat(78));
  const headWordSets = heads.map((h) => ({ text: String(h.content), words: new Set(contentWords(String(h.content))) }));
  let worst = { overlap: 0, body: "", head: "" };
  const overlaps: number[] = [];
  for (const b of bodies) {
    const opening = contentWords(String(b.content)).slice(0, 10);
    if (!opening.length) continue;
    let best = { overlap: 0, head: "" };
    for (const h of headWordSets) {
      const shared = opening.filter((w) => h.words.has(w)).length;
      const ov = shared / opening.length;
      if (ov > best.overlap) best = { overlap: ov, head: h.text };
    }
    overlaps.push(best.overlap);
    if (best.overlap > worst.overlap) {
      worst = { overlap: best.overlap, body: String(b.content).slice(0, 90), head: best.head };
    }
  }
  const mean = overlaps.length ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length : NaN;
  console.log(`bodies checked ......... ${overlaps.length}`);
  console.log(`mean word overlap between a body's first 10 content words and its closest headline: ${pct(mean)}`);
  console.log(`worst single case ...... ${pct(worst.overlap)}`);
  if (worst.head) {
    console.log(`  headline: "${worst.head}"`);
    console.log(`  body:     "${worst.body}…"`);
  }

  console.log("\nFirst 12 words of each body (the priming real estate):");
  bodies.slice(0, 6).forEach((b, i) => {
    const first = String(b.content).replace(/\s+/g, " ").split(" ").slice(0, 12).join(" ");
    console.log(`  ${String(i + 1).padStart(2)}. [${b.awareness}/${b.format}] ${first}…`);
  });

  console.log("\nSample paired surfaces (same stage), to read as one ad:");
  for (const stage of ["unaware", "problem_aware", "solution_aware", "product_aware"]) {
    const h = heads.find((r) => r.awareness === stage);
    const b = bodies.find((r) => r.awareness === stage);
    const l = links.find((r) => r.awareness === stage);
    if (!h && !b) continue;
    console.log(`\n  ── ${stage.toUpperCase()} ──`);
    if (h) console.log(`  HEADLINE: ${h.content}`);
    if (b) console.log(`  BODY:     ${String(b.content).replace(/\s+/g, " ").slice(0, 190)}…`);
    if (l) console.log(`  LINK:     ${l.content}`);
  }

  // ── 4. Whole-deck collapse ────────────────────────────────────────────────
  const deckAudit = auditBatch(rows.map((r) => ({ id: r.id, labels: labelsOf(r) })));
  console.log("\n" + "─".repeat(78));
  console.log("4. WHOLE-DECK COLLAPSE (all three surfaces together)");
  console.log("─".repeat(78));
  console.log(`rows ${deckAudit.itemCount}, pairs ${deckAudit.pairCount}, collapsing ${deckAudit.collapsingPairs.length} (${pct(deckAudit.collapseRate)})`);
  console.log(`histogram 0..4: ${deckAudit.differingHistogram.join(" · ")}`);

  // ── 5. Teardown ───────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(78));
  console.log("5. TEARDOWN — id-scoped, NOT executed here");
  console.log("─".repeat(78));
  console.log(`DELETE FROM adCopy WHERE adSetId = '${res.adSetId}' AND userId = ${USER_ID};   -- ${rows.length} rows`);
  console.log(`DELETE FROM services WHERE id = ${serviceId} AND userId = ${USER_ID};   -- 1 throwaway service`);
  console.log("-- No creatives rendered: adCreatives baseline untouched, no Cloudinary objects.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[node7-proof] FAILED:", e);
    process.exit(1);
  });
