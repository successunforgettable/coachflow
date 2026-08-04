/**
 * verify-concept-generation.ts — browser-free end-to-end check of the campaignConcepts mechanism.
 *
 * Drives generateConceptsForIcp against a real ICP through the FULL path (LLM → structural validation +
 * complianceFilter screen → delete-then-insert). Prints a structural summary. Clean-room only.
 *
 * Usage:  npx tsx server/scripts/verify-concept-generation.ts <icpId> <userId> [count]
 */
import "dotenv/config";
import { generateConceptsForIcp } from "../conceptGenerator";
import { getDb } from "../db";
import { campaignConcepts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const icpId = Number(process.argv[2] ?? 0);
  const userId = Number(process.argv[3] ?? 0);
  const count = Number(process.argv[4] ?? 8);
  if (!icpId || !userId) throw new Error("usage: verify-concept-generation.ts <icpId> <userId> [count]");

  console.log(`[verify] generating ${count} concepts for icp=${icpId} user=${userId} ...`);
  const res = await generateConceptsForIcp({ userId, icpId, count });
  console.log(`[verify] generateConceptsForIcp returned: ${res.persisted} persisted, ${res.skipped} skipped of ${res.requested} requested`);

  const db = await getDb();
  if (!db) throw new Error("no db");
  const rows = await db.select().from(campaignConcepts).where(eq(campaignConcepts.icpId, icpId));

  const stages = new Set(rows.map((r) => r.awareness));
  const hooks = new Set(rows.map((r) => r.hookPattern));
  const axisKeys = new Set(rows.map((r) => `${(r.desire ?? "").trim().toLowerCase()}|${r.awareness}`));
  console.log(`[verify] persisted rows        : ${rows.length}`);
  console.log(`[verify] awareness stages used : ${Array.from(stages).join(", ")}`);
  console.log(`[verify] hook patterns used    : ${Array.from(hooks).join(", ")}`);
  console.log(`[verify] distinct desire×aware : ${axisKeys.size} (should equal ${rows.length})`);
  for (const r of rows) {
    console.log(`  - [${r.awareness}/${r.hookPattern}] hook="${(r.hook ?? "").slice(0, 60)}" | headline="${(r.headline ?? "").slice(0, 50)}"`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify] FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
