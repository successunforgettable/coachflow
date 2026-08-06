import { describe, it, expect } from "vitest";
import { generateAdImagePrompt } from "./routers/adCreatives";
import { rendererForStyle } from "./_core/imageGeneration";
import { FEED_ASPECT } from "./_core/adVariations";

/**
 * DEPLOY-GATE FIXTURE for the two shared procedures that have no other test.
 *
 * `regenerateSingle` (routers/adCreatives.ts:1024) and `makeVertical` (:1182) reconstruct their
 * prompt from the STORED ROW and pass no awareness stage, so they must take the LEGACY path and be
 * byte-unchanged by the stage-led rebuild. They are two of the five wizard procedures with no
 * automated coverage and are historically error-prone (P6b), so they gate the deploy.
 *
 * ⚠️ SCOPE CORRECTION 2026-08-06. "Byte-unchanged" applies to the PROMPT TEXT, which is still true —
 * both procedures take PATH A, which early-exits before the ratio-aware zone wording is reached, so
 * the aspectRatio now passed by regenerateSingle is inert until a stage is wired. It does NOT apply
 * to the CANVAS or the RENDERER: regenerateSingle was emitting 1:1 while the deck it patches emits
 * 4:5, and was routing every style to Flux. Those two are fixed; the routing assertion below was
 * inverted to match. The prompt-shape assertions are untouched and still hold.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE THE FIRST VERSION OF THIS CHECK WAS MIS-SPECIFIED. It asserted the
 * PERSON composition ("seated behind a plain table") against a `screenshot` argument shape. Still
 * lifes use `compositionSetting`, not `compositionPerson`, so the check failed on a correct
 * behaviour — a false alarm on a gate is as harmful as a missed one. The composition field is now
 * asserted PER STYLE FAMILY.
 */

const PERSON_SHAPES = ["person_shocked", "person_intense", "person_curious"];
const STILL_SHAPE = "screenshot";
const NICHE = "career coaching";
const PROBLEM = "The year runs out before the plan ever starts";

/**
 * Wording that ONLY ever appears on the stage-led path.
 *
 * ⚠️ "lower half" was in this list and had to come out — the LEGACY composition says "The lower half
 * of the picture is the bare foreground surface falling away into shadow", so the phrase is shared
 * and the check failed on correct behaviour. Second mis-specification in this same gate; the lesson
 * is that a negative assertion must be built from strings verified absent from the legacy output,
 * not from strings that merely feel new. "falling softly out of focus" IS stage-only — the legacy
 * clause says "falling away into shadow".
 */
const STAGE_ONLY = /overtaken by the task|mid-demonstration|laying plain cards|middle band|lower three-fifths|falling softly out of focus|register through the moment/;

describe("deploy gate — regenerateSingle and makeVertical argument shapes", () => {
  it("PERSON shapes keep the pre-rebuild person composition", () => {
    // compositionPerson — the clause the stage-led path deliberately replaces.
    for (const style of PERSON_SHAPES) {
      const p = generateAdImagePrompt(style, NICHE, PROBLEM);
      expect(p).toMatch(/seated behind a plain table/);
      expect(p).toMatch(/Composed for a portrait-format advertisement/);
    }
  });

  it("the STILL shape keeps the pre-rebuild SETTING composition, not the person one", () => {
    // compositionSetting. Asserting the person clause here is exactly the mis-specification above.
    const p = generateAdImagePrompt(STILL_SHAPE, NICHE, PROBLEM);
    expect(p).toMatch(/the main object sits high in the frame/);
    expect(p).toMatch(/Composed for a portrait-style advertisement/);
    expect(p).not.toMatch(/seated behind a plain table/);
  });

  it("no shape leaks stage-led wording — both procedures pass no stage", () => {
    for (const style of [...PERSON_SHAPES, STILL_SHAPE]) {
      expect(generateAdImagePrompt(style, NICHE, PROBLEM)).not.toMatch(STAGE_ONLY);
    }
  });

  it("regenerateSingle now routes by STYLE at the feed ratio — the 2026-08-06 fix", () => {
    // ⚠️ THIS ASSERTION WAS INVERTED ON 2026-08-06. It previously pinned the DEFECT — `undefined`
    // style resolving to Flux — with a comment saying it was pinned "so the fix is a deliberate,
    // visible change". This is that change. Do not re-invert it without a live render.
    //
    // regenerateSingle passes liveStyleFor(row.designStyle) and FEED_ASPECT, so a stored still-life
    // row reaches the model the bake-off chose (6/6 vs 2/6 on niche relevance) instead of Flux.
    expect(rendererForStyle(STILL_SHAPE, FEED_ASPECT)).toBe("gpt-image-1");
    for (const style of PERSON_SHAPES) {
      expect(rendererForStyle(style, FEED_ASPECT)).toBe("flux-1.1-pro");
    }
  });

  it("makeVertical still resolves to Flux — 9:16 has no gpt-image-1 equivalent", () => {
    // Unchanged and CORRECT: gpt-image-1 emits no 9:16, so the still life must stay on Flux here.
    // This is enforced in rendererForStyle rather than left to the call site to remember, which is
    // why makeVertical passing no `style` is harmless while regenerateSingle's omission was not.
    expect(rendererForStyle(STILL_SHAPE, "9:16")).toBe("flux-1.1-pro");
    expect(rendererForStyle(undefined, "9:16")).toBe("flux-1.1-pro");
  });

  it("the feed ratio is one shared constant, not a per-loop literal", () => {
    // The whole class of defect this fix closes was FEED_ASPECT living as a local const inside
    // runAdCreativesGeneration while two sibling loops rendered 1:1. If this ever stops being the
    // single import, the drift can silently return.
    expect(FEED_ASPECT).toBe("4:5");
  });

  it("the legacy path stays byte-identical whether the stage is omitted, null or unknown", () => {
    for (const style of [...PERSON_SHAPES, STILL_SHAPE]) {
      const base = generateAdImagePrompt(style, NICHE, PROBLEM);
      expect(generateAdImagePrompt(style, NICHE, PROBLEM, false, undefined, null)).toBe(base);
      expect(generateAdImagePrompt(style, NICHE, PROBLEM, false, undefined, "bogus")).toBe(base);
    }
  });
});
