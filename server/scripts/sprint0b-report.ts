/** sprint0b-report — reads sprint0b-raw.json and the two controls, and prints the comparison. No model calls. */
import { readFileSync } from "fs";
import { metricsFor, setMetrics } from "./lib-script-metrics";
import { readCoachNine } from "./lib-controls";

const RAW = process.argv[2];
const KIT225 = process.argv[3];
const d = JSON.parse(readFileSync(RAW, "utf8"));
const cells: any[] = d.cells;
const BUDGET: Record<number, { min: number; max: number }> = { 30: { min: 75, max: 90 }, 60: { min: 150, max: 180 } };
const arms = ["a", "b"] as const;
const by = (a: string) => cells.filter((c) => c.arm === a);
const pc = (n: number, d0: number) => (d0 === 0 ? "n/a" : `${n}/${d0} = ${((100 * n) / d0).toFixed(0)}%`);
const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const row = (name: string, f: (a: string) => string) => console.log(`| ${name} | ${f("a")} | ${f("b")} |`);

console.log(`cells: ${cells.length} (${by("a").length} arm a / ${by("b").length} arm b)\n`);
console.log("| metric | arm (a) prompt-enforced | arm (b) gate-enforced |");
console.log("|---|---|---|");
row("**produced a script within 3 attempts**", (a) => pc(by(a).filter((c) => c.ok).length, by(a).length));
row("**first-pass gate PASS**", (a) => pc(by(a).filter((c) => c.firstPassOk === true).length, by(a).length));
row("mean attempts", (a) => mean(by(a).map((c) => c.attempts)).toFixed(2));
row("attempts = 1 / 2 / 3", (a) => [1, 2, 3].map((n) => by(a).filter((c) => c.attempts === n).length).join(" / "));
// first-pass block families
const fams = Array.from(new Set(cells.flatMap((c) => c.firstPassLabels as string[]))).sort();
console.log("\n**first-pass block rate per family** (K8)\n");
console.log("| family | arm (a) | arm (b) |");
console.log("|---|---|---|");
for (const f of fams) row(f, (a) => pc(by(a).filter((c) => c.firstPassLabels.includes(f)).length, by(a).length));

console.log("\n**length** (the variable under test)\n");
console.log("| metric | arm (a) | arm (b) |");
console.log("|---|---|---|");
const ok = (a: string) => by(a).filter((c) => c.metrics);
row("mean words, 30 s (floor 75 / ceiling 90)", (a) => mean(ok(a).filter((c) => c.targetSeconds === 30).map((c) => c.metrics.words)).toFixed(1));
row("mean words, 60 s (floor 150 / ceiling 180)", (a) => mean(ok(a).filter((c) => c.targetSeconds === 60).map((c) => c.metrics.words)).toFixed(1));
row("**final script OVER ceiling**", (a) => pc(ok(a).filter((c) => c.metrics.words > BUDGET[c.targetSeconds].max).length, ok(a).length));
row("**final script UNDER floor** (gate never checks this)", (a) => pc(ok(a).filter((c) => c.metrics.words < BUDGET[c.targetSeconds].min).length, ok(a).length));
row("inside the band", (a) => pc(ok(a).filter((c) => { const b = BUDGET[c.targetSeconds]; return c.metrics.words >= b.min && c.metrics.words <= b.max; }).length, ok(a).length));

console.log("\n**craft** (instrument identical for both arms and both controls)\n");
console.log("| metric | arm (a) | arm (b) |");
console.log("|---|---|---|");
row("hook ≤ 10 words", (a) => pc(ok(a).filter((c) => c.metrics.hookWords <= 10).length, ok(a).length));
row("mean hook words", (a) => mean(ok(a).map((c) => c.metrics.hookWords)).toFixed(1));
row("longest sentence ≤ 18", (a) => pc(ok(a).filter((c) => c.metrics.longestSentence <= 18).length, ok(a).length));
row("mean longest sentence", (a) => mean(ok(a).map((c) => c.metrics.longestSentence)).toFixed(1));
row("mean sentence SD", (a) => mean(ok(a).map((c) => c.metrics.sentenceSD)).toFixed(2));
row("mean contractions/100w", (a) => mean(ok(a).map((c) => c.metrics.contractionsPer100)).toFixed(2));
row("fragment run ≤ 3 (D-l)", (a) => pc(ok(a).filter((c) => c.metrics.longestFragmentRun <= 3).length, ok(a).length));

