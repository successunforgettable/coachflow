import { describe, it, expect } from "vitest";
import { generateAdImagePrompt } from "./routers/adCreatives";
import { awarenessDeckPlan, subTypePlanFor, visibilityTierPlanFor, AWARENESS_STAGES } from "./_core/conceptAxis";
import { AD_VARIATIONS } from "./_core/adVariations";

/**
 * VISIBILITY TIER — the repeated-sub-type fix.
 *
 * [SAME-TALENT §2] "If the lighting profile, talent face, and 'backdrop family' remain constant,
 * Andromeda identifies these as the same concept", and its table rates pose/backdrop tweaks
 * "Negligible - Likely collapsed into a single existing Entity ID". [STRUCTURAL-DISTINCTNESS §3(b)]
 * gives the bypass: face absence / tactile close-ups / product-only flat-lays.
 *
 * Verification here is CATEGORICAL, exactly as the mechanism is: face-present-same collapses,
 * face-absent lands in another branch. There is deliberately NO similarity percentage in this file —
 * Meta's Creative Similarity Score is an internal, unqueryable metric, and inventing a proxy number
 * to compare against its 40% bar would be a fabricated measurement.
 */

describe("visibility tier — planning", () => {
  it("the live 4-cell deck cedes exactly one cell, and it is the product_aware esoteric one", () => {
    const plan = awarenessDeckPlan(AD_VARIATIONS.length);
    const subs = subTypePlanFor(plan);
    const tiers = visibilityTierPlanFor(plan, subs);
    expect(tiers.filter((t) => t === "face_absent")).toHaveLength(1);
    const i = tiers.indexOf("face_absent");
    expect(plan[i]).toBe("product_aware");
    expect(subs[i]).toBe("esoteric");
    // ...and its twin — the other esoteric cell — keeps the face.
    const twin = subs.map((s, j) => (s === "esoteric" && j !== i ? j : -1)).filter((j) => j >= 0);
    expect(twin).toHaveLength(1);
    expect(tiers[twin[0]]).toBe("full_face");
  });

  it("a deck with no repeated sub-type cedes nothing", () => {
    expect(visibilityTierPlanFor(["unaware", "problem_aware", "solution_aware"], ["esoteric", "grounded", "aspirational"]))
      .toEqual(["full_face", "full_face", "full_face"]);
  });

  it("unaware NEVER cedes its face — the pattern interrupt needs a person", () => {
    // [AWARENESS-PLAYBOOK §2]: a native unposed moment that "mimics organic feed behavior".
    const tiers = visibilityTierPlanFor(["unaware", "unaware"], ["esoteric", "esoteric"]);
    expect(tiers).toEqual(["full_face", "full_face"]);
  });

  it("most_aware NEVER cedes its face — PD-4 is direct-to-camera address", () => {
    expect(visibilityTierPlanFor(["most_aware", "most_aware"], ["esoteric", "esoteric"]))
      .toEqual(["full_face", "full_face"]);
  });

  it("when an eligible stage repeats with an ineligible one, the ELIGIBLE cell cedes", () => {
    expect(visibilityTierPlanFor(["product_aware", "unaware"], ["esoteric", "esoteric"]))
      .toEqual(["face_absent", "full_face"]);
    expect(visibilityTierPlanFor(["unaware", "product_aware"], ["esoteric", "esoteric"]))
      .toEqual(["full_face", "face_absent"]);   // order must not decide it — stage semantics do
  });

  it("is deterministic", () => {
    const plan = awarenessDeckPlan(4);
    const subs = subTypePlanFor(plan);
    expect(visibilityTierPlanFor(plan, subs)).toEqual(visibilityTierPlanFor(plan, subs));
  });
});

