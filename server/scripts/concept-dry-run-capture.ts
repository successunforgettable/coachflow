/**
 * concept-dry-run-capture.ts — read-only capture of what production's concept generation does for one ICP.
 *
 * Calls the REAL generateConceptsForIcp with `dryRun: true`. The gate, retries, partial delivery, trim and top-up all
 * run in the production function itself (no reimplementation here). The only write in that function is skipped.
 * Every gate verdict and generation error is recorded through `onGate`.
 *
 *   USER_ID ICP_ID [SERVICE_ID] OUT=<dir>
 * Run: railway run --environment production --service coachflow sh -c 'USER_ID=117174 ICP_ID=249 SERVICE_ID=272 OUT=… npx tsx server/scripts/concept-dry-run-capture.ts'
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ConceptGateRecord } from "../conceptGenerator";

const USER_ID = Number(process.env.USER_ID);
const ICP_ID = Number(process.env.ICP_ID);
const SERVICE_ID = process.env.SERVICE_ID ? Number(process.env.SERVICE_ID) : null;
const OUT = process.env.OUT ?? "/tmp/concept-dry-run-capture";

async function main() {
  if (!USER_ID || !ICP_ID) throw new Error("USER_ID and ICP_ID are required");
  mkdirSync(OUT, { recursive: true });
  const { generateConceptsForIcp } = await import("../conceptGenerator");
  const t0 = Date.now();
  const records: Array<ConceptGateRecord & { atSeconds: number }> = [];
  let outcome: Record<string, unknown>;
  try {
    const r = await generateConceptsForIcp({
      userId: USER_ID,
      icpId: ICP_ID,
      serviceId: SERVICE_ID,
      dryRun: true,
      onGate: (rec) => {
        const at = Math.round((Date.now() - t0) / 1000);
        records.push({ ...rec, atSeconds: at });
        console.log(
          `[capture] +${at}s ${rec.phase} #${rec.attempt}: ok=${rec.ok} returned=${rec.conceptsReturned} ` +
            `labels=[${rec.labels}]${rec.error ? ` ERROR=${rec.error}` : ""}`,
        );
      },
    });
    outcome = { completed: true, dryRun: r.dryRun === true, persisted: r.persisted, skipped: r.skipped, requested: r.requested, wouldPersistCount: r.wouldPersist?.length ?? null, wouldPersist: r.wouldPersist };
  } catch (err) {
    outcome = { completed: false, error: err instanceof Error ? err.message : String(err) };
  }
  const file = join(OUT, `concept-dry-run-icp${ICP_ID}.json`);
  writeFileSync(file, JSON.stringify({ userId: USER_ID, icpId: ICP_ID, serviceId: SERVICE_ID, seconds: Math.round((Date.now() - t0) / 1000), records, outcome }, null, 2));
  console.log(`[capture] outcome: ${JSON.stringify({ ...outcome, wouldPersist: undefined })}`);
  console.log(`[capture] full record: ${file}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[capture] harness error: ${e instanceof Error ? e.stack ?? e.message : e}`);
  process.exit(1);
});
