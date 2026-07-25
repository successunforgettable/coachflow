/**
 * campaignConcepts E2E — structural assertion for the Andromeda per-concept fan-out (mechanism only).
 *
 * The concept set is generated LAZILY at the ad-copy entry (ensureConceptsForIcp, background). This spec
 * reads the persisted rows straight from the local test DB and asserts the STRUCTURAL invariants the
 * generator + validateConceptSetStructure guarantee — it does NOT assert content truth (the ICP-corpus
 * anti-fabrication check is deferred until ICP grounding ships).
 *
 * REQUIRES the clean-room: local test DB with the campaignConcepts table (migration 0093 pushed locally)
 * and an ICP whose ad-copy node has been reached so concepts were generated.
 *   E2E_DB_URL     default mysql://root@127.0.0.1:3307/zap_test
 *   TEST_ICP_ID    the ICP whose concept set to inspect
 *
 * NOTE (2026-07-25): NOT yet executed against the clean-room — the dev server is down and the
 * hook→awareness mapping is unapproved (CANDIDATE_HOOK_AWARENESS_MAP.approved === false). Run this once
 * the clean-room is back up and the mapping is signed off.
 */
import { test, expect } from "@playwright/test";
import mysql from "mysql2/promise";

const DB_URL = process.env.E2E_DB_URL ?? "mysql://root@127.0.0.1:3307/zap_test";
const TEST_ICP_ID = Number(process.env.TEST_ICP_ID ?? 0);

const AWARENESS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"];
const HOOKS = ["problem_first", "founder_authenticity", "social_proof", "aspirational_transformation", "meme_humor", "data_chart", "direct_offer_urgency"];
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

test("campaignConcepts: structural invariants hold for the generated set", async () => {
  test.skip(!TEST_ICP_ID, "set TEST_ICP_ID to a clean-room ICP whose ad-copy node has been reached");

  const conn = await mysql.createConnection(DB_URL);
  try {
    const [rows] = (await conn.query(
      "SELECT `id`, `desire`, `awareness`, `hookPattern`, `hook`, `headline`, `shortText`, `longText` FROM `campaignConcepts` WHERE `icpId` = ? ORDER BY `id`",
      [TEST_ICP_ID],
    )) as any;

    // C1 — a set was generated.
    expect.soft(rows.length, `expected ≥1 concept for ICP ${TEST_ICP_ID}, got ${rows.length}`).toBeGreaterThan(0);

    const axisSeen = new Set<string>();
    const stages = new Set<string>();
    for (const r of rows) {
      // C2 — every ad-copy payload field present.
      for (const f of ["hook", "headline", "shortText", "longText"] as const) {
        expect.soft((r[f] ?? "").trim().length, `concept ${r.id}.${f} empty`).toBeGreaterThan(0);
      }
      // C3 — awareness ∈ 5 stages; hookPattern ∈ 6 patterns.
      expect.soft(AWARENESS, `concept ${r.id} awareness`).toContain(r.awareness);
      expect.soft(HOOKS, `concept ${r.id} hookPattern`).toContain(r.hookPattern);
      // C4 — headline carries a different signal from the hook.
      expect.soft(norm(r.hook) === norm(r.headline), `concept ${r.id} headline repeats hook`).toBeFalsy();
      // C5 — distinct on desire × awareness.
      const key = `${norm(r.desire)}|${norm(r.awareness)}`;
      expect.soft(axisSeen.has(key), `concept ${r.id} duplicates desire×awareness "${key}"`).toBeFalsy();
      axisSeen.add(key);
      stages.add(r.awareness);
    }
    // C6 — the set spans more than one awareness stage (the intended fan-out).
    expect.soft(stages.size, "concept set clustered at a single awareness stage").toBeGreaterThan(1);
  } finally {
    await conn.end();
  }
});
