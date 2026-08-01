/**
 * THE THREE NUMBERS THAT MUST AGREE.
 *
 * WHY THIS EXISTS. On 2026-08-01 the tabloid deck went 5 → 4. Three separate
 * places encoded that count:
 *
 *   1. the LLM prompt        — "Write N Meta-compliant ad headlines"
 *   2. the validator         — AD_HEADLINE_REQUIRED_COUNT, hardcoded 5
 *   3. the consuming deck    — AD_VARIATIONS.length / the template-card loop
 *
 * Only (1) and (3) were updated. The validator kept demanding five, so the model
 * returned exactly what it was asked for and was rejected every time with
 * `headlines_wrong_count`. Every ad-creative generation on production failed —
 * both the coach's Generate button and the Auto Mode cascade. It was not caught
 * by any existing test because each of the three was asserted in isolation and
 * nothing asserted that they AGREE.
 *
 * A second, independent break sat behind it: the headline micro-call is shared
 * by two decks of different sizes, and the template-card deck (five cards,
 * indexing headlines[i] for i < 5) would have read headlines[4] === undefined.
 * That deck now states its own formula set rather than inheriting the tabloid
 * deck's.
 *
 * These tests are deliberately about RELATIONSHIPS, not values. They must keep
 * passing whatever the decks are resized to.
 */
import { describe, it, expect } from "vitest";
import { AD_VARIATIONS, TABLOID_FORMULAS, TEMPLATE_CARD_FORMULAS } from "./adVariations";
import { buildAdHeadlinesUserPrompt } from "../adCreativesGenerator";
import { validateAdHeadlines } from "./validator";

const SAMPLE = {
  productName: "Calm Authority",
  mainBenefit: "hold a room without raising your voice",
  targetAudience: "senior leaders",
  uniqueMechanism: "The Signal Method",
  pressingProblem: "they freeze when challenged in the boardroom",
};

/** A syntactically valid response of exactly n short headlines. */
const headlinesOfLength = (n: number) => ({
  headlines: Array.from({ length: n }, (_, i) => `Short line ${i + 1}.`),
});

describe("prompt, validator and deck agree on the headline count", () => {
  for (const [deck, formulas] of [
    ["tabloid", TABLOID_FORMULAS],
    ["template-card", TEMPLATE_CARD_FORMULAS],
  ] as const) {
    it(`${deck}: the prompt asks for exactly formulas.length headlines`, () => {
      const prompt = buildAdHeadlinesUserPrompt(SAMPLE, formulas);
      const n = formulas.length;
      expect(prompt).toContain(`Write ${n} Meta-compliant ad headlines`);
      expect(prompt).toContain(`THE ${n} HEADLINES`);
      expect(prompt).toContain(`array of exactly ${n} strings`);
      expect(prompt).toContain(formulas.join(", "));
    });

    it(`${deck}: the validator ACCEPTS exactly what that prompt asked for`, () => {
      // This is the assertion whose absence caused the outage.
      const n = formulas.length;
      const result = validateAdHeadlines(headlinesOfLength(n), n, formulas);
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });

    it(`${deck}: the validator REJECTS one too few and one too many`, () => {
      const n = formulas.length;
      expect(validateAdHeadlines(headlinesOfLength(n - 1), n, formulas).ok).toBe(false);
      expect(validateAdHeadlines(headlinesOfLength(n + 1), n, formulas).ok).toBe(false);
    });

    it(`${deck}: the prompt names one register block per formula, in order`, () => {
      const prompt = buildAdHeadlinesUserPrompt(SAMPLE, formulas);
      formulas.forEach((f, i) => {
        expect(prompt, `${f} at position ${i + 1}`).toContain(`${i + 1}. ${f.toUpperCase()}`);
      });
    });
  }

  it("the tabloid formula list is derived from the deck, not restated", () => {
    expect(TABLOID_FORMULAS).toEqual(AD_VARIATIONS.map((v) => v.formula));
  });

  it("the two decks are independently sized — resizing one must not move the other", () => {
    // The template-card deck stays at five by design; the tabloid deck is four
    // since the object slot retired. If these are ever equal it should be
    // because someone MEANT it, not because one inherited the other.
    expect(TEMPLATE_CARD_FORMULAS.length).toBe(5);
    expect(TABLOID_FORMULAS.length).toBe(AD_VARIATIONS.length);
  });

  it("the template-card deck still carries `contrast`, which the tabloid deck retired", () => {
    // orchestration.ts persists TEMPLATE_CARD_FORMULAS[i] to
    // adCreatives.headlineFormula, so dropping `contrast` from the formula union
    // would break that write even though the tabloid deck no longer uses it.
    expect(TEMPLATE_CARD_FORMULAS).toContain("contrast");
    expect(TABLOID_FORMULAS).not.toContain("contrast");
  });

  it("a validator given a different count than the prompt asked for is a caught mismatch", () => {
    // Reproduces the exact production failure: prompt asked 4, validator told 5.
    const asked = TABLOID_FORMULAS.length;
    const result = validateAdHeadlines(headlinesOfLength(asked), 5, TABLOID_FORMULAS);
    if (asked !== 5) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.subCase).toBe("headlines_wrong_count");
    }
  });
});
