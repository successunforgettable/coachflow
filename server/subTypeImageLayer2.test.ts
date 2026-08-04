import { describe, it, expect } from "vitest";
import { generateAdImagePrompt, subTypeBackdropFor } from "./routers/adCreatives";
import {
  awarenessDeckPlan, awarenessPlanForCount, subTypePlanFor,
  SELLER_SUB_TYPES, AWARENESS_STAGES,
} from "./_core/conceptAxis";
import { rendererForStyle } from "./_core/imageGeneration";
import { AD_VARIATIONS } from "./_core/adVariations";

const PERSON = ["person_shocked", "person_intense", "person_curious"];
const STILL = "screenshot";
const ALL = [...PERSON, STILL];

describe("LAYER 2 — isolation: omitting subType changes nothing", () => {
  it("reproduces the Layer-1 prompt byte-for-byte when subType is absent", () => {
    for (const style of ALL) {
      for (const stage of [null, "unaware", "product_aware"]) {
        const before = generateAdImagePrompt(style, "fitness", "burnout", false, undefined, stage);
        expect(generateAdImagePrompt(style, "fitness", "burnout", false, undefined, stage, null)).toBe(before);
        expect(generateAdImagePrompt(style, "fitness", "burnout", false, undefined, stage, undefined)).toBe(before);
      }
    }
  });

  it("keeps the original dark backdrops when no subType is supplied", () => {
    expect(generateAdImagePrompt("person_shocked", "n", "p")).toMatch(/Dark grey\/black background\./);
    expect(generateAdImagePrompt("person_intense", "n", "p")).toMatch(/Dark background with a spotlight on the face\./);
    expect(generateAdImagePrompt("person_curious", "n", "p")).toMatch(/Dark grey background\./);
  });

  it("an unknown subType falls back to the original backdrop rather than injecting raw", () => {
    const before = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware");
    expect(generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", "bogus")).toBe(before);
  });

  it("uglyMode keeps its own UGC aesthetic — subType does not override it", () => {
    const ugly = generateAdImagePrompt("person_shocked", "n", "p", true, undefined, "unaware", "aspirational");
    expect(ugly).toMatch(/Raw UGC aesthetic/);
    expect(ugly).not.toMatch(/high-key natural daylight/);
  });
});

describe("LAYER 2 — the rendering pipeline is preserved", () => {
  it("model routing is unchanged", () => {
    expect(rendererForStyle(STILL)).toBe("gpt-image-1");
    for (const s of PERSON) expect(rendererForStyle(s)).toBe("flux-1.1-pro");
  });

  it("deck is still 4 and the object slot stays retired", () => {
    expect(AD_VARIATIONS).toHaveLength(4);
    expect(AD_VARIATIONS.map((v) => v.style)).not.toContain("object");
  });

  it("the shared object-slot fragments survive under every subType", () => {
    for (const style of ALL) {
      for (const st of SELLER_SUB_TYPES) {
        const p = generateAdImagePrompt(style, "n", "p", false, undefined, "unaware", st);
        expect(p).toMatch(/blank and unmarked/);       // cleanPlate
        expect(p).toMatch(/Composed for a portrait/);  // composition
      }
    }
  });
});

describe("LAYER 2 — no self-contradicting prompts (the four-times bug class)", () => {
  it("a bright subType never coexists with a hardcoded dark backdrop", () => {
    for (const style of PERSON) {
      const p = generateAdImagePrompt(style, "n", "p", false, undefined, "unaware", "aspirational");
      expect(p).toMatch(/high-key natural daylight/);
      expect(p).not.toMatch(/Dark grey|Dark background/);
    }
  });

  it("exactly one lighting clause is present, never two", () => {
    for (const st of SELLER_SUB_TYPES) {
      const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", st);
      expect((p.match(/Candid documentary photograph/g) ?? []).length).toBe(1);
      expect(p).not.toMatch(/dramatic directional lighting/); // the default clause is replaced
    }
  });

  it("the still life never receives person wording from a subType backdrop", () => {
    for (const st of SELLER_SUB_TYPES) {
      expect(subTypeBackdropFor(STILL, st)).not.toMatch(/\b(behind them|their|they)\b/i);
    }
  });

  it("subType backdrops are positively framed", () => {
    for (const st of SELLER_SUB_TYPES) {
      for (const style of ["person_shocked", STILL]) {
        expect(subTypeBackdropFor(style, st)).not.toMatch(/\b(no |not |never|avoid|without)\b/i);
      }
    }
  });
});

describe("LAYER 2 — batch assignment from [TESTING-MATRIX §2.1]", () => {
  it("assigns every slot a valid sub-type", () => {
    const plan = awarenessDeckPlan(4);
    for (const st of subTypePlanFor(plan)) expect(SELLER_SUB_TYPES).toContain(st);
  });

  it("varies sub-type across the deck — it is a diversity lever, not an identity", () => {
    // One seller's batch must NOT be one style: [SUBTYPE-ARCH §1] a Fixed Identity Model
    // "traps the brand's Entity ID in one narrow branch".
    const subs = subTypePlanFor(awarenessDeckPlan(4));
    expect(new Set(subs).size).toBeGreaterThan(1);
  });

  it("reproduces the matrix's first sub-type at each stage", () => {
    // Ad 1 Unaware/Esoteric, Ad 3 Problem-Aware/Grounded, Ad 5 Solution-Aware/Aspirational,
    // Ad 7 Product-Aware/Esoteric, Ad 8 Most-Aware/Aspirational.
    expect(subTypePlanFor(["unaware"])).toEqual(["esoteric"]);
    expect(subTypePlanFor(["problem_aware"])).toEqual(["grounded"]);
    expect(subTypePlanFor(["solution_aware"])).toEqual(["aspirational"]);
    expect(subTypePlanFor(["product_aware"])).toEqual(["esoteric"]);
    expect(subTypePlanFor(["most_aware"])).toEqual(["aspirational"]);
  });

  it("uses the matrix's SECOND sub-type on a stage's second appearance", () => {
    expect(subTypePlanFor(["unaware", "unaware"])).toEqual(["esoteric", "grounded"]);
    expect(subTypePlanFor(["problem_aware", "problem_aware"])).toEqual(["grounded", "aspirational"]);
  });

  it("is deterministic", () => {
    const plan = awarenessPlanForCount(8);
    expect(subTypePlanFor(plan)).toEqual(subTypePlanFor(plan));
  });

  it("produces 4 distinct (stage x subType) cells across the deck", () => {
    const plan = awarenessDeckPlan(4);
    const subs = subTypePlanFor(plan);
    expect(new Set(plan.map((s, i) => `${s}|${subs[i]}`)).size).toBe(4);
  });

  it("every stage has at least one matrix-defined sub-type", () => {
    for (const stage of AWARENESS_STAGES) expect(subTypePlanFor([stage])[0]).toBeTruthy();
  });
});

describe("LAYER 2 — stage and sub-type together drive variation", () => {
  it("four deck slots yield four distinct prompts", () => {
    const plan = awarenessDeckPlan(4);
    const subs = subTypePlanFor(plan);
    const styles = AD_VARIATIONS.map((v) => v.style);
    const prompts = plan.map((s, i) => generateAdImagePrompt(styles[i], "n", "p", false, undefined, s, subs[i]));
    expect(new Set(prompts).size).toBe(4);
  });

  it("same stage + different sub-type still differ — sub-type is doing real work", () => {
    const a = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", "grounded");
    const b = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", "esoteric");
    expect(a).not.toBe(b);
  });

  it("PD-4 survives Layer 2: Most-Aware keeps founder-still and text out of the pixels", () => {
    for (const st of SELLER_SUB_TYPES) {
      const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "most_aware", st);
      expect(p).toMatch(/faces the camera directly/);
      expect(p).toMatch(/carried by the overlay/);
    }
  });
});
