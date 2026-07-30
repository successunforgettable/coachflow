/**
 * THE FIT GUARD (P6c, layer B) — a finished fallback headline can never exceed
 * ZAP's house limit, whatever is fed in.
 *
 * WHY THIS EXISTS. `adCreatives.headline` is varchar(255). On 2026-07-30 the
 * coach's "Generate Ad Images" button was found to crash outright, because
 * `services.uniqueMechanismSuggestion` — documented as "a proprietary-sounding
 * NAME" but persisted with trunc(…, 65535) — holds a description on 94 of the
 * 101 production services that have one (mean 394 chars, max 622). Every
 * HEADLINE_FORMULAS template interpolated it whole, so the INSERT died on
 * variation 1 and the coach got zero images. 93% of production services would
 * have hit it.
 *
 * ⚠️ Name extraction alone does NOT satisfy the standard, which is why the
 * length assertions below are the real gate: after extraction, service 277's
 * five headlines still measured 52/25/57/54/76 characters.
 *
 * The limit is ZAP's own craft standard, NOT a Meta rule — Meta publishes 27 as
 * a display recommendation and neither 38 nor 40 appears in its documentation
 * (META_AD_COMPLIANCE_REFERENCE §1.4a).
 */
import { describe, it, expect } from "vitest";
import { HEADLINE_FORMULAS, AD_HEADLINE_HOUSE_MAX, resolveMechanismName } from "../routers/adCreatives";

const FORMULAS = Object.keys(HEADLINE_FORMULAS) as Array<keyof typeof HEADLINE_FORMULAS>;

/** The real service-277 value that crashed the insert — 398 chars. */
const REAL_398 =
  "The Skills-to-Title Translation Method — a structured process that takes every significant " +
  "responsibility from a person's last 10 years of work, re-codes it into the vocabulary of target " +
  "industries (rather than the vocabulary of their current sector), and produces a role-specific CV " +
  "and LinkedIn profile that reads as a natural fit rather than a stretch.";

const ABUSIVE_INPUTS: Array<[string, string]> = [
  ["the real 398-char service-277 value", REAL_398],
  ["a 622-char value (prod maximum)", "The Identity Audit Method — " + "x".repeat(600)],
  ["no separator at all, one long run", "y".repeat(500)],
  ["empty", ""],
  ["whitespace only", "    "],
  ["a short proper name", "The Executive Energy Protocol™"],
];

const NICHES = ["coaching", "career-pivot", "a very long niche name that goes on and on and on", ""];

describe("fallback headlines are always within the house limit", () => {
  for (const key of FORMULAS) {
    for (const [label, mechanism] of ABUSIVE_INPUTS) {
      for (const customers of [undefined, 0, 1200]) {
        it(`${key} · ${label} · customers=${customers} stays within ${AD_HEADLINE_HOUSE_MAX}`, () => {
          for (const niche of NICHES) {
            const out = HEADLINE_FORMULAS[key](mechanism, niche, customers);
            expect(out.length, `"${out}" (${out.length} chars)`).toBeLessThanOrEqual(AD_HEADLINE_HOUSE_MAX);
          }
        });
      }
    }
  }

  it("stays far inside varchar(255) — the column that crashed", () => {
    for (const key of FORMULAS) {
      for (const [, mechanism] of ABUSIVE_INPUTS) {
        const out = HEADLINE_FORMULAS[key](mechanism, "coaching", 0);
        expect(out.length).toBeLessThan(255);
      }
    }
  });

  it("trims to fit and never rejects — every input still yields a headline", () => {
    // A length gate that throws killed a live cascade once. Fit and continue.
    for (const key of FORMULAS) {
      const out = HEADLINE_FORMULAS[key](REAL_398, "coaching", 0);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveMechanismName recovers the name from a description", () => {
  it("splits the real production shape at the em-dash", () => {
    expect(resolveMechanismName(REAL_398)).toBe("The Skills-to-Title Translation Method");
  });

  it("leaves an already-short proper name untouched", () => {
    expect(resolveMechanismName("The Executive Energy Protocol™")).toBe("The Executive Energy Protocol™");
  });

  it("does not split an internally hyphenated name", () => {
    // "Skills-to-Title" must survive — the separator is " — ", not any hyphen.
    expect(resolveMechanismName("The Skills-to-Title Method")).toBe("The Skills-to-Title Method");
  });

  it("handles empty and nullish without throwing", () => {
    expect(resolveMechanismName("")).toBe("");
    expect(resolveMechanismName(null)).toBe("");
    expect(resolveMechanismName(undefined)).toBe("");
  });
});

describe("the COACHING COACHES defect", () => {
  it("does not repeat the noun when the niche already names the audience", () => {
    // service 277's category is literally "coaching" → "MADE FOR COACHING COACHES"
    const out = HEADLINE_FORMULAS.social_proof("The Role Translation Method", "coaching", 0);
    expect(out).not.toMatch(/COACHING COACHES/i);
    expect(out).toBe("MADE FOR COACHES");
  });

  it("still appends the noun for a normal niche", () => {
    expect(HEADLINE_FORMULAS.social_proof("The Role Translation Method", "fitness", 0)).toBe(
      "MADE FOR FITNESS COACHES",
    );
  });

  it("pluralises a singular 'coach' niche rather than repeating it", () => {
    expect(HEADLINE_FORMULAS.social_proof("m", "career coach", 0)).toBe("MADE FOR CAREER COACHES");
  });
});
