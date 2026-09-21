/**
 * f5-subject-test-probe — A/B confirmation for the LIST 2 SUBJECT TEST clause (F5 pension-line false positive).
 *
 * Arm "before" is the CURRENT prompt with the one inserted clause removed, derived from the live constant so the two
 * arms cannot drift apart: the only difference between them is the line `git diff` shows as added.
 * Arm "after" is the module default.
 *
 * ZERO DATABASE CALLS (same path as grounding-checker-eval): facts come from the fixtures through pure buildCoachFacts.
 * `railway run` is used ONLY to load ANTHROPIC_API_KEY. Record-only; nothing in the app imports this.
 *
 *   railway run --environment production --service coachflow npx tsx server/scripts/f5-subject-test-probe.ts [--runs 3] [--out DIR]
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildCoachFacts } from "../_core/coachFacts";
import { checkGrounding, GROUNDING_CHECKER_SYSTEM_PROMPT, type GroundingCheckResult } from "../_core/groundingChecker";
import { invokeLLM } from "../_core/llm";
import { GROUNDING_FIXTURES, scoreFixtureRun, type FixtureRunScore } from "../__fixtures__/groundingCheckerScripts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const RUNS = Math.max(1, parseInt(arg("runs", "3"), 10) || 3);
const OUT = arg("out", join(tmpdir(), "f5-subject-test-probe"));
const CONCURRENCY = 4;

// ── The two arms, derived so they differ by exactly the inserted clause ────────────────────────────
/** The candidate clause's opening marker. Arm "before" is the live prompt with every line starting with it removed. */
const CLAUSE_START = arg("clause", "SPECIFIC STATE, NOT CATEGORY:");
const AFTER = GROUNDING_CHECKER_SYSTEM_PROMPT;
const clauseLine = AFTER.split("\n").find((l) => l.startsWith(CLAUSE_START));
if (!clauseLine) throw new Error("the SUBJECT TEST clause is not in the live prompt; nothing to A/B");
const BEFORE = AFTER.split("\n").filter((l) => !l.startsWith(CLAUSE_START)).join("\n");
if (BEFORE === AFTER || BEFORE.includes(CLAUSE_START)) throw new Error("arm derivation failed");
if (AFTER.length - BEFORE.length !== clauseLine.length + 1) throw new Error("arms differ by more than the clause");

type Arm = "before" | "after";
const optionsFor = (arm: Arm) =>
  arm === "after" ? {} : { invoke: (p: any) => invokeLLM({ ...p, messages: [{ role: "system", content: BEFORE }, p.messages[1]] }) };

type Run = { arm: Arm; fixtureId: string; run: number; wallMs: number; result: GroundingCheckResult; score: FixtureRunScore };
const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${a}/${b} = ${((100 * a) / b).toFixed(1)}%`);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set; nothing was run."); process.exit(2); }
  mkdirSync(OUT, { recursive: true });
  const arms: Arm[] = ["before", "after"];
  const jobs = arms.flatMap((arm) => GROUNDING_FIXTURES.flatMap((fx) => Array.from({ length: RUNS }, (_, run) => ({ arm, fx, run }))));
  const runs: Run[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const { arm, fx, run } = jobs[next++];
      const t0 = Date.now();
      const result = await checkGrounding(fx.asset, buildCoachFacts(fx.facts), optionsFor(arm) as any);
      const wallMs = Date.now() - t0;
      const score = scoreFixtureRun(fx, result);
      runs.push({ arm, fixtureId: fx.id, run, wallMs, result, score });
      console.log(`[${arm}] ${fx.id} run ${run + 1}: status=${result.status} f5=${score.f5.found}/${score.f5.expected} ` +
        `f5fp=${score.f5.falsePositives.length} control=${score.f5.controlHits.length} bio=${score.bio.found}/${score.bio.expected} ms=${wallMs}`);
    }
  }));

  const lines: string[] = ["# F5 SUBJECT TEST — A/B confirmation", "", `- fixtures ${GROUNDING_FIXTURES.length} × runs ${RUNS} × 2 arms = ${runs.length} model calls`, ""];
  lines.push("| metric | before | after |", "|---|---|---|");
  const by = (arm: Arm) => runs.filter((r) => r.arm === arm);
  const sum = (arm: Arm, f: (r: Run) => number) => by(arm).reduce((a, r) => a + f(r), 0);
  const pension = (arm: Arm) => by(arm).reduce((a, r) => a + r.score.f5.controlHits.filter((q) => /pension behind a salary/i.test(q)).length, 0);
  const pensionRuns = runs.filter((r) => r.fixtureId.startsWith("p1-")).length / 2;
  const row = (name: string, f: (a: Arm) => string) => lines.push(`| ${name} | ${f("before")} | ${f("after")} |`);
  row("**pension line flagged** (must-pass)", (a) => `${pension(a)}/${pensionRuns}`);
  row("all F5 control hits (must-pass lines flagged)", (a) => String(sum(a, (r) => r.score.f5.controlHits.length)));
  row("**F5 recall** (must-block found)", (a) => pct(sum(a, (r) => r.score.f5.found), sum(a, (r) => r.score.f5.expected)));
  row("F5 precision", (a) => { const fp = sum(a, (r) => r.score.f5.falsePositives.length); const tp = sum(a, (r) => r.score.f5.found); return pct(tp, tp + fp); });
  row("F2 biography recall", (a) => pct(sum(a, (r) => r.score.bio.found), sum(a, (r) => r.score.bio.expected)));
  row("F2 biography false positives", (a) => String(sum(a, (r) => r.score.bio.falsePositives.length)));
  row("grounded-as-expected", (a) => pct(sum(a, (r) => r.score.grounding.found), sum(a, (r) => r.score.grounding.expected)));
  row("conflicts / overstated found", (a) => `${sum(a, (r) => r.score.conflicts.found)} / ${sum(a, (r) => r.score.overstated.found)}`);
  row("extraction errors", (a) => String(sum(a, (r) => r.result.extractionErrors.total)));
  row("runs not `checked`", (a) => String(by(a).filter((r) => r.result.status !== "checked").length));
  row("median latency ms", (a) => String(median(by(a).map((r) => r.wallMs))));
  lines.push("", "## Every must-pass line flagged, by arm", "");
  for (const a of arms) {
    const hits = by(a).flatMap((r) => r.score.f5.controlHits.map((q) => `${r.fixtureId}#${r.run + 1}: ${q}`));
    lines.push(`**${a}** (${hits.length}):`, ...(hits.length ? hits.map((h) => `- ${h}`) : ["- none"]), "");
  }
  writeFileSync(join(OUT, "f5-subject-test-probe.json"), JSON.stringify({ runs, before: BEFORE, after: AFTER }, null, 2));
  writeFileSync(join(OUT, "f5-subject-test-probe.md"), lines.join("\n"));
  console.log("\n" + lines.join("\n"));
  console.log(`\nraw: ${join(OUT, "f5-subject-test-probe.json")}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
