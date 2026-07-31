/**
 * THE NEGATION GATE.
 *
 * Diffusion conditioning has no logical NOT. Every token you write to exclude a
 * thing is a token describing that thing, and it demonstrably pulls it INTO the
 * frame. This codebase has now been bitten five times by the same trap:
 *
 *   1. tabloid `noText` — "NO text, NO words, NO letters…" → newsprint pages and
 *      garbled book covers (deleted in fix C, 2026-07-29)
 *   2. screenshot "No people in the frame" — ignored by Flux on the SAME run
 *      where the positively-framed "an object study only" worked
 *   3. cleanPlate "without prints or logos" (fixed in 6223ee1)
 *   4. the composition clause "with nothing in it competing for attention"
 *   5. editorial "entirely free of any text, letters, numbers, words, logos" —
 *      the deleted noText string in another costume, found 2026-07-30
 *
 * Four of those five were found by a human reading a render. This test is here so
 * the sixth is found by CI instead. It runs the REAL prompt builders — not a
 * copy — so it cannot drift from what actually ships.
 */
import { describe, it, expect } from "vitest";
import { generateAdImagePrompt } from "../routers/adCreatives";
import { buildEditorialPrompt, EDITORIAL_VARIATIONS, variationToScene } from "./editorialPrompt";
import { AD_VARIATIONS } from "./adVariations";

/**
 * Bare negation words. Deliberately word-boundary anchored so ordinary words
 * containing these letters ("nothing" inside a longer token, "know", "another",
 * "notable") do not false-positive.
 */
const NEGATION_WORDS = /\b(no|not|never|without|avoid|nothing|none|neither|nor)\b/i;

/**
 * Absence-framings that carry no negation WORD and so slip a naive grep. This is
 * how the editorial "entirely free of any text…" survived four separate sweeps.
 */
const ABSENCE_PHRASES = [/\bfree of\b/i, /\bdevoid of\b/i, /\bempty of\b/i, /\babsent\b/i, /\blacking\b/i];

function offences(prompt: string): string[] {
  const found: string[] = [];
  for (const sentence of prompt.split(/(?<=[.;:])\s+/)) {
    if (NEGATION_WORDS.test(sentence)) found.push(`negation word → "${sentence.trim()}"`);
    for (const re of ABSENCE_PHRASES) {
      if (re.test(sentence)) found.push(`absence phrasing → "${sentence.trim()}"`);
    }
  }
  return found;
}

const NICHE = "burnt-out sales managers at mid-market SaaS companies";
const PROBLEM =
  "They inherit a team that has missed target three quarters running and cannot tell whether it is the people or the pipeline.";

describe("image prompts carry no negation phrasing", () => {
  for (const variation of AD_VARIATIONS) {
    it(`tabloid style "${variation.style}" is positively framed`, () => {
      const prompt = generateAdImagePrompt(variation.style, NICHE, PROBLEM, false, "A woman in her late thirties");
      expect(offences(prompt), prompt).toEqual([]);
    });

    it(`tabloid style "${variation.style}" is positively framed in uglyMode`, () => {
      const prompt = generateAdImagePrompt(variation.style, NICHE, PROBLEM, true, "A woman in her late thirties");
      expect(offences(prompt), prompt).toEqual([]);
    });
  }

  for (const variation of EDITORIAL_VARIATIONS) {
    it(`editorial variation "${variation.key}" is positively framed`, () => {
      const prompt = buildEditorialPrompt(variationToScene(variation), NICHE);
      expect(offences(prompt), prompt).toEqual([]);
    });
  }

  it("catches a reintroduced negation — the gate itself works", () => {
    expect(offences("A clean desk. There is no text anywhere in frame.")).not.toEqual([]);
    expect(offences("A clean desk. The scene is free of any text.")).not.toEqual([]);
    // And does not fire on innocent words that merely contain the letters.
    expect(offences("A notable, well-known arrangement on a north-facing table.")).toEqual([]);
  });
});

// ─── OBJECT SLOT RETIRED, 2026-08-01 ────────────────────────────────────────
//
// CHANGED, NOT DELETED SILENTLY. This describe block previously asserted the
// object prompt's positive content — "unlabelled physical object", the material
// list, "an object study only", and the L5 surface clause — plus an L5 scoping
// test. All of those pinned a template that no longer exists. They are replaced
// by the inverse assertions: the slot must be unreachable.
describe("the retired object slot cannot be produced", () => {
  it("is absent from the deck", () => {
    expect(AD_VARIATIONS.some((v) => (v.style as string) === "object")).toBe(false);
  });

  it("no longer resolves to an object-study prompt", () => {
    const prompt = generateAdImagePrompt("object", NICHE, PROBLEM);
    expect(prompt).not.toContain("an object study only");
    expect(prompt).not.toContain("unlabelled physical object");
    expect(prompt).not.toContain("worked smooth and continuous");
    expect(prompt).not.toContain("Its silhouette and construction are what identify it.");
  });

  it("falls back to the person_shocked template for any residual caller", () => {
    // tsc rejects the literal at every in-repo call site; this covers a value
    // arriving from the DB at runtime, where the type system cannot help.
    expect(generateAdImagePrompt("object", NICHE, PROBLEM, false, "A woman in her late thirties"))
      .toBe(generateAdImagePrompt("person_shocked", NICHE, PROBLEM, false, "A woman in her late thirties"));
  });

  it("leaves no object-only string anywhere in a surviving prompt", () => {
    for (const v of AD_VARIATIONS) {
      const prompt = generateAdImagePrompt(v.style, NICHE, PROBLEM, false, "A woman in her late thirties");
      expect(prompt, v.style).not.toContain("seamless studio backdrop");
      expect(prompt, v.style).not.toContain("worked smooth and continuous");
      expect(prompt, v.style).not.toContain("The chosen object alone identifies the field");
    }
  });
});
