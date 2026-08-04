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
  awarenessPlanForCount,
  COLD_WEIGHTED_STAGE_MIX,
  DEFAULT_CONCEPT_COUNT,
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

  it("uses the grounded per-duration word-budget table (reports), not the old 130-wpm formula", () => {
    // 15s → 30–40 words, max 45 (was 33 / max 50 under the formula)
    const b15 = wordBudgetForSeconds(15);
    expect(b15.target).toBeGreaterThanOrEqual(30);
    expect(b15.target).toBeLessThanOrEqual(40);
    expect(b15.max).toBe(45);
    // 30s → 75–85 words, max 90 (was 65 / max 98 — the over-cap that let a 94-word script pass)
    const b30 = wordBudgetForSeconds(30);
    expect(b30.target).toBeGreaterThanOrEqual(75);
    expect(b30.target).toBeLessThanOrEqual(85);
    expect(b30.max).toBe(90);
  });
});

describe("awarenessPlanForCount — cold-weighted, deterministic batch distribution", () => {
  it("reproduces the prospecting-research allocation at the default count of 8", () => {
    // docs/andromeda/prospecting-research/ — "Prospecting Campaign Ad Concept Distribution" §3
    // (Proportional Weighting Model table) and "The Definitive B2C Prospecting & Creative
    // Architecture Playbook" §4 (8-Concept Prospecting Batch Allocation), stated independently.
    // SUPERSEDED the earlier 1/2/3/2/0 taken from the Entity-ID Protocol §3 worked example.
    const plan = awarenessPlanForCount(DEFAULT_CONCEPT_COUNT);
    expect(plan).toHaveLength(8);
    const count = (s: string) => plan.filter((p) => p === s).length;
    expect(count("unaware")).toBe(3);
    expect(count("problem_aware")).toBe(3);
    expect(count("solution_aware")).toBe(1);
    expect(count("product_aware")).toBe(1);
    expect(count("most_aware")).toBe(0);
  });

  it("puts 75% of an 8-batch in the top two stages, per the reports' own percentages", () => {
    // Report 1 §3 states this twice: "Weighting 75% of assets toward the top of the funnel
    // (Unaware and Problem-Aware)" and "the 25% warmer weighting". Both must hold.
    const plan = awarenessPlanForCount(8);
    const top = plan.filter((s) => s === "unaware" || s === "problem_aware").length;
    const warm = plan.filter((s) => s === "solution_aware" || s === "product_aware").length;
    expect(top / 8).toBeCloseTo(0.75);
    expect(warm / 8).toBeCloseTo(0.25);
  });

  it("never zeroes the warmer tail — it guards against Entity-ID pigeonholing", () => {
    // Report 1 §3 calls the 25% warmer weighting "a vital safeguard against Entity-ID
    // pigeonholing". At the default batch size both warmer stages must be represented.
    const plan = awarenessPlanForCount(8);
    expect(plan).toContain("solution_aware");
    expect(plan).toContain("product_aware");
  });

  it("allocates no most_aware slot at any batch size — it carries weight 0", () => {
    expect(COLD_WEIGHTED_STAGE_MIX.most_aware).toBe(0);
    for (let n = 1; n <= 24; n++) {
      expect(awarenessPlanForCount(n).filter((s) => s === "most_aware")).toHaveLength(0);
    }
  });

  it("always returns exactly `count` slots, all of them valid stages", () => {
    for (let n = 1; n <= 24; n++) {
      const plan = awarenessPlanForCount(n);
      expect(plan).toHaveLength(n);
      for (const stage of plan) expect(AWARENESS_STAGES).toContain(stage);
    }
  });

  it("keeps the cold majority at every batch size", () => {
    // The three cold stages must never fall to a minority of the batch — that is the whole point
    // of the weighting, and largest-remainder rounding must not erode it at awkward sizes.
    const cold = new Set(["unaware", "problem_aware", "solution_aware"]);
    for (let n = 2; n <= 24; n++) {
      const plan = awarenessPlanForCount(n);
      const coldCount = plan.filter((s) => cold.has(s)).length;
      expect(coldCount * 2).toBeGreaterThanOrEqual(n);
    }
  });

  it("is deterministic — the same count always yields the identical plan", () => {
    for (const n of [3, 8, 12]) {
      expect(awarenessPlanForCount(n)).toEqual(awarenessPlanForCount(n));
    }
  });

  it("interleaves rather than clustering, so adjacent slots differ where possible", () => {
    const plan = awarenessPlanForCount(8);
    // The research's own worked example interleaves; grouped output would read as 3 identical
    // consecutive briefs to the generator.
    expect(plan[0]).not.toBe(plan[1]);
  });

  it("degrades safely on nonsense input", () => {
    expect(awarenessPlanForCount(0)).toEqual([]);
    expect(awarenessPlanForCount(-5)).toEqual([]);
    expect(awarenessPlanForCount(NaN)).toEqual([]);
  });
});