console.log("\n**grounding** (F2/F5, record-only; beats-present instrument)\n");
console.log("| metric | arm (a) | arm (b) |");
console.log("|---|---|---|");
const g = (a: string) => by(a).filter((c) => c.grounding && c.grounding.status === "checked");
row("grounding checks that completed", (a) => pc(g(a).length, by(a).filter((c) => c.grounding).length));
row("**scripts with ≥1 ungrounded specific biography**", (a) => pc(g(a).filter((c) => c.grounding.counts.specificBiographyUngrounded > 0).length, g(a).length));
row("total ungrounded specific biography claims", (a) => String(g(a).reduce((n, c) => n + c.grounding.counts.specificBiographyUngrounded, 0)));
row("scripts with ≥1 F5 viewer-finance finding", (a) => pc(g(a).filter((c) => c.grounding.counts.viewerFinancial > 0).length, g(a).length));
row("overstated / conflicts", (a) => `${g(a).reduce((n, c) => n + c.grounding.counts.overstated, 0)} / ${g(a).reduce((n, c) => n + c.grounding.counts.conflicts, 0)}`);

console.log("\n**set-level repetition** — one set = the 8 concepts of one arm at one run index\n");
console.log("| set | pairs over 27% | max overlap | 4-grams in 3+ |");
console.log("|---|---|---|---|");
for (const a of arms) for (let r = 0; r < d.runs; r++) {
  const s = by(a).filter((c) => c.run === r && c.text).map((c) => ({ id: `c${c.conceptId}`, text: c.text }));
  if (s.length < 2) continue;
  const m = setMetrics(s, []);
  console.log(`| arm (${a}) run ${r + 1} (${s.length} scripts) | ${m.pairsOverCap}/${m.pairs} | ${m.maxOverlap}% | ${m.shared4gramCount} |`);
}
// controls, measured in this same execution (§15f)
const nine = readCoachNine();
const nm = nine.map((s) => metricsFor(s.id, s.text));
const nraw = setMetrics(nine, []), nstr = setMetrics(nine, ["shez", "four patterns"]);
const k = readFileSync(KIT225, "utf8").trim().split("\n").map((l) => l.split("\t")).map((r) => ({ id: "c" + r[1], text: r[3] }));
const kraw = setMetrics(k, []), kstr = setMetrics(k, ["Career Layer Excavation"]);
console.log(`| **POSITIVE CONTROL** coach-voice nine, raw | ${nraw.pairsOverCap}/${nraw.pairs} | ${nraw.maxOverlap}% | ${nraw.shared4gramCount} |`);
console.log(`| **POSITIVE CONTROL** stripped (name+method) | ${nstr.pairsOverCap}/${nstr.pairs} | ${nstr.maxOverlap}% | ${nstr.shared4gramCount} |`);
console.log(`| **NEGATIVE CONTROL** kit 225 live, raw | ${kraw.pairsOverCap}/${kraw.pairs} | ${kraw.maxOverlap}% | ${kraw.shared4gramCount} |`);
console.log(`| **NEGATIVE CONTROL** stripped (method) | ${kstr.pairsOverCap}/${kstr.pairs} | ${kstr.maxOverlap}% | ${kstr.shared4gramCount} |`);
console.log(`\npositive control per-script: hook ${Math.min(...nm.map((m) => m.hookWords))}–${Math.max(...nm.map((m) => m.hookWords))} · longest sentence ${Math.min(...nm.map((m) => m.longestSentence))}–${Math.max(...nm.map((m) => m.longestSentence))} · contractions ${Math.min(...nm.map((m) => m.contractionsPer100)).toFixed(2)}–${Math.max(...nm.map((m) => m.contractionsPer100)).toFixed(2)} · fragment run max ${Math.max(...nm.map((m) => m.longestFragmentRun))}`);
const fails = cells.filter((c) => !c.ok);
console.log(`\nfailed to produce a script (3 attempts exhausted or error): ${fails.length}`);
for (const f of fails.slice(0, 12)) console.log(`  [${f.arm}] c${f.conceptId} run${f.run + 1}: ${f.error ?? "gate never passed"}`);
