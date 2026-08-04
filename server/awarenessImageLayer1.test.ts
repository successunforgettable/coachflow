import { describe, it, expect } from "vitest";
import { generateAdImagePrompt, awarenessDepictionFor } from "./routers/adCreatives";
import { awarenessDeckPlan, awarenessPlanForCount, AWARENESS_STAGES } from "./_core/conceptAxis";
import { rendererForStyle } from "./_core/imageGeneration";
import { AD_VARIATIONS } from "./_core/adVariations";

const PERSON = ["person_shocked", "person_intense", "person_curious"];
const STILL = "screenshot";

describe("LAYER 1 — isolation: nothing changes unless a stage is passed", () => {
  it("omitting awareness reproduces the previous prompt byte-for-byte", () => {
    // The seven call sites that do not pass a stage must be completely unaffected.
    for (const style of [...PERSON, STILL]) {
      const before = generateAdImagePrompt(style, "fitness", "burnout", false, undefined);
      expect(generateAdImagePrompt(style, "fitness", "burnout", false, undefined, null)).toBe(before);
      expect(generateAdImagePrompt(style, "fitness", "burnout", false, undefined, undefined)).toBe(before);
    }
  });

  it("an unknown stage is ignored rather than injected raw", () => {
    const before = generateAdImagePrompt("person_shocked", "n", "p", false, undefined);
    expect(generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "bogus")).toBe(before);
  });

  it("the stage directive is APPENDED — the style template is untouched", () => {
    const before = generateAdImagePrompt("person_shocked", "n", "p", false, undefined);
    const after = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware");
    expect(after.startsWith(before)).toBe(true);
  });
});

describe("LAYER 1 — the rendering pipeline is preserved", () => {
  it("model routing is unchanged: screenshot stays on gpt-image-1, persons on Flux", () => {
    expect(rendererForStyle(STILL)).toBe("gpt-image-1");
    for (const s of PERSON) expect(rendererForStyle(s)).toBe("flux-1.1-pro");
  });

  it("the deck is still 4 and the object slot stays retired", () => {
    expect(AD_VARIATIONS).toHaveLength(4);
    expect(AD_VARIATIONS.map((v) => v.style)).not.toContain("object");
  });

  it("the object-slot-retirement fragments survive in every prompt", () => {
    // cleanPlate / composition / complianceNote are shared with `screenshot`; STATE.md forbids
    // sweeping them. Their presence is the guard.
    for (const style of [...PERSON, STILL]) {
      const p = generateAdImagePrompt(style, "n", "p", false, undefined, "unaware");
      expect(p).toMatch(/blank and unmarked/);      // cleanPlate
      expect(p).toMatch(/Composed for a portrait/); // composition
    }
  });
});

describe("LAYER 1 — style-aware directives (the four-times-repeated bug class)", () => {
  it("the still life NEVER receives person wording", () => {
    // nicheContext, the composition clause, complianceNote and noText were each written for the
    // person styles and pasted onto the still life, each producing a self-contradicting prompt.
    for (const stage of AWARENESS_STAGES) {
      const still = awarenessDepictionFor(STILL, stage);
      expect(still).not.toMatch(/\b(subject|bearing|posture|their head|expression|person)\b/i);
    }
  });

  it("person and still forms differ for every stage", () => {
    for (const stage of AWARENESS_STAGES) {
      expect(awarenessDepictionFor("person_shocked", stage)).not.toBe(awarenessDepictionFor(STILL, stage));
    }
  });

  it("directives are positively framed — diffusion has no logical NOT", () => {
    for (const stage of AWARENESS_STAGES) {
      for (const style of ["person_shocked", STILL]) {
        expect(awarenessDepictionFor(style, stage)).not.toMatch(/\b(no |not |never|avoid|without|don't)\b/i);
      }
    }
  });
});

describe("LAYER 1 — stage drives variation, and PD-4 holds", () => {
  it("every stage yields a distinct directive", () => {
    const seen = new Set(AWARENESS_STAGES.map((s) => awarenessDepictionFor("person_shocked", s)));
    expect(seen.size).toBe(AWARENESS_STAGES.length);
  });

  it("a 4-slot deck spans 4 DISTINCT stages — no repeated cell", () => {
    const plan = awarenessDeckPlan(4);
    expect(plan).toHaveLength(4);
    expect(new Set(plan).size).toBe(4);
  });

  it("the deck plan never allocates most_aware to a cold deck", () => {
    for (const n of [1, 2, 3, 4]) expect(awarenessDeckPlan(n)).not.toContain("most_aware");
  });

  it("the 8-concept batch plan is untouched by the deck plan", () => {
    expect(awarenessDeckPlan(8)).toEqual(awarenessPlanForCount(8));
  });

  it("PD-4: Most-Aware depicts a direct-address still and keeps text out of the pixels", () => {
    const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "most_aware");
    expect(p).toMatch(/faces the camera directly/);
    expect(p).toMatch(/carried by the overlay/);
  });

  it("four deck slots produce four different prompts on stage alone", () => {
    const plan = awarenessDeckPlan(4);
    const prompts = plan.map((stage) => generateAdImagePrompt("person_shocked", "n", "p", false, undefined, stage));
    expect(new Set(prompts).size).toBe(4);
  });
});
