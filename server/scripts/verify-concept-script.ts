/**
 * verify-concept-script.ts — browser-free end-to-end check of the per-concept script generator.
 * Drives generateScriptForConcept through the FULL path (concept → cascade → LLM → structural validate +
 * compliance screen → persist). Prints a structural summary. Clean-room only.
 *
 * Usage:  npx tsx server/scripts/verify-concept-script.ts <conceptId> <userId>
 */
import "dotenv/config";
import { generateScriptForConcept } from "../conceptScriptGenerator";
import { getDb } from "../db";
import { conceptScripts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const conceptId = Number(process.argv[2] ?? 0);
  const userId = Number(process.argv[3] ?? 0);
  if (!conceptId || !userId) throw new Error("usage: verify-concept-script.ts <conceptId> <userId>");

  console.log(`[verify] generating script for concept=${conceptId} user=${userId} ...`);
  const scriptId = await generateScriptForConcept({ userId, conceptId });
  const db = await getDb();
  if (!db) throw new Error("no db");
  const [row] = await db.select().from(conceptScripts).where(eq(conceptScripts.id, scriptId));
  const scenes = (row.scenes as any[]) ?? [];
  const words = scenes.reduce((n, s) => n + (s.spokenLine ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
  console.log(`[verify] scriptId=${scriptId} awareness=${row.awareness} hookPattern=${row.hookPattern} target=${row.targetLengthSeconds}s`);
  console.log(`[verify] scenes=${scenes.length} totalSpokenWords=${words} firstSceneType=${scenes[0]?.sceneType}`);
  for (const s of scenes) {
    console.log(`  - [${s.sceneType}] spoken="${(s.spokenLine ?? "").slice(0, 70)}" | onScreen="${(s.onScreenText ?? "").slice(0, 24)}" | note="${(s.deliveryNote ?? "").slice(0, 30)}"`);
  }
  console.log(`[verify] teleprompter (${(row.teleprompter ?? "").length} chars):\n${(row.teleprompter ?? "").slice(0, 240)}`);
  process.exit(0);
}
main().catch((e) => { console.error("[verify] FAILED:", e instanceof Error ? e.message : String(e)); process.exit(1); });
