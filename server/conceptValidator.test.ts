import { describe, it, expect } from "vitest";
import { validateConceptSetStructure, type RawConcept } from "./_core/conceptValidator";

// A well-formed concept: fixed persona (implicit via the ICP), varying desire × awareness,
// all four ad-copy payload fields present, headline distinct from hook.
function ok(overrides: Partial<RawConcept> = {}): RawConcept {
  return {
    desire: "stop dreading Sunday evenings",
    awareness: "problem_aware",
    hookPattern: "problem_first",
    hook: "Every Sunday at 6pm the dread arrives before Monday even does.",
    headline: "Map your pivot in 90 days without a pay cut",
    shortText: "You know the feeling. Here is the 90-day way out.",
    longText: "The Sunday dread is a signal, not a life sentence. Here is the Map-Bridge-Move method...",
    ...overrides,
  };
}

describe("validateConceptSetStructure — structural check only (NOT the ICP-corpus fabrication check)", () => {
  it("passes a well-formed, distinct concept set", () => {
    const concepts = [
      ok({ desire: "escape Sunday dread", awareness: "problem_aware", hookPattern: "problem_first" }),
      ok({ desire: "become the person who pivoted", awareness: "unaware", hookPattern: "meme_humor" }),
      ok({ desire: "see proof it works for people like me", awareness: "product_aware", hookPattern: "social_proof" }),
    ];
    const result = validateConceptSetStructure(concepts);
    expect(result.ok).toBe(true);
  });

  it("fails when a required ad-copy payload field is missing", () => {
    const result = validateConceptSetStructure([ok({ longText: "" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hits.some((h) => h.classId === "concept_missing_field")).toBe(true);
      expect(result.failContext.length).toBeGreaterThan(0);
    }
  });

  it("fails when awareness is not one of the 5 Schwartz stages", () => {
    const result = validateConceptSetStructure([ok({ awareness: "very_aware" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some((h) => h.classId === "concept_bad_awareness")).toBe(true);
  });

  it("fails when hookPattern is not one of the 6 patterns", () => {
    const result = validateConceptSetStructure([ok({ hookPattern: "clickbait" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some((h) => h.classId === "concept_bad_hook_pattern")).toBe(true);
  });

  it("fails when the headline merely repeats the hook (must carry a different signal — brief §2)", () => {
    const same = "Map your pivot in 90 days without a pay cut";
    const result = validateConceptSetStructure([ok({ hook: same, headline: same })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some((h) => h.classId === "concept_headline_equals_hook")).toBe(true);
  });

  it("fails when two concepts share the same desire × awareness pair (not distinct)", () => {
    const concepts = [
      ok({ desire: "escape Sunday dread", awareness: "problem_aware" }),
      ok({ desire: "Escape  Sunday  Dread", awareness: "problem_aware" }), // same pair, cosmetic diff
    ];
    const result = validateConceptSetStructure(concepts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hits.some((h) => h.classId === "concept_duplicate_axis")).toBe(true);
  });

  it("allows the same desire at a DIFFERENT awareness stage (that is the intended fan-out)", () => {
    const concepts = [
      ok({ desire: "escape Sunday dread", awareness: "problem_aware" }),
      ok({ desire: "escape Sunday dread", awareness: "unaware", hookPattern: "meme_humor" }),
    ];
    const result = validateConceptSetStructure(concepts);
    expect(result.ok).toBe(true);
  });
});
