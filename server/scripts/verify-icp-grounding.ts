/**
 * verify-icp-grounding — drives the REAL runIcpGeneration path repeatedly and
 * reports Class-A honesty, Class-B vividness, provenance labels and structural
 * integrity across runs.
 *
 * No database access: this exercises prompt → model → structural gate → grounding
 * validator → provenance, which is the whole of what this sprint changed. Nothing
 * is written anywhere.
 *
 * Usage:  npx tsx server/scripts/verify-icp-grounding.ts [runsPerService]
 */
import { runIcpGeneration } from "../_core/icpGenerate";
import { validateIcpStructure, validateIcpGrounding, type IcpValidationContext } from "../_core/icpGrounding";
import type { ICPServiceInput } from "../_core/icpPrompts";

const CASES: { label: string; service: ICPServiceInput; ladder?: Record<string, string> }[] = [
  {
    label: "217 Rest Assured",
    service: {
      name: "Rest Assured",
      category: "coaching",
      description: "A 4-week online program combining gentle sleep training with parent wellness support to get babies sleeping through the night.",
      targetCustomer: "Exhausted first-time parents aged 28–40 with babies not yet sleeping through the night.",
      mainBenefit: "Get their baby sleeping through the night while supporting the parent's own wellness.",
    },
  },
  {
    label: "218 Visible Authority (the case that was 3/3 DEAD before removal)",
    service: {
      name: "Visible Authority",
      category: "coaching",
      description: "A 6-week cohort program teaching solopreneurs how to build a personal brand on LinkedIn through a content system that generates inbound leads.",
      targetCustomer: "Solopreneurs — consultants, coaches, and freelancers — who feel invisible and want to become in-demand",
      mainBenefit: "Go from invisible to in-demand by building a LinkedIn content system that generates inbound leads",
    },
  },
];

const CLOCK_RE = /\b\d{1,2}[:.]\d{2}\s?(am|pm)?\b|\b\d{1,2}\s?(am|pm)\b/gi;

(async () => {
  const runs = Number(process.argv[2] ?? 3);
  const summary: string[] = [];
  let malformedPersisted = 0;
  let totalRuns = 0;
  let totalAttempts = 0;

  for (const c of CASES) {
    const ctx: IcpValidationContext = { service: c.service, ladder: (c.ladder ?? null) as never };
    for (let i = 1; i <= runs; i++) {
      totalRuns++;
      process.stderr.write(`\n=== ${c.label} — run ${i}/${runs} ===\n`);
      let icp: Record<string, unknown>;
      let provenance;
      let attempts = 0;
      try {
        const r = await runIcpGeneration({
          service: c.service,
          ladder: (c.ladder ?? null) as never,
          logLabel: `verify[${c.label.slice(0, 3)}#${i}]`,
        });
        icp = r.icp; provenance = r.provenance; attempts = r.attempts;
      } catch (err) {
        summary.push(`${c.label} run ${i}: THREW (nothing would persist) — ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      totalAttempts += attempts;

      // The three retired fields must be absent — not empty strings, absent.
      const retired = ["demographics", "mediaConsumption", "influencers"].filter((k) => k in icp);

      // Structural integrity of what WOULD have persisted.
      const structural = validateIcpStructure(icp);
      if (structural.length > 0) malformedPersisted++;
      const grounding = validateIcpGrounding(icp, ctx);
      const named = grounding.filter((h) => h.classId === "icp_named_third_party");
      const demoHits = grounding.filter((h) => h.classId === "icp_demographic_unsupported");

      const keys = Object.keys(icp);

      const prose = ["introduction", "fears", "pains"].map((k) => String(icp[k] ?? "")).join(" ");
      const clocks = (prose.match(CLOCK_RE) ?? []).length;
      const firstPerson = (prose.match(/\bI\b|\bmy\b|\bme\b/gi) ?? []).length;
      const per1k = (n: number) => (prose.length ? (n / prose.length) * 1000 : 0).toFixed(1);

      summary.push(
        [
          `${c.label} run ${i}`,
          `attempts=${attempts}`,
          `keys=${keys.length}/14`,
          `retiredPresent=${retired.length === 0 ? "none" : retired.join("+")}`,
          `structuralHits=${structural.length}`,
          `namedThirdParty=${named.length}`,
          `demoUnsupported=${demoHits.length}`,
          `overall=${provenance.overall}`,
          `corpusWords=${provenance.corpusWords}`,
          `ladder=[${provenance.ladderAnswered.join(",") || "none"}]`,
          `proseChars=${prose.length}`,
          `clock/1k=${per1k(clocks)}`,
          `I-my-me/1k=${per1k(firstPerson)}`,
        ].join(" | "),
      );

      // First run per case: dump the evidence for a human read.
      if (i === 1) {
        console.log("\n" + "=".repeat(78));
        console.log(`SAMPLE — ${c.label}`);
        console.log("=".repeat(78));
        console.log("\n--- RETIRED FIELDS (must be absent) ---");
        console.log(JSON.stringify({
          demographics: icp.demographics ?? "(absent)",
          mediaConsumption: icp.mediaConsumption ?? "(absent)",
          influencers: icp.influencers ?? "(absent)",
        }, null, 1));
        console.log("\n--- SECTION KEYS RETURNED ---");
        console.log(keys.join(", "));
        console.log("\n--- CLASS B: introduction ---");
        console.log(String(icp.introduction).slice(0, 1100));
        console.log("\n--- CLASS B: fears (first 2) ---");
        console.log(String(icp.fears).split("\n").slice(0, 2).join("\n"));
        console.log("\n--- PROVENANCE (out-of-band) ---");
        console.log(JSON.stringify({ overall: provenance.overall, corpusWords: provenance.corpusWords,
          ladderAnswered: provenance.ladderAnswered, perSection: provenance.perSection,
          hitClasses: provenance.hits.map((h) => h.classId) }, null, 1));
      }
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log("RUN TABLE");
  console.log("=".repeat(78));
  for (const line of summary) console.log(line);
  console.log("\n" + "=".repeat(78));
  console.log(`TOTAL RUNS: ${totalRuns} | mean attempts/run: ${(totalAttempts / Math.max(totalRuns, 1)).toFixed(2)}`);
  console.log(`MALFORMED THAT WOULD HAVE PERSISTED: ${malformedPersisted}  (must be 0)`);
  console.log("=".repeat(78));
})();
