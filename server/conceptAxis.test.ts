import { describe, it, expect } from "vitest";
import { HOOK_PATTERNS, CANDIDATE_HOOK_AWARENESS_MAP, AWARENESS_STAGES } from "./_core/conceptAxis";

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