describe("visibility tier — the face-absent prompt", () => {
  const faceAbsent = (stage: string) =>
    generateAdImagePrompt("person_curious", "career coaching", "p", false, "A woman in her late thirties", stage, "esoteric", "4:5", true);

  it("carries NO person wording — the whole point is bypassing the face encoder", () => {
    for (const stage of ["product_aware", "solution_aware", "problem_aware"]) {
      expect(faceAbsent(stage)).not.toMatch(/\b(dressed and styled|their head|expression|behind them|register through the moment)\b/i);
    }
  });

  it("is POSITIVELY framed — no bare negation naming the person to exclude", () => {
    // The first draft said "with no one in the picture". Diffusion has no logical NOT, and this file
    // has been bitten twice by phrasing a requirement as an absence.
    for (const stage of ["product_aware", "solution_aware", "problem_aware"]) {
      expect(faceAbsent(stage)).not.toMatch(/\bno one\b|\bno face\b|\bno people\b|\bwithout a\b/i);
    }
  });

  it("uses the SETTING backdrop, never the person one", () => {
    expect(faceAbsent("product_aware")).not.toMatch(/Behind them/);
    expect(faceAbsent("product_aware")).toMatch(/surfaces are natural and tactile/i);
  });

  it("is a DIFFERENT visual branch from the deck's existing still life", () => {
    // Trading a face collision for an object collision would prove nothing: the `screenshot` slot is
    // a laptop-and-desk scene, so the ceded cell must not be another laptop desk.
    const ceded = faceAbsent("product_aware");
    const stillLife = generateAdImagePrompt("screenshot", "career coaching", "p", false, undefined, "problem_aware", "grounded", "4:5");
    expect(ceded).toMatch(/flat-lay photographed from directly above/);
    expect(ceded).not.toMatch(/a laptop open at an angle/);
    expect(stillLife).toMatch(/a laptop open at an angle/);
  });

  it("keeps the no-text guarantee — face-absent must never mean labelled diagram", () => {
    // [STRUCTURAL-DISTINCTNESS §3(a)] recommends "Labeled Process Models". NOT taken: labels are
    // text in pixels, and that retired the object slot (48 renders, 2 leaked).
    for (const stage of ["product_aware", "solution_aware", "problem_aware"]) {
      const p = faceAbsent(stage);
      expect(p).not.toMatch(/\b(labell?ed|diagram|chart|framework|venn|whiteboard)\b/i);
      expect(p).toMatch(/blank and unmarked/);
    }
  });

  it("the flag is opt-in — omitting it leaves every existing call site byte-identical", () => {
    for (const style of ["person_shocked", "person_intense", "person_curious", "screenshot"]) {
      for (const stage of [null, "product_aware"]) {
        const base = generateAdImagePrompt(style, "n", "p", false, undefined, stage, "esoteric", "4:5");
        expect(generateAdImagePrompt(style, "n", "p", false, undefined, stage, "esoteric", "4:5", false)).toBe(base);
      }
    }
  });

  it("a stage with no face-absent form falls back to the person render rather than emptying", () => {
    const unaware = generateAdImagePrompt("person_curious", "n", "p", false, "A woman", "unaware", "esoteric", "4:5", true);
    expect(unaware).toMatch(/dressed and styled/); // fell back, did not produce a hollow prompt
  });

  it("CATEGORICAL PROOF: the two esoteric cells are now in different visibility tiers", () => {
    const plan = awarenessDeckPlan(4);
    const subs = subTypePlanFor(plan);
    const tiers = visibilityTierPlanFor(plan, subs);
    const esoteric = subs.map((s, i) => (s === "esoteric" ? i : -1)).filter((i) => i >= 0);
    expect(esoteric.length).toBe(2);
    expect(new Set(esoteric.map((i) => tiers[i])).size).toBe(2); // one full_face, one face_absent
    const prompts = esoteric.map((i) =>
      generateAdImagePrompt(AD_VARIATIONS[i].style, "n", "p", false, "A woman", plan[i], subs[i], "4:5", tiers[i] === "face_absent"));
    expect(/dressed and styled/.test(prompts[0])).not.toBe(/dressed and styled/.test(prompts[1]));
  });

  it("every awareness stage still produces a usable prompt with the flag set", () => {
    for (const stage of AWARENESS_STAGES) {
      const p = generateAdImagePrompt("person_curious", "n", "p", false, "A woman", stage, "esoteric", "4:5", true);
      expect(p.length).toBeGreaterThan(400);
      expect(p).toMatch(/blank and unmarked/);
    }
  });
});
