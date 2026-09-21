/**
 * sprint0b-two-arm — the drafting-order measurement. Arm (a) = production's prompt. Arm (b) = the same prompt with the
 * word-budget arithmetic removed (lib-arm-b), so the budget is enforced ONLY by the gate that already enforces it.
 *
 * ZERO WRITES: every generation goes through generateScriptForConcept({ dryRun: true }), which returns before its only
 * insert. Nothing else on the path writes. Prove it with a whole-DB snapshot either side of the run.
 *
 *   railway run --environment production --service coachflow npx tsx server/scripts/sprint0b-two-arm.ts \
 *     --user 1 --runs 3 --out DIR
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateScriptForConcept, type ScriptGateRecord } from "../conceptScriptGenerator";
import { armBPrompt } from "./lib-arm-b";
import { metricsFor, setMetrics, type ScriptMetrics } from "./lib-script-metrics";
import { checkGrounding, type GroundingCheckResult } from "../_core/groundingChecker";
import { buildCoachFacts } from "../_core/coachFacts";
import { GROUNDING_FIXTURES } from "../__fixtures__/groundingCheckerScripts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const USER = parseInt(arg("user", "1"), 10);
const RUNS = Math.max(1, parseInt(arg("runs", "3"), 10) || 3);
const OUT = arg("out", join(tmpdir(), "sprint0b"));
const CONCEPTS = arg("concepts", "223,224,225,226,227,228,229,230").split(",").map((s) => parseInt(s, 10));
const CONCURRENCY = 3;
type Arm = "a" | "b";

/** The same coach facts sprint 2 used for kit 225 — these 8 concepts share its service and ICP. */
const KIT225_FACTS = GROUNDING_FIXTURES.find((f) => f.id === "k225-s229")!.facts;

type Cell = {
  arm: Arm; conceptId: number; run: number; ok: boolean; error?: string;
  attempts: number; firstPassOk: boolean | null; firstPassLabels: string[];
  gate: ScriptGateRecord[]; targetSeconds: number | null; text: string;
  metrics: ScriptMetrics | null; grounding: GroundingCheckResult | null; wallMs: number;
};

async function one(arm: Arm, conceptId: number, run: number): Promise<Cell> {
  const gate: ScriptGateRecord[] = [];
  const t0 = Date.now();
  const cell: Cell = { arm, conceptId, run, ok: false, attempts: 0, firstPassOk: null, firstPassLabels: [], gate, targetSeconds: null, text: "", metrics: null, grounding: null, wallMs: 0 };
  try {
    const r = await generateScriptForConcept({
      userId: USER, conceptId, dryRun: true,
      ...(arm === "b" ? { promptTransform: armBPrompt } : {}),
      onGate: (rec) => gate.push(rec),
    });
    const row = r.wouldInsert as any;
    cell.ok = true;
    cell.targetSeconds = row.targetLengthSeconds ?? null;
    cell.text = String(row.teleprompter ?? "").replace(/\n+/g, " ").trim();
  } catch (e: any) {
    cell.error = String(e?.message ?? e).slice(0, 300);
  }
  cell.wallMs = Date.now() - t0;
  const gated = gate.filter((g) => g.ok !== null);
  cell.attempts = gated.length;
  cell.firstPassOk = gated.length ? gated[0].ok : null;
  cell.firstPassLabels = gated.length && !gated[0].ok ? String(gated[0].labels || "").split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (cell.text) {
    cell.metrics = metricsFor(`c${conceptId}`, cell.text);
    cell.grounding = await checkGrounding(
      { assetType: "script", assetId: `0b-${arm}-${conceptId}-${run}`, fields: [{ name: "spoken", text: cell.text }] },
      buildCoachFacts(KIT225_FACTS),
    );
  }
  console.log(`[${arm}] c${conceptId} run${run + 1}: ok=${cell.ok} attempts=${cell.attempts} firstPass=${cell.firstPassOk} ` +
    `words=${cell.metrics?.words ?? "-"} bioUngrounded=${cell.grounding?.counts.specificBiographyUngrounded ?? "-"} f5=${cell.grounding?.counts.viewerFinancial ?? "-"} ms=${cell.wallMs}`);
  return cell;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set; nothing was run."); process.exit(2); }
  mkdirSync(OUT, { recursive: true });
  const jobs: Array<{ arm: Arm; conceptId: number; run: number }> = [];
  // D-i is locked on arm (a); `--arms a` is how every measurement after sprint 0b runs.
  const ARMS = arg("arms", "a,b").split(",").map((x) => x.trim()).filter(Boolean) as Arm[];
  for (const arm of ARMS) for (const c of CONCEPTS) for (let run = 0; run < RUNS; run++) jobs.push({ arm, conceptId: c, run });
  const cells: Cell[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) { const j = jobs[next++]; cells.push(await one(j.arm, j.conceptId, j.run)); }
  }));
  writeFileSync(join(OUT, "sprint0b-raw.json"), JSON.stringify({ user: USER, runs: RUNS, concepts: CONCEPTS, cells }, null, 2));
  console.log(`\nraw: ${join(OUT, "sprint0b-raw.json")}  (cells: ${cells.length})`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
