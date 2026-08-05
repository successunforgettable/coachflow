import { describe, it, expect } from "vitest";
import { generateAdImagePrompt, awarenessDepictionFor } from "./routers/adCreatives";
import { reservedBandWording } from "./_core/compositeHeadline";
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

  // ⚠️ DELETED 2026-08-05: "the stage directive is APPENDED — the style template is untouched".
  // That test asserted `after.startsWith(before)` and PASSED throughout, while the live render
  // showed the stage never reached the picture. It was locking in the defect: appending after the
  // style template had already fixed pose and expression is exactly the "styling is allowed to lead"
  // failure [AWARENESS-PLAYBOOK §3] describes. Replaced by the ordering assertions below.
});

describe("LAYER 1 — ORDER: the stage leads, the styling shell follows", () => {
  // The whole point of the 2026-08-05 rebuild. [AWARENESS-PLAYBOOK §3]: awareness dictates the shot
  // concept and composition; styling is "a secondary aesthetic shell".
  it("the stage action appears BEFORE the sub-type lighting shell", () => {
    for (const style of PERSON) {
      const p = generateAdImagePrompt(style, "n", "p", false, undefined, "solution_aware", "aspirational");
      const action = p.indexOf("laying plain cards out into a deliberate grid");
      const shell = p.indexOf("Candid documentary photograph");
      expect(action).toBeGreaterThanOrEqual(0);
      expect(shell).toBeGreaterThan(action);
    }
  });

  it("the stage composition appears BEFORE the styling shell too", () => {
    const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", "esoteric");
    expect(p.indexOf("grabbed candid")).toBeLessThan(p.indexOf("Candid documentary photograph"));
  });

  it("the hardcoded 'seated behind a plain table' no longer pins every stage", () => {
    // The second cause of the Layer-1 failure: composition fixed the body position regardless of
    // where the stage text sat. No stage-led prompt may carry it.
    for (const stage of AWARENESS_STAGES) {
      for (const style of PERSON) {
        expect(generateAdImagePrompt(style, "n", "p", false, undefined, stage)).not.toMatch(/seated behind a plain table/);
      }
    }
  });

  it("the invariant zone contract survives every stage — the compositor depends on it", () => {
    // The band is no longer a hand-written phrase; it is chosen from the compositor's own measured
    // geometry, so the assertion asks the compositor what it should say.
    const band11 = reservedBandWording(1024, 1024);
    for (const stage of AWARENESS_STAGES) {
      expect(generateAdImagePrompt("person_shocked", "n", "p", false, undefined, stage)).toContain(band11);
      expect(generateAdImagePrompt(STILL, "n", "p", false, undefined, stage)).toContain(band11);
    }
  });

  it("the reserved band FOLLOWS the emitted canvas, not the nominal ratio", () => {
    // Same nominal 4:5, two renderers, two real canvases: Flux 896x1088, gpt-image-1 1024x1280.
    const person = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "unaware", null, "4:5");
    const still = generateAdImagePrompt(STILL, "n", "p", false, undefined, "unaware", null, "4:5");
    expect(person).toContain(reservedBandWording(896, 1088));
    expect(still).toContain(reservedBandWording(1024, 1280));
  });
});

describe("LAYER 1 — separation of variables [SEPARATION §1]", () => {
  // Subject Action is a "Variable of Change" (earns a new Entity ID); lighting/backdrop are
  // "Variables of Constancy". Each must move on its own axis and neither may capture the other.
  it("stage owns the action: same stage, different sub-type keeps the SAME action clause", () => {
    const a = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "problem_aware", "grounded");
    const b = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "problem_aware", "esoteric");
    expect(a).toContain("outgrown their places");
    expect(b).toContain("outgrown their places");
    expect(a).not.toBe(b); // ...but the shell still differs
  });

  it("stage changes the action: same sub-type, different stage gives a different action", () => {
    const a = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "problem_aware", "grounded");
    const b = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "solution_aware", "grounded");
    expect(a).toContain("outgrown their places");
    expect(b).toContain("laying plain cards out into a deliberate grid");
  });

  it("the shot concept is stage-driven, not style-driven: one stage, two styles, same action", () => {
    const shocked = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, "solution_aware");
    const intense = generateAdImagePrompt("person_intense", "n", "p", false, undefined, "solution_aware");
    const action = "laying plain cards out into a deliberate grid";
    expect(shocked).toContain(action);
    expect(intense).toContain(action);
    // Style survives only as an emotional register, never as the shot.
    expect(shocked).toContain("animated and energised");
    expect(intense).toContain("focused and serious");
  });

  it("style no longer dictates pose: the old fixed expression clauses are gone", () => {
    for (const stage of AWARENESS_STAGES) {
      const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, stage);
      expect(p).not.toMatch(/EXCITED expression, wide eyes/);
    }
  });
});

