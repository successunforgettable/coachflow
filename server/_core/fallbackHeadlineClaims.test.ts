/**
 * FALLBACK HEADLINES MUST MAKE NO CLAIM.
 *
 * HEADLINE_FORMULAS is not test scaffolding — two live paths always render it:
 * generateAsync (the coach's "Generate Ad Images" button) and
 * generateAdCreativesBatch (the V1 campaign dashboard). Whatever it emits is
 * published under a real coach's name.
 *
 * Until 2026-07-30 it hardcoded a 90% time reduction, a 40-hours-to-4-hours
 * before/after, a retention claim, an adoption trend and a population
 * statistic — none of it measured, none supplied by the coach.
 *
 * The single permitted number is the coach's own services.totalCustomers, and
 * only when they supplied one.
 */
import { describe, it, expect } from "vitest";
import { HEADLINE_FORMULAS } from "../routers/adCreatives";

const MECHANISM = "The Sequence Reset";
const NICHE = "career-pivot";

/** Digits, percentages, and the multiplier/quantity shapes a claim hides in. */
const NUMERIC_CLAIM = /\d|%|\bper cent\b|\bpercent\b/i;

/** Outcome, popularity and retention assertions that need evidence we do not have. */
const UNEVIDENCED_CLAIM = [
  /\bcut\b/i, /\bsave[sd]?\b/i, /\bdouble[sd]?\b/i, /\btriple[sd]?\b/i,
  /\bguarantee/i, /\bproven\b/i, /\bswitch(ing|ed)?\b/i, /\bdon'?t go back\b/i,
  /\bevery\b/i, /\bmost\b/i, /\ball\b/i, /\bnobody\b/i, /\bnever fix\b/i,
  /\bfastest\b/i, /\bbest\b/i, /\b#1\b/i,
];

const FORMULAS = Object.keys(HEADLINE_FORMULAS) as Array<keyof typeof HEADLINE_FORMULAS>;

describe("fallback headlines carry no unevidenced claim", () => {
  for (const key of FORMULAS) {
    it(`"${key}" makes no numeric claim when the coach supplied no customer count`, () => {
      // customers omitted and zero are the two real no-data shapes.
      for (const customers of [undefined, 0]) {
        const out = HEADLINE_FORMULAS[key](MECHANISM, NICHE, customers);
        expect(out, `${key} (customers=${customers}) → "${out}"`).not.toMatch(NUMERIC_CLAIM);
      }
    });

    it(`"${key}" asserts no outcome, popularity or retention`, () => {
      for (const customers of [undefined, 0]) {
        const out = HEADLINE_FORMULAS[key](MECHANISM, NICHE, customers);
        for (const re of UNEVIDENCED_CLAIM) {
          expect(out, `${key} matched ${re} → "${out}"`).not.toMatch(re);
        }
      }
    });
  }

  it("the one permitted number is the coach's own supplied customer count", () => {
    // services.totalCustomers is coach-supplied, so stating it is reporting,
    // not fabricating. This is the ONLY route by which a digit may appear.
    const withProof = HEADLINE_FORMULAS.social_proof(MECHANISM, NICHE, 1200);
    expect(withProof).toContain("1,200");

    // …and with no count supplied, it states no proof at all rather than
    // substituting an invented one.
    const withoutProof = HEADLINE_FORMULAS.social_proof(MECHANISM, NICHE, 0);
    expect(withoutProof).not.toMatch(/\d/);
  });

  it("the supplied-count branch still may not bolt an unevidenced claim onto the real number", () => {
    // The digit is permitted there because the coach supplied it. That
    // permission covers the NUMBER only — it is not a licence to add
    // "guaranteed" or "proven" alongside it. Without this the count > 0 branch
    // would be the one string in the block no claim check ever reached.
    const out = HEADLINE_FORMULAS.social_proof(MECHANISM, NICHE, 1200);
    for (const re of UNEVIDENCED_CLAIM) {
      expect(out, `supplied-count branch matched ${re} → "${out}"`).not.toMatch(re);
    }
  });

  it("the guard itself works — it would catch the copy that was removed", () => {
    const removed = [
      "THE SEQUENCE RESET: CUT YOUR CAREER-PIVOT TIME BY 90%",
      "BEFORE THE SEQUENCE RESET: 40 HOURS. AFTER: 4 HOURS",
      "CAREER-PIVOT COACHES WHO TRY THIS DON'T GO BACK",
      "WHY CAREER-PIVOT COACHES ARE SWITCHING TO THE SEQUENCE RESET",
      "EVERY CAREER-PIVOT COACH FEELS THIS. MOST NEVER FIX IT.",
    ];
    for (const line of removed) {
      const caught = NUMERIC_CLAIM.test(line) || UNEVIDENCED_CLAIM.some((re) => re.test(line));
      expect(caught, `guard failed to catch: "${line}"`).toBe(true);
    }
  });
});
