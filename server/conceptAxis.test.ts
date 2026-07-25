import { describe, it, expect } from "vitest";
import {
  HOOK_PATTERNS,
  CANDIDATE_HOOK_AWARENESS_MAP,
  AWARENESS_STAGES,
  LENGTH_BY_AWARENESS,
  PLACEMENT_SAFE_CEILING_SECONDS,
  TWO_CUT_ENABLED,
  activeLengthForStage,
  wordBudgetForSeconds,
} from "./_core/conceptAxis";

describe("conceptAxis — 7 hook patterns + grounded APPROVED hook→awareness mapping", () => {
  it("includes the 7th hook pattern direct_offer_urgency", () => {
    expect(HOOK_PATTERNS).toContain("direct_offer_urgency");
    expect(HOOK_PATTERNS.length).toBe(7);
  });

  it("the mapping is APPROVED (grounded in Arfeen's NotebookLM corpus)", () => {
    expect(CANDIDATE_HOOK_AWARENESS_MAP.approved).toBe(true);
  });

  it("maps every awareness stage, with the grounded primaries", () => {
    for (const stage of AWARENESS_STAGES) {
      expect(CANDIDATE_HOOK_AWARENESS_MAP.map[stage]).toBeDefined();
    }
    const m = CANDIDATE_HOOK_AWARENESS_MAP.map;
    expect(m.unaware.primary).toBe("meme_humor");
    expect(m.problem_aware.primary).toBe("problem_first");
    expect(m.solution_aware.primary).toBe("aspirational_transformation");
    expect(m.product_aware.primary).toBe("social_proof");
    expect(m.most_aware.primary).toBe("direct_offer_urgency");
  });

  it("every mapped hook (primary + secondary) is a real hook pattern", () => {
    for (const stage of AWARENESS_STAGES) {
      const entry = CANDIDATE_HOOK_AWARENESS_MAP.map[stage];
      expect(HOOK_PATTERNS).toContain(entry.primary);
      for (const s of entry.secondary) expect(HOOK_PATTERNS).toContain(s);
    }
  });
});

describe("length config — research table stored, ACTIVE capped to placement-safe short", () => {
  it("stores the full research-ideal ranges for every stage (so two-cut can enable later)", () => {
    expect(LENGTH_BY_AWARENESS.unaware.researchIdealSeconds).toEqual([60, 90]);
    expect(LENGTH_BY_AWARENESS.problem_aware.researchIdealSeconds).toEqual([30, 60]);
    expect(LENGTH_BY_AWARENESS.solution_aware.researchIdealSeconds).toEqual([60, 90]);
    expect(LENGTH_BY_AWARENESS.product_aware.researchIdealSeconds).toEqual([15, 30]);
    expect(LENGTH_BY_AWARENESS.most_aware.researchIdealSeconds).toEqual([15, 15]);
  });

  it("two-cut (short + long-Feed) is PARKED — config off, not built", () => {
    expect(TWO_CUT_ENABLED).toBe(false);
  });

  it("caps every stage's ACTIVE length to the placement-safe ceiling", () => {
    for (const stage of AWARENESS_STAGES) {
      expect(activeLengthForStage(stage)).toBeLessThanOrEqual(PLACEMENT_SAFE_CEILING_SECONDS);
    }
    // long-ideal stages collapse to the ceiling; Most-Aware stays 15.
    expect(activeLengthForStage("unaware")).toBe(30);
    expect(activeLengthForStage("solution_aware")).toBe(30);
    expect(activeLengthForStage("most_aware")).toBe(15);
  });

  it("derives a spoken word budget from seconds (≈130 wpm)", () => {
    const b30 = wordBudgetForSeconds(30);
    expect(b30.target).toBeGreaterThan(50);
    expect(b30.target).toBeLessThan(80);
    expect(b30.max).toBeGreaterThan(b30.target);
    expect(wordBudgetForSeconds(15).target).toBeLessThan(b30.target);
  });
});
