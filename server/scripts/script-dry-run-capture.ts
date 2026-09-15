/**
 * script-dry-run-capture.ts — read-only capture of what production's video-script generation does for one concept.
 *
 * Calls the REAL generateScriptForConcept with `dryRun: true`. The prompt, gate, retries and attempt budget all run in
 * the production function itself (no reimplementation here). The only write in that function, the conceptScripts
 * insert, is skipped; the batch owner's jobs rows are never touched because the batch is not called.
 * Every gate verdict (with its structure / compliance / output sub-verdicts) and every generation error is recorded
 * through `onGate`.
 *
 * The only caller of `dryRun` by design until sprint 0b. Built in sprint 0a and NOT run: running it reads a real
 * database and calls the model, and needs its own authorisation.
 *
 *   USER_ID CONCEPT_ID OUT=<dir>
 * Shape: USER_ID=… CONCEPT_ID=… OUT=… npx tsx server/scripts/script-dry-run-capture.ts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ScriptGateRecord } from "../conceptScriptGenerator";

const USER_ID = Number(process.env.USER_ID);
const CONCEPT_ID = Number(process.env.CONCEPT_ID);
const OUT = process.env.OUT ?? "/tmp/script-dry-run-capture";

async function main() {
  if (!USER_ID || !CONCEPT_ID) throw new Error("USER_ID and CONCEPT_ID are required");
  mkdirSync(OUT, { recursive: true });
  const { generateScriptForConcept } = await import("../conceptScriptGenerator");
  const t0 = Date.now();
  const records: Array<ScriptGateRecord & { atSeconds: number }> = [];
  let outcome: Record<string, unknown>;
  try {
    const r = await generateScriptForConcept({
      userId: USER_ID,
      conceptId: CONCEPT_ID,
      dryRun: true,
      onGate: (rec) => {
        const at = Math.round((Date.now() - t0) / 1000);
        records.push({ ...rec, atSeconds: at });
        const axes = rec.axes
          ? ` structure=${rec.axes.structureOk} compliance=${rec.axes.complianceOk} output=${rec.axes.outputOk}`
          : "";
        console.log(
          `[capture] +${at}s attempt #${rec.attempt}: ok=${rec.ok}${axes} scenes=${rec.scenesReturned} ` +
            `labels=[${rec.labels}]${rec.error ? ` ERROR=${rec.error}` : ""}`,
        );
      },
    });
    outcome = { completed: true, dryRun: r.dryRun === true, scriptId: r.scriptId, wouldInsert: r.wouldInsert };
  } catch (err) {
    outcome = { completed: false, error: err instanceof Error ? err.message : String(err) };
  }
  const file = join(OUT, `script-dry-run-concept${CONCEPT_ID}.json`);
  writeFileSync(file, JSON.stringify({ userId: USER_ID, conceptId: CONCEPT_ID, seconds: Math.round((Date.now() - t0) / 1000), records, outcome }, null, 2));
  console.log(`[capture] outcome: ${JSON.stringify({ ...outcome, wouldInsert: undefined })}`);
  console.log(`[capture] full record: ${file}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[capture] harness error: ${e instanceof Error ? e.stack ?? e.message : e}`);
  process.exit(1);
});
