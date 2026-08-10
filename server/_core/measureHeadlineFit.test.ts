/**
 * measureHeadlineFit.test.ts — the length rule that replaced the retired ≤38-char guard.
 *
 * ⚠️ WHY THIS SUITE EXISTS. Publish-path step 1 retired the image-side headline micro-call,
 * and that micro-call was the ONLY length guard on the headline that gets baked onto the
 * picture. `measureHeadlineFit` is what replaced it, and `resolveGatedPublishCopy` selects
 * on its verdict — so if this function is wrong, the published ad ships a headline with an
 * ellipsis burned into the image. Step 1 shipped with zero tests over it (568 before, 568
 * after); step 4's assembly builds directly on the same selection, so it is closed here.
 *
 * These run against the REAL font file, because the whole point of the rule is that it
 * measures actual glyph advance widths rather than counting characters. A mocked font would
 * test the arithmetic and none of the behaviour.
 *
 * ⚠️ WHAT THIS SUITE IS NOT. It proves the fitter's decisions are self-consistent and that
 * the documented real cases land the documented way. It cannot say whether a headline looks
 * good on a picture — no gate in this repo can, and that judgement is Arfeen's on the pixels.
 */

import { describe, it, expect } from "vitest";
import { measureHeadlineFit } from "./compositeHeadline";

/** The two canvases the renderers actually emit at 4:5 — see CHECKPOINT §4. */
const FLUX_W = 896;
const GPT_W = 1024;

/**
 * The headline Meta stored on the first complete publish this product ever made
 * (gated adCopy 5889, read back BY ID from the live ad). CHECKPOINT records it as the case
 * that proves the rule change was necessary: the retired ≤38-character guard would have
 * REJECTED it, and it fits the narrower canvas.
 */
const PROVEN_HEADLINE = "Postpartum stalls don't respond to less — here's why";

describe("measureHeadlineFit — the real proven cases", () => {
  it("accepts the proven step-1 headline at 896px, which the retired ≤38-char guard would have rejected", () => {
    expect(PROVEN_HEADLINE.length).toBeGreaterThan(38); // the retired guard's ceiling
    const fit = measureHeadlineFit(PROVEN_HEADLINE, FLUX_W, "lower");
    expect(fit.fits).toBe(true);
    expect(fit.truncated).toBe(false);
    expect(fit.lines.join(" ")).not.toContain("…");
    expect(fit.widestLine).toBeLessThanOrEqual(fit.maxWidth);
  });

  it("rejects a headline long enough to truncate, and says so on both flags", () => {
    const tooLong = Array.from({ length: 40 }, (_, i) => `unrepeatable-clause-${i}`).join(" ");
    const fit = measureHeadlineFit(tooLong, FLUX_W, "lower");
    expect(fit.fits).toBe(false);
    expect(fit.truncated).toBe(true);
    expect(fit.lines[fit.lines.length - 1].endsWith("…")).toBe(true);
  });
});

describe("measureHeadlineFit — the properties the resolver relies on", () => {
  /**
   * `resolveGatedPublishCopy` defaults to 896 "the narrower of the two, so a headline chosen
   * without knowing the renderer still fits the tighter canvas". That default is only safe
   * if the wider canvas is never HARSHER. Asserted rather than assumed.
   */
  it("is monotonic in canvas width — anything that fits at 896 also fits at 1024", () => {
    const samples = [
      PROVEN_HEADLINE,
      "Lose the mum tummy. Feel like you.",
      "The six-week check nobody explained to you",
      "Why the plan that worked before stopped working",
    ];
    for (const s of samples) {
      const narrow = measureHeadlineFit(s, FLUX_W, "lower");
      if (!narrow.fits) continue;
      const wide = measureHeadlineFit(s, GPT_W, "lower");
      expect(wide.fits).toBe(true);
    }
  });

  it("gives the left zone a strictly narrower column than the lower zone at the same width", () => {
    const lower = measureHeadlineFit(PROVEN_HEADLINE, FLUX_W, "lower");
    const left = measureHeadlineFit(PROVEN_HEADLINE, FLUX_W, "left");
    expect(left.maxWidth).toBeLessThan(lower.maxWidth);
  });

  it("measures the UPPERCASED string, because that is what the compositor draws", () => {
    const lower = measureHeadlineFit("scope first, then sequence", FLUX_W, "lower");
    const upper = measureHeadlineFit("SCOPE FIRST, THEN SEQUENCE", FLUX_W, "lower");
    expect(lower.lines).toEqual(upper.lines);
    expect(lower.widestLine).toBe(upper.widestLine);
    expect(lower.fontSize).toBe(upper.fontSize);
  });

  it("is deterministic — the same input measures identically twice", () => {
    const a = measureHeadlineFit(PROVEN_HEADLINE, FLUX_W, "lower");
    const b = measureHeadlineFit(PROVEN_HEADLINE, FLUX_W, "lower");
    expect(b).toEqual(a);
  });

  it("treats an empty or whitespace headline as fitting rather than throwing", () => {
    for (const s of ["", "   "]) {
      const fit = measureHeadlineFit(s, FLUX_W, "lower");
      expect(fit.fits).toBe(true);
      expect(fit.truncated).toBe(false);
    }
  });

  it("never reports a fitting headline whose widest line exceeds the column", () => {
    const samples = [PROVEN_HEADLINE, "Short one", "A moderately long headline that still ought to fit"];
    for (const s of samples) {
      const fit = measureHeadlineFit(s, GPT_W, "lower");
      if (fit.fits) expect(fit.widestLine).toBeLessThanOrEqual(fit.maxWidth);
    }
  });
});