describe("LAYER 1 — the locked constraints the research does NOT get to override", () => {
  it("no stage asks for legible in-image text, charts or calendars", () => {
    // [AWARENESS-PLAYBOOK §2] wants proof charts at Product-Aware and calendars at Most-Aware. The
    // object slot was retired over exactly this. Departure is documented on AWARENESS_DEPICTION.
    for (const stage of AWARENESS_STAGES) {
      for (const style of [...PERSON, STILL]) {
        const p = generateAdImagePrompt(style, "n", "p", false, undefined, stage);
        expect(p).not.toMatch(/\b(labell?ed|statistic|calendar|scarcity graphic|headline text)\b/i);
      }
    }
  });

  it("the clean-plate guarantee is never contradicted by a stage action", () => {
    // A "labelled diagram" four words from "blank paper" is the four-times-repeated bug class.
    for (const stage of AWARENESS_STAGES) {
      const p = generateAdImagePrompt("person_shocked", "n", "p", false, undefined, stage);
      expect(p).toMatch(/blank and unmarked/);
    }
  });

  it("the still life stays person-free and its screen stays abstract under every stage", () => {
    for (const stage of AWARENESS_STAGES) {
      const p = generateAdImagePrompt(STILL, "n", "p", false, undefined, stage);
      expect(p).toMatch(/the room empty and the chair pushed back/);
      expect(p).toMatch(/plain abstract chart shape in flat blocks of colour/);
    }
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

describe("LAYER 1 — the three amendments from the 2026-08-05 isolation render", () => {
  const NO_STAGE_MARKERS = ["n", "p", false, undefined] as const;

  it("FIX 1 — Problem-Aware carries friction in the ENVIRONMENT, never as depicted suffering", () => {
    // [GUARDRAILS §3] lists "Heads in hands" as a PROHIBITED DISTRESS TRIGGER carrying "a total
    // retrieval penalty". The first rebuild shipped exactly that shape; this is the guard.
    for (const style of [...PERSON, STILL]) {
      const p = generateAdImagePrompt(style, "n", "p", false, undefined, "problem_aware");
      expect(p).not.toMatch(/hand at the temple|head in hands|rubbing temples|slumped|despair|tearful/i);
      expect(p).toMatch(/overtaken by the task/);
    }
  });

  it("FIX 2 — Product-Aware is an expert IN ACTION, not a head-on portrait", () => {
    const p = generateAdImagePrompt("person_intense", "n", "p", false, undefined, "product_aware");
    expect(p).toMatch(/mid-demonstration/);
    expect(p).toMatch(/off-camera/);
  });

  it("FIX 2 — Product-Aware does NOT collide with Most-Aware's PD-4 direct address", () => {
    // Two stages converging on one picture is the Entity ID failure this whole layer exists to stop.
    const prod = generateAdImagePrompt("person_intense", "n", "p", false, undefined, "product_aware");
    const most = generateAdImagePrompt("person_intense", "n", "p", false, undefined, "most_aware");
    expect(most).toMatch(/faces the camera directly/);   // PD-4 keeps direct address…
    expect(prod).not.toMatch(/faces the camera directly/); // …and product_aware must not take it
    expect(prod).not.toBe(most);
  });

  it("FIX 3 — Solution-Aware keeps its proven action but moves focal work off the lower edge", () => {
    const p = generateAdImagePrompt("person_intense", "n", "p", false, undefined, "solution_aware");
    expect(p).toContain("laying plain cards out into a deliberate grid"); // action UNCHANGED
    expect(p).toMatch(/middle band of the frame/);
    expect(p).toMatch(/softly out of focus/);
  });

  it("FIX 3 — the overlay band is named as defocused foreground for every stage", () => {
    // [COHERENCE §4] Bokeh Engineering — a positive instruction, not an absence to infer.
    for (const stage of AWARENESS_STAGES) {
      expect(generateAdImagePrompt("person_shocked", "n", "p", false, undefined, stage))
        .toMatch(/falling softly out of focus/);
    }
  });

  it("the amendments do not disturb the no-stage path", () => {
    for (const style of [...PERSON, STILL]) {
      const bare = generateAdImagePrompt(style, ...NO_STAGE_MARKERS);
      expect(bare).toMatch(/Composed for a portrait/);
      expect(bare).not.toMatch(/overtaken by the task|mid-demonstration|middle band/);
    }
  });
});
