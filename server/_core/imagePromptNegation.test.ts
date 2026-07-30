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

describe("the object style steers away from text-bearing props", () => {
  it("names material classes that cannot carry type", () => {
    const prompt = generateAdImagePrompt("object", NICHE, PROBLEM);
    expect(prompt).toContain("unlabelled physical object");
    for (const material of ["metal", "wood", "fabric", "glass", "ceramic", "moulded plastic"]) {
      expect(prompt).toContain(material);
    }
  });

  it("keeps the phrasing that demonstrably worked", () => {
    // "an object study only" rendered a genuine still life on the same 2026-07-29
    // run where the bare negation "No people in the frame" was ignored. It is
    // load-bearing wording, not decoration.
    expect(generateAdImagePrompt("object", NICHE, PROBLEM)).toContain("an object study only");
  });
});
