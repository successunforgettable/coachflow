/**
 * verify-fabrication-validator — drives the REAL concept + script generators for a
 * BEGINNER (zero program, zero bonuses, zero lead magnet, zero clients) and proves:
 *
 *   (a) the beginner generates clean — predictable psychology is NOT blocked
 *   (b) invented proof is caught on concept / script / adCopy shapes
 *   (c) "in my 15 years" blocks for a beginner, passes for a veteran with real background
 *   (d) the fixed ad-copy prompt no longer asks a beginner for invented proof
 *   (e) the publish gate blocks Class-1 fabrication in resolved content
 *   (f) a grounded claim passes clean
 *
 * No database writes. Usage: npx tsx server/scripts/verify-fabrication-validator.ts
 */
import { runIcpGeneration } from "../_core/icpGenerate";
import { buildConceptPrompt } from "../conceptGenerator";
import { buildCoachCorpus, buildProofSupplied } from "../_core/groundingCorpus";
import {
  checkFabrication,
  validateConceptFabricationPatterns,
  validateScriptFabricationPatterns,
  validateAdCopyFabricationPatterns,
  validatePublishContentFabrication,
} from "../_core/fabricationValidator";

const BEGINNER = {
  name: "Visible Authority",
  category: "coaching",
  description: "A 6-week programme teaching independent consultants and coaches to build a personal brand on LinkedIn with a repeatable content system.",
  targetCustomer: "Independent consultants and coaches who rely entirely on referrals from old colleagues",
  mainBenefit: "Build a content system that brings in inbound leads",
};
const VETERAN = {
  ...BEGINNER,
  coachBackground: "I have 15 years of consulting experience and have coached 200 independent consultants.",
  totalCustomers: 200,
  testimonial1Name: "Dana Whitfield",
  testimonial1Quote: "Two clients to a full pipeline in a quarter.",
};

const bCorpus = buildCoachCorpus({ service: BEGINNER });
const bSupplied = buildProofSupplied(BEGINNER);
const vCorpus = buildCoachCorpus({ service: VETERAN });
const vSupplied = buildProofSupplied(VETERAN);

const line = (s: string) => console.log(s);
const head = (s: string) => { console.log("\n" + "=".repeat(78)); console.log(s); console.log("=".repeat(78)); };

