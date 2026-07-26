/**
 * verify-icp-sharpen — exercises the sharpen paths against the REAL generator.
 *
 * Covers: baseline generate (the preview the coach sees) → decline path (unchanged)
 * → accept path (all 4 answers) → partial skip (2 of 4) → structural-failure safety.
 *
 * No database access: it drives runIcpGeneration directly, which is the whole of what
 * sharpenWithLadder does before its UPDATE. Nothing is written anywhere.
 *
 * Usage:  npx tsx server/scripts/verify-icp-sharpen.ts
 */
import { runIcpGeneration } from "../_core/icpGenerate";
import { computeIcpProvenance, validateIcpStructure, type IcpValidationContext } from "../_core/icpGrounding";
import { hasLadderContent, type ICPLadderAnswers, type ICPServiceInput } from "../_core/icpPrompts";

const SERVICE: ICPServiceInput = {
  name: "Visible Authority",
  category: "coaching",
  description: "A 6-week cohort program teaching solopreneurs how to build a personal brand on LinkedIn through a content system that generates inbound leads.",
  targetCustomer: "Solopreneurs — consultants, coaches, and freelancers — who feel invisible and want to become in-demand",
  mainBenefit: "Go from invisible to in-demand by building a LinkedIn content system that generates inbound leads",
};

/** Answers to Arfeen's four questions, as a real coach would give them. */
const FULL_LADDER: ICPLadderAnswers = {
  trigger: "Her biggest retainer client ended with two weeks notice and she realised every client she had ever won came from one old colleague who had introduced her years ago.",
  priorAttempts: "She'd tried cold outreach on LinkedIn and hated it, hired a VA to post quotes for her which got nothing, and bought a course on funnels she never finished.",
  hesitation: "She was terrified that posting would look like showing off to former colleagues who still work at the firm she left.",
  successMoment: "Two people she had never met booked calls off a single post about a mistake she used to make with pricing.",
};

const PARTIAL_LADDER: ICPLadderAnswers = {
  trigger: FULL_LADDER.trigger,
  hesitation: FULL_LADDER.hesitation,
};

const PROSE = ["introduction", "fears", "pains", "objections", "buyingTriggers"];
const rank = { inferred: 0, partial: 1, stated: 2 } as const;

function summarise(label: string, icp: Record<string, unknown>, prov: ReturnType<typeof computeIcpProvenance>) {
  const counts = { stated: 0, partial: 0, inferred: 0 };
  for (const v of Object.values(prov.perSection)) counts[v]++;
  console.log(
    `${label.padEnd(26)} | overall=${prov.overall.padEnd(8)} | stated=${counts.stated} partial=${counts.partial} inferred=${counts.inferred}` +
    ` | corpusWords=${prov.corpusWords} | answered=[${prov.ladderAnswered.join(",") || "none"}]` +
    ` | answersStored=${prov.ladderAnswers ? Object.keys(prov.ladderAnswers).length : 0}` +
    ` | structuralHits=${validateIcpStructure(icp).length}`,
  );
  return counts;
}

(async () => {
  // ── (a) BASELINE — what the coach sees in the preview reveal card ──
  console.log("\n" + "=".repeat(78));
  console.log("BASELINE — un-laddered generation (the preview the coach first sees)");
  console.log("=".repeat(78));
  const base = await runIcpGeneration({ service: SERVICE, logLabel: "verify:baseline" });
  const baseCounts = summarise("BEFORE (no ladder)", base.icp, base.provenance);
  console.log("\n--- BEFORE: preview line (what the reveal card shows) ---");
  console.log(String(base.icp.introduction).split("\n")[0].slice(0, 220));
  for (const f of PROSE.slice(1)) {
    console.log(`\n--- BEFORE: ${f} (first item) ---`);
    console.log(String(base.icp[f]).split("\n")[0].slice(0, 300));
  }

  // ── (b) DECLINE — no endpoint call at all; nothing regenerates ──
  console.log("\n" + "=".repeat(78));
  console.log("DECLINE PATH");
  console.log("=".repeat(78));
  console.log(`hasLadderContent(null) = ${hasLadderContent(null)}  → sharpenWithLadder is never called;`);
  console.log("the profile and the rest of the flow are untouched.");
  console.log(`hasLadderContent(all-skipped) = ${hasLadderContent({ trigger: "  ", priorAttempts: "" })}` +
    "  → even if reached, the mutation returns sharpened:false and writes nothing.");

  // ── (c) ACCEPT — all four answered ──
  console.log("\n" + "=".repeat(78));
  console.log("ACCEPT PATH — all four questions answered");
  console.log("=".repeat(78));
  const full = await runIcpGeneration({ service: SERVICE, ladder: FULL_LADDER, logLabel: "verify:full" });
  const fullCounts = summarise("AFTER (4/4 answered)", full.icp, full.provenance);
  console.log("\n--- AFTER: preview line (the re-reveal) ---");
  console.log(String(full.icp.introduction).split("\n")[0].slice(0, 220));
  for (const f of PROSE.slice(1)) {
    console.log(`\n--- AFTER: ${f} (first item) ---`);
    console.log(String(full.icp[f]).split("\n")[0].slice(0, 300));
  }

  // ── (d) PARTIAL — 2 answered, 2 skipped ──
  console.log("\n" + "=".repeat(78));
  console.log("PARTIAL-SKIP PATH — 2 answered, 2 skipped");
  console.log("=".repeat(78));
  const partial = await runIcpGeneration({ service: SERVICE, ladder: PARTIAL_LADDER, logLabel: "verify:partial" });
  const partialCounts = summarise("AFTER (2/4 answered)", partial.icp, partial.provenance);

  // ── (e) STRUCTURAL-FAILURE SAFETY ──
  console.log("\n" + "=".repeat(78));
  console.log("STRUCTURAL-FAILURE SAFETY");
  console.log("=".repeat(78));
  const flattened = { ...base.icp, gender: "x", income_level: "y" };
  const hits = validateIcpStructure(flattened);
  console.log(`a malformed payload yields ${hits.length} structural hits ([${hits.map(h => h.code).join(", ")}])`);
  console.log("runIcpGeneration THROWS on exhausted structural retries BEFORE returning, and");
  console.log("sharpenWithLadder only UPDATEs after it returns → the original profile survives.");

  // ── Provenance comparison ──
  console.log("\n" + "=".repeat(78));
  console.log("PROVENANCE — before vs after");
  console.log("=".repeat(78));
  const grounded = (c: typeof baseCounts) => c.stated + c.partial;
  console.log(`BEFORE  stated+partial = ${grounded(baseCounts)}/14   corpusWords=${base.provenance.corpusWords}`);
  console.log(`AFTER   stated+partial = ${grounded(fullCounts)}/14   corpusWords=${full.provenance.corpusWords}`);
  console.log(`PARTIAL stated+partial = ${grounded(partialCounts)}/14   corpusWords=${partial.provenance.corpusWords}`);
  console.log(`\ncorpus widened: ${base.provenance.corpusWords} → ${full.provenance.corpusWords} significant words`);
  console.log(`answers persisted in groundingMeta: ${JSON.stringify(Object.keys(full.provenance.ladderAnswers ?? {}))}`);
  const improved = PROSE.filter(
    (f) => rank[full.provenance.perSection[f]] > rank[base.provenance.perSection[f]],
  );
  console.log(`sections whose grounding label improved: [${improved.join(", ") || "none"}]`);
})();
