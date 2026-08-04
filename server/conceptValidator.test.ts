import { describe, it, expect } from "vitest";
import { validateConceptSetStructure, screenConceptCompliance, type RawConcept } from "./_core/conceptValidator";

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

  it("accepts direct_offer_urgency as a valid 7th hook pattern (Most-Aware close)", () => {
    const result = validateConceptSetStructure([
      ok({ awareness: "most_aware", hookPattern: "direct_offer_urgency" }),
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("screenConceptCompliance — routes concept text through the existing complianceFilter guards", () => {
  it("passes clean concept copy (no scarcity, no income claim)", () => {
    const result = screenConceptCompliance([ok()]);
    expect(result.ok).toBe(true);
  });

  it("flags FABRICATED scarcity — the highest risk of the Direct-Offer/Urgency hook", () => {
    const result = screenConceptCompliance([
      ok({
        hookPattern: "direct_offer_urgency",
        awareness: "most_aware",
        hook: "This offer expires tonight — gone forever at midnight.",
      }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failContext.toLowerCase()).toContain("scarcity");
  });

  it("flags a guaranteed income claim (hard-banned by complianceFilter REJECTED patterns)", () => {
    const result = screenConceptCompliance([
      ok({ shortText: "Earn $10,000 in 7 days guaranteed with this system." }),
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("validateConceptSetStructure — per-slot awareness plan enforcement", () => {
  const plan = ["unaware", "problem_aware", "solution_aware"] as const;

  it("passes when every concept sits in its assigned slot", () => {
    const set = [
      ok({ awareness: "unaware", desire: "a" }),
      ok({ awareness: "problem_aware", desire: "b" }),
      ok({ awareness: "solution_aware", desire: "c" }),
    ];
    expect(validateConceptSetStructure(set, plan).ok).toBe(true);
  });

  it("rejects a concept that substitutes a different valid stage", () => {
    const set = [
      ok({ awareness: "unaware", desire: "a" }),
      ok({ awareness: "most_aware", desire: "b" }), // slot 1 was assigned problem_aware
      ok({ awareness: "solution_aware", desire: "c" }),
    ];
    const r = validateConceptSetStructure(set, plan);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hits.some((h) => h.classId === "concept_wrong_awareness_slot")).toBe(true);
    // The retry prompt must restate the ASSIGNMENT, not the free-choice rule — otherwise the
    // model is invited to re-pick freely on the retry and the distribution never converges.
    expect(r.failContext).toContain("FIXED PER SLOT");
    expect(r.failContext).toContain("concept[1]=problem_aware");
  });

  it("does not double-report a slot mismatch when the stage is itself invalid", () => {
    const set = [ok({ awareness: "not_a_stage", desire: "a" })];
    const r = validateConceptSetStructure(set, ["unaware"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hits.some((h) => h.classId === "concept_bad_awareness")).toBe(true);
    expect(r.hits.some((h) => h.classId === "concept_wrong_awareness_slot")).toBe(false);
  });

  it("keeps its previous behaviour when no plan is supplied (backwards compatible)", () => {
    const set = [
      ok({ awareness: "most_aware", desire: "a" }),
      ok({ awareness: "most_aware", desire: "b" }),
    ];
    // Same-stage concepts with differing desires were legal before the plan existed, and callers
    // that pass no plan must not start failing.
    expect(validateConceptSetStructure(set).ok).toBe(true);
  });

  it("still enforces desire distinctness among concepts sharing an assigned stage", () => {
    const set = [
      ok({ awareness: "solution_aware", desire: "same desire" }),
      ok({ awareness: "solution_aware", desire: "same desire" }),
    ];
    const r = validateConceptSetStructure(set, ["solution_aware", "solution_aware"]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hits.some((h) => h.classId === "concept_duplicate_axis")).toBe(true);
  });
});