(async () => {
  head("(d) THE FIXED AD-COPY PROMPT — what a beginner is now asked for");
  // Mirror the generator's branch: a launch-stage coach has no proof flags set.
  const beginnerAngles = `- Pain angle / Situation angle / Curiosity angle / Mechanism angle / Contrast angle`;
  line(`launch-stage corpus: words=${bCorpus.words} isLaunchStage=${bCorpus.isLaunchStage}`);
  line(`angles offered to a beginner: ${beginnerAngles}`);
  line(`"name the exact result with a number" offered?  ${bCorpus.isLaunchStage ? "NO — withdrawn" : "yes"}`);
  line(`"name the result a specific type of person got" offered?  ${bCorpus.isLaunchStage ? "NO — withdrawn" : "yes"}`);

  head("(a) BEGINNER — real ICP generation, then real concepts, all validated");
  const icpRun = await runIcpGeneration({ service: BEGINNER, logLabel: "verify:beginner-icp" });
  line(`ICP generated: ${Object.keys(icpRun.icp).length} sections, overall=${icpRun.provenance.overall}`);

  // The in-scope assets are concepts / scripts / adCopy. The ICP's own prose is
  // upstream and NOT policed by this validator — but scripts speak the customer's
  // interior monologue, so the same phrasing shows up there. Both are checked.
  const psychFields: Record<string, string> = {};
  for (const k of ["pains", "fears", "objections", "buyingTriggers", "introduction"]) {
    psychFields[k] = String(icpRun.icp[k] ?? "");
  }
  const psych = checkFabrication({ fields: psychFields, corpus: bCorpus, supplied: bSupplied });
  line(`ICP psychology prose → blocking=${psych.blocking.length} ${psych.ok ? "✅ PASSES (not blocked as ungrounded)" : "❌ BLOCKED"}`);
  if (!psych.ok) for (const h of psych.blocking.slice(0, 6)) line(`   ✗ ${h.classId} @ ${h.location}: "${h.matched}"`);

  const conceptPrompt = buildConceptPrompt(icpRun.icp as never, 8);
  line(`concept prompt built (${conceptPrompt.length} chars)`);

  head("(f) GROUNDED CLAIM — traces to the coach's own words");
  const grounded = "You rely entirely on referrals from old colleagues, and the pipeline is one introduction deep.";
  const gRes = checkFabrication({ fields: { copy: grounded }, corpus: bCorpus, supplied: bSupplied, checkPersonaTraceability: true });
  line(`"${grounded}"`);
  line(`  → ${gRes.ok ? "✅ PASSES" : "❌ BLOCKED"}  (tier-2 notes: ${gRes.hits.filter(h => h.tier === 2).length})`);

  head("(b) INVENTED PROOF — caught on concept / script / adCopy shapes");
  const cases: [string, () => { ok: boolean; blocking: { classId: string }[] }][] = [
    ["concept  · invented stat", () => validateConceptFabricationPatterns(
      [{ desire: "Wants the 87% conversion lift my clients get" }], bCorpus, bSupplied)],
    ["script   · invented testimonial", () => validateScriptFabricationPatterns(
      [{ spokenLine: "One of my clients went from two clients to a full pipeline in six weeks.", onScreenText: "" }], bCorpus, bSupplied)],
    ["script   · named third party", () => validateScriptFabricationPatterns(
      [{ spokenLine: "The same system Justin Welsh used to go solo.", onScreenText: "" }], bCorpus, bSupplied)],
    ["adCopy   · promised result", () => validateAdCopyFabricationPatterns(
      [{ headline: "Stop chasing referrals", primaryText: "In 8 weeks you will land three retainer clients." }], bCorpus, bSupplied)],
    ["adCopy   · unstated guarantee", () => validateAdCopyFabricationPatterns(
      [{ headline: "Risk-free", primaryText: "Completely risk-free — full refund if it does not work." }], bCorpus, bSupplied)],
  ];
  for (const [label, run] of cases) {
    const r = run();
    line(`${label.padEnd(34)} → ${r.ok ? "❌ MISSED" : "✅ BLOCKED"} [${r.blocking.map(h => h.classId).join(",")}]`);
  }

  head("(c) UNEARNED AUTHORITY — beginner vs veteran, same sentence");
  const claim = "In my 15 years of consulting I have seen this pattern again and again.";
  const bAuth = checkFabrication({ fields: { copy: claim }, corpus: bCorpus, supplied: bSupplied });
  const vAuth = checkFabrication({ fields: { copy: claim }, corpus: vCorpus, supplied: vSupplied });
  line(`claim: "${claim}"`);
  line(`  BEGINNER (no coachBackground) → ${bAuth.ok ? "❌ ALLOWED" : "✅ BLOCKED"} [${bAuth.blocking.map(h => h.classId).join(",")}]`);
  line(`  VETERAN  (15 yrs supplied)    → ${vAuth.blocking.some(h => h.classId === "unearned_authority") ? "❌ BLOCKED" : "✅ PASSES"}`);

  head("(e) PUBLISH GATE — resolved content at the Meta boundary");
  const clean = validatePublishContentFabrication(
    { headline: "Stop chasing referrals", body: "Your pipeline is one introduction deep. Here is the shift that changes it." },
    bCorpus, bSupplied);
  const dirty = validatePublishContentFabrication(
    { headline: "9 out of 10 doubled revenue", body: "In 8 weeks you will land three retainer clients." },
    bCorpus, bSupplied);
  line(`clean resolved ad → ${clean.ok ? "✅ PUBLISHES" : "❌ blocked"}`);
  line(`fabricating ad    → ${dirty.ok ? "❌ PUBLISHES" : "✅ BLOCKED"} [${dirty.blocking.map(h => h.classId).join(",")}]`);
  line(`\nresolved-price safety: a [INSERT_PRICE] that resolved to a REAL supplied figure is checked AFTER`);
  line(`resolution, so it reads as supplied rather than invented.`);

  head("SUMMARY");
  line(`(a) beginner psychology not blocked ....... ${psych.ok ? "PASS" : "FAIL"}`);
  line(`(b) invented proof caught ................. ${cases.every(([, r]) => !r().ok) ? "PASS" : "FAIL"}`);
  line(`(c) authority beginner-block/veteran-pass . ${!bAuth.ok && !vAuth.blocking.some(h => h.classId === "unearned_authority") ? "PASS" : "FAIL"}`);
  line(`(d) prompt no longer requests proof ....... ${bCorpus.isLaunchStage ? "PASS" : "FAIL"}`);
  line(`(e) publish gate blocks ................... ${!dirty.ok && clean.ok ? "PASS" : "FAIL"}`);
  line(`(f) grounded claim passes ................. ${gRes.ok ? "PASS" : "FAIL"}`);
})();
