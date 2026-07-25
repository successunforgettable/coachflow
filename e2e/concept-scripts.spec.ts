/**
 * conceptScripts E2E — structural assertion for the Andromeda per-concept video-script generator.
 *
 * Reads persisted conceptScripts straight from the local test DB (joined to campaignConcepts) and asserts
 * the STRUCTURAL invariants the generator + validateScriptStructure guarantee. Does NOT assert content
 * truth/quality (deferred to the ICP grounding sprint). Requires the clean-room: local test DB with the
 * conceptScripts table (migration 0095 pushed locally) and at least one generated script.
 *   E2E_DB_URL   default mysql://root@127.0.0.1:3307/zap_test
 */
import { test, expect } from "@playwright/test";
import mysql from "mysql2/promise";

const DB_URL = process.env.E2E_DB_URL ?? "mysql://root@127.0.0.1:3307/zap_test";
const AWARENESS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"];
const HOOKS = ["problem_first", "founder_authenticity", "social_proof", "aspirational_transformation", "meme_humor", "data_chart", "direct_offer_urgency"];
const countWords = (s: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;
const maxWordsFor = (sec: number) => Math.round(Math.round((sec * 130) / 60) * 1.5);

test("conceptScripts: structural invariants hold for every generated script", async () => {
  const conn = await mysql.createConnection(DB_URL);
  try {
    const [rows] = (await conn.query(
      "SELECT `cs`.`id`, `cs`.`awareness`, `cs`.`hookPattern`, `cs`.`targetLengthSeconds`, `cs`.`scenes`, `cs`.`teleprompter`, `cc`.`hookPattern` AS `conceptHook` " +
        "FROM `conceptScripts` `cs` JOIN `campaignConcepts` `cc` ON `cc`.`id` = `cs`.`conceptId` ORDER BY `cs`.`id`",
    )) as any;

    // S1 — at least one script was generated.
    expect.soft(rows.length, `expected ≥1 conceptScript, got ${rows.length}`).toBeGreaterThan(0);

    for (const r of rows) {
      const scenes = typeof r.scenes === "string" ? JSON.parse(r.scenes) : r.scenes;
      // S2 — enough scenes.
      expect.soft(scenes.length, `script ${r.id} scenes`).toBeGreaterThanOrEqual(3);
      // S3 — first scene is the hook.
      expect.soft((scenes[0]?.sceneType ?? "").toLowerCase(), `script ${r.id} opening`).toBe("hook");
      // S4 — every scene has a spokenLine.
      for (const sc of scenes) expect.soft(countWords(sc.spokenLine), `script ${r.id} empty spokenLine`).toBeGreaterThan(0);
      // S5 — enums valid.
      expect.soft(AWARENESS, `script ${r.id} awareness`).toContain(r.awareness);
      expect.soft(HOOKS, `script ${r.id} hookPattern`).toContain(r.hookPattern);
      // S6 — hookPattern matches the concept's hookPattern (hook-match by construction).
      expect.soft(r.hookPattern, `script ${r.id} hook≠concept`).toBe(r.conceptHook);
      // S7 — total spoken length within the capped target budget.
      const total = scenes.reduce((n: number, sc: any) => n + countWords(sc.spokenLine), 0);
      expect.soft(total, `script ${r.id} over ${r.targetLengthSeconds}s budget`).toBeLessThanOrEqual(maxWordsFor(r.targetLengthSeconds));
      // S8 — teleprompter is the concatenated spoken lines (non-empty).
      expect.soft(countWords(r.teleprompter), `script ${r.id} teleprompter empty`).toBeGreaterThan(0);
    }
  } finally {
    await conn.end();
  }
});
