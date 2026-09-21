/**
 * grounding-checker-eval — LIVE evaluation of the sprint-2 grounding checker over the whole-script fixtures.
 *
 * Runs the real model N times per fixture (default 3) and writes:
 *   <out>/grounding-checker-eval-<label>.json   raw results (keep out of the repo)
 *   <out>/grounding-checker-eval-<label>.md     the per-class report
 *
 * ZERO DATABASE CALLS. Facts come from the fixtures through the pure `buildCoachFacts`. Runtime imports:
 * fs/path/os, `../_core/coachFacts` (pure; its own imports are groundingCorpus → validator, icpPrompts →
 * lib/complianceFilter, mechanismStandard → copywritingRules; none opens a connection), `../_core/groundingChecker`
 * (→ llm → env) and the fixture module. `railway run` is used ONLY to load ANTHROPIC_API_KEY.
 *
 *   railway run --environment production --service coachflow npx tsx server/scripts/grounding-checker-eval.ts \
 *     [--runs 3] [--out DIR] [--label NAME]
 *
 * RECORD-ONLY and not a production caller (§15d): nothing in the app imports this script.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildCoachFacts } from "../_core/coachFacts";
import { checkGrounding, type GroundingCheckResult } from "../_core/groundingChecker";
import { GROUNDING_FIXTURES, scoreFixtureRun, type FixtureRunScore } from "../__fixtures__/groundingCheckerScripts";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const RUNS = Math.max(1, parseInt(arg("runs", "3"), 10) || 3);
const OUT = arg("out", join(tmpdir(), "grounding-checker-eval"));
const LABEL = arg("label", new Date().toISOString().replace(/[:.]/g, "-"));
const CONCURRENCY = 4;

type Run = { fixtureId: string; run: number; wallMs: number; result: GroundingCheckResult; score: FixtureRunScore };

const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${a}/${b} = ${((100 * a) / b).toFixed(1)}%`);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set; nothing was run.");
    process.exit(2);
  }
  mkdirSync(OUT, { recursive: true });
  const jobs = GROUNDING_FIXTURES.flatMap((fx) => Array.from({ length: RUNS }, (_, run) => ({ fx, run })));
  const runs: Run[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const { fx, run } = jobs[next++];
      const t0 = Date.now();
      const result = await checkGrounding(fx.asset, buildCoachFacts(fx.facts));
      const wallMs = Date.now() - t0;
      const score = scoreFixtureRun(fx, result);
      runs.push({ fixtureId: fx.id, run, wallMs, result, score });
      console.log(`${fx.id} run ${run + 1}: status=${result.status} bio=${score.bio.found}/${score.bio.expected} fp=${score.bio.falsePositives.length} ` +
        `f5=${score.f5.found}/${score.f5.expected} fp=${score.f5.falsePositives.length} nc=${score.notCheckable} ms=${wallMs}`);
    }
  }));
  runs.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId) || a.run - b.run);

  const sum = (f: (s: FixtureRunScore) => number) => runs.reduce((n, r) => n + f(r.score), 0);
  const all = <T>(f: (s: FixtureRunScore) => T[]) => runs.flatMap((r) => f(r.score).map((x) => ({ id: r.fixtureId, run: r.run + 1, x })));

  const bioFlagged = sum((s) => s.bio.flagged);
  const bioFp = all((s) => s.bio.falsePositives);
  const f5Findings = sum((s) => s.f5.findings);
  const f5Fp = all((s) => s.f5.falsePositives);
  const dcRuns = runs.filter((r) => r.score.dcPass !== null);
  const attempts = runs.flatMap((r) => r.result.attempts);
  const statuses = runs.reduce<Record<string, number>>((m, r) => ((m[r.result.status] = (m[r.result.status] ?? 0) + 1), m), {});
  const errKeys = ["callErrors", "malformedResponses", "unverifiedClaimQuotes", "unverifiedFinancialQuotes", "unverifiedCopyRead", "total"] as const;
  const errs = Object.fromEntries(errKeys.map((k) => [k, runs.reduce((n, r) => n + r.result.extractionErrors[k], 0)]));
  const models = Array.from(new Set(runs.flatMap((r) => r.result.usage.models)));
  const conflictFp = all((s) => s.conflicts.falsePositives);
  const overFp = all((s) => s.overstated.falsePositives);

  const lines: string[] = [];
  lines.push(`# Grounding checker — live eval (${LABEL})`, "");
  lines.push(`- fixtures: ${GROUNDING_FIXTURES.length} whole scripts × ${RUNS} runs = ${runs.length} checked assets; model calls: ${attempts.length}`);
  lines.push(`- models answering: ${models.join(", ") || "none"}`);
  lines.push(`- statuses: ${Object.entries(statuses).map(([k, v]) => `${k} ${v}`).join(" · ")}`, "");
  lines.push("## Per class", "", "| class | measure | result |", "|---|---|---|");
  lines.push(`| F2 specific biography | recall (expected ungrounded items found) | ${pct(sum((s) => s.bio.found), sum((s) => s.bio.expected))} |`);
  lines.push(`| F2 specific biography | precision (flagged claims matching an expected item) | ${pct(bioFlagged - bioFp.length, bioFlagged)} |`);
  lines.push(`| F2 grounding | expected grounded items grounded | ${pct(sum((s) => s.grounding.found), sum((s) => s.grounding.expected))} |`);
  lines.push(`| F5 viewer finance | recall | ${pct(sum((s) => s.f5.found), sum((s) => s.f5.expected))} |`);
  lines.push(`| F5 viewer finance | precision | ${pct(f5Findings - f5Fp.length, f5Findings)} |`);
  lines.push(`| F5 controls | control-line hits (idiom / third-person / conditional / general) | ${all((s) => s.f5.controlHits).length} |`);
  lines.push(`| D-c | runs with zero flagged specific biography and ≥1 not_checkable | ${pct(dcRuns.filter((r) => r.score.dcPass).length, dcRuns.length)} |`);
  lines.push(`| conflicts | detected | ${pct(sum((s) => s.conflicts.found), sum((s) => s.conflicts.expected))} · false positives ${conflictFp.length} |`);
  lines.push(`| certainty | overstated detected | ${pct(sum((s) => s.overstated.found), sum((s) => s.overstated.expected))} · false positives ${overFp.length} |`);
  lines.push(`| certainty | grounded-without-marker control kept grounded | ${pct(sum((s) => s.groundedNotOverstated.found), sum((s) => s.groundedNotOverstated.expected))} |`);
  lines.push("", "## Extraction errors", "", `| ${errKeys.join(" | ")} |`, `|${errKeys.map(() => "---").join("|")}|`, `| ${errKeys.map((k) => errs[k]).join(" | ")} |`, "");
  lines.push(`- assets needing a re-extraction: ${runs.filter((r) => r.result.attempts.length > 1).length} of ${runs.length}`, "");
  const lat = attempts.map((a) => a.latencyMs);
  const inTok = attempts.map((a) => a.inputTokens ?? 0);
  const outTok = attempts.map((a) => a.outputTokens ?? 0);
  lines.push("## Latency and tokens (per model call)", "");
  lines.push(`- latency: median ${median(lat)} ms · max ${Math.max(0, ...lat)} ms · per asset wall median ${median(runs.map((r) => r.wallMs))} ms`);
  lines.push(`- input tokens: mean ${mean(inTok)} · max ${Math.max(0, ...inTok)}`);
  lines.push(`- output tokens: mean ${mean(outTok)} · max ${Math.max(0, ...outTok)}`, "");
  lines.push("## Per fixture, per run", "", "| fixture | run | status | bio found | bio FP | grounded | conflicts | overstated | F5 found | F5 FP | not_checkable | D-c | calls | ms |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of runs) {
    const s = r.score;
    lines.push(`| ${r.fixtureId} | ${r.run + 1} | ${s.status} | ${s.bio.found}/${s.bio.expected} | ${s.bio.falsePositives.length} | ${s.grounding.found}/${s.grounding.expected} | ` +
      `${s.conflicts.found}/${s.conflicts.expected} | ${s.overstated.found}/${s.overstated.expected} | ${s.f5.found}/${s.f5.expected} | ${s.f5.falsePositives.length} | ` +
      `${s.notCheckable} | ${s.dcPass === null ? "-" : s.dcPass ? "pass" : "FAIL"} | ${r.result.usage.calls} | ${r.wallMs} |`);
  }
  const listing = (title: string, xs: Array<{ id: string; run: number; x: string }>) => {
    lines.push("", `## ${title}`, "");
    if (!xs.length) lines.push("none");
    for (const { id, run, x } of xs) lines.push(`- ${id} run ${run}: "${x}"`);
  };
  listing("F2 biography false positives (fixture text, quoted for humans)", bioFp);
  listing("F5 false positives", f5Fp);
  listing("Conflict false positives", conflictFp);
  listing("Overstated false positives", overFp);
  const misses = runs.flatMap((r) => [
    ...r.score.bio.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: biography "${m}"`),
    ...r.score.grounding.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: grounding "${m}"`),
    ...r.score.conflicts.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: conflict "${m}"`),
    ...r.score.overstated.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: overstated "${m}"`),
    ...r.score.groundedNotOverstated.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: grounded control "${m}"`),
    ...r.score.f5.missed.map((m) => `${r.fixtureId} run ${r.run + 1}: F5 "${m}"`),
  ]);
  lines.push("", "## Misses (by first anchor)", "", ...(misses.length ? misses.map((m) => `- ${m}`) : ["none"]));

  const jsonPath = join(OUT, `grounding-checker-eval-${LABEL}.json`);
  const mdPath = join(OUT, `grounding-checker-eval-${LABEL}.md`);
  writeFileSync(jsonPath, JSON.stringify({ label: LABEL, runsPerFixture: RUNS, runs }, null, 1));
  writeFileSync(mdPath, lines.join("\n") + "\n");
  console.log(`\nwrote ${mdPath}\nwrote ${jsonPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
