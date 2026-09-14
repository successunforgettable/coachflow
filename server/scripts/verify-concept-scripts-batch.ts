/**
 * verify-concept-scripts-batch.ts — drives the REAL conceptScripts endpoints (appRouter.createCaller), the same
 * path the V2ConceptScripts screen uses, and reports what landed. Writes happen only through the product path.
 *
 *   MODE=kit          USER_ID ICP_ID  → generateForIcp on a kit WITH concepts; waits until every concept has
 *                                        a script or a failed job; reports set ids, lengths, word counts.
 *   MODE=noconcepts   USER_ID ICP_ID  → generateForIcp on a kit with NO concepts; expects preparing_concepts;
 *                                        waits for the concept set to land. Starts NO scripts.
 *   MODE=nokit        USER_ID ICP_ID  → generateForIcp on an ICP with NO kit; expects no_kit.
 *
 * OUT=<dir> receives scripts.json (full script bodies) and a log; stdout carries the summary only.
 * Run: railway run --environment production --service coachflow sh -c 'MODE=kit USER_ID=1 ICP_ID=291 OUT=… npx tsx server/scripts/verify-concept-scripts-batch.ts'
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { wordBudgetForSeconds } from "../_core/conceptAxis";

const MODE = process.env.MODE ?? "";
const USER_ID = Number(process.env.USER_ID);
const ICP_ID = Number(process.env.ICP_ID);
const OUT = process.env.OUT ?? "/tmp/verify-concept-scripts";
mkdirSync(OUT, { recursive: true });
const LOG = join(OUT, `${MODE}-icp${ICP_ID}.log`);
const say = (s: string) => {
  console.log(s);
  appendFileSync(LOG, s + "\n");
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const words = (s: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

async function main() {
  if (!["kit", "noconcepts", "nokit"].includes(MODE) || !USER_ID || !ICP_ID) throw new Error("MODE, USER_ID, ICP_ID required");
  const { appRouter } = await import("../routers");
  const caller = appRouter.createCaller({ user: { id: USER_ID, subscriptionTier: "pro", role: "admin" }, req: {} as any, res: {} as any } as any);
  const list = () => caller.conceptScripts.listForIcp({ icpId: ICP_ID });

  const before = await list();
  say(`[${new Date().toISOString()}] MODE=${MODE} user=${USER_ID} icp=${ICP_ID}`);
  say(`before: hasKit=${before.hasKit} concepts=${before.concepts.length} scripts=${before.concepts.filter((c) => c.script).length} conceptsJob=${before.conceptsJob?.status ?? "none"}`);

  const r = await caller.conceptScripts.generateForIcp({ icpId: ICP_ID });
  say(`generateForIcp → ${JSON.stringify(r)}`);

  if (MODE === "nokit") {
    const after = await list();
    say(`after: hasKit=${after.hasKit} concepts=${after.concepts.length} conceptsJob=${after.conceptsJob?.status ?? "none"}`);
    say(r.status === "no_kit" && after.concepts.length === 0 && !after.conceptsJob ? "RESULT PASS no_kit, nothing generated" : "RESULT FAIL");
    process.exit(0);
  }

  if (MODE === "noconcepts") {
    if (r.status !== "preparing_concepts") {
      say("RESULT FAIL expected preparing_concepts");
      process.exit(1);
    }
    // Concept generation runs INSIDE this process (setImmediate), so this loop must not exit until the rows have
    // landed. The job status is NOT the signal: the live reaper marks a pending job failed after 5 minutes while
    // the generation is still alive (conceptGenerator.ts, ensureConceptsForIcp header).
    const t0 = Date.now();
    let lastCount = -1;
    let stablePolls = 0;
    for (;;) {
      await sleep(15_000);
      const s = await list();
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      say(`  +${mins}m concepts=${s.concepts.length} conceptsJob=${s.conceptsJob?.status ?? "none"}`);
      stablePolls = s.concepts.length > 0 && s.concepts.length === lastCount ? stablePolls + 1 : 0;
      lastCount = s.concepts.length;
      if (s.concepts.length > 0 && (s.conceptsJob?.status === "complete" || stablePolls >= 3)) {
        const mix: Record<string, number> = {};
        for (const c of s.concepts) mix[c.awareness] = (mix[c.awareness] ?? 0) + 1;
        say(`concepts landed: ${s.concepts.length} ${JSON.stringify(mix)}; conceptsJob=${s.conceptsJob?.status}; scripts=${s.concepts.filter((c) => c.script).length} (none started by design)`);
        say("RESULT PASS preparing_concepts → concept set landed");
        process.exit(0);
      }
      if (Date.now() - t0 > 15 * 60_000) {
        say("RESULT FAIL concept set did not land within 15 minutes");
        process.exit(1);
      }
    }
  }

  // MODE=kit
  const t0 = Date.now();
  let sawJob = false;
  for (;;) {
    await sleep(15_000);
    const s = await list();
    const written = s.concepts.filter((c) => c.script).length;
    const pending = s.concepts.filter((c) => !c.script && c.job?.status === "pending").length;
    const failed = s.concepts.filter((c) => !c.script && c.job?.status === "failed").length;
    if (s.concepts.some((c) => c.job)) sawJob = true;
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    say(`  +${mins}m written=${written}/${s.concepts.length} pending=${pending} failed=${failed}`);
    const settled = sawJob && pending === 0 && written + failed === s.concepts.length;
    if (settled || Date.now() - t0 > 60 * 60_000) {
      const rows = s.concepts.map((c) => {
        const scenes = Array.isArray(c.script?.scenes) ? (c.script!.scenes as any[]) : [];
        const spoken = scenes.reduce((n, sc) => n + words(sc?.spokenLine ?? ""), 0);
        const b = c.script ? wordBudgetForSeconds(c.script.targetLengthSeconds) : null;
        return {
          conceptId: c.id,
          awareness: c.awareness,
          expectedSeconds: c.targetLengthSeconds,
          scriptId: c.script?.id ?? null,
          storedSeconds: c.script?.targetLengthSeconds ?? null,
          scenes: scenes.length,
          spokenWords: spoken,
          budget: b ? `${b.min}-${b.max}` : null,
          inBudget: b ? spoken >= b.min && spoken <= b.max : null,
          scriptSetId: c.script?.scriptSetId ?? null,
          job: c.job?.status ?? null,
        };
      });
      writeFileSync(join(OUT, `scripts-icp${ICP_ID}.json`), JSON.stringify(s.concepts, null, 2));
      for (const x of rows) say(`  ${JSON.stringify(x)}`);
      const setIds = new Set(rows.map((x) => x.scriptSetId).filter(Boolean));
      say(`distinct scriptSetIds among written scripts: ${setIds.size}`);
      say(`lengths match stage table: ${rows.every((x) => x.scriptId == null || x.storedSeconds === x.expectedSeconds)}`);
      say(settled ? `RESULT settled written=${written} failed=${failed}` : "RESULT TIMEOUT");
      process.exit(0);
    }
  }
}

main().catch((e) => {
  say(`ERROR ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
