import { describe, it, expect } from "vitest";
import { complianceFilter } from "./complianceFilter";

describe("complianceFilter — international currency", () => {
  // ── INR patterns ──
  it("pivots income guarantee in INR lakhs with timeframe", () => {
    const r = complianceFilter("earn ₹4.5 lakhs/month within 42 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in INR crore with timeframe", () => {
    const r = complianceFilter("make ₹1 crore in 90 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in written-out lakhs", () => {
    const r = complianceFilter("earn 4.5 lakhs per month in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── GBP / EUR patterns ──
  it("pivots income guarantee in GBP", () => {
    const r = complianceFilter("make £10,000 in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots income guarantee in EUR", () => {
    const r = complianceFilter("earn €5,000 in 14 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── Missing scarcity phrasings ──
  it("pivots 'pricing dies tonight'", () => {
    const r = complianceFilter("Pricing dies tonight — gone forever");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'offer expires tonight'", () => {
    const r = complianceFilter("This offer expires tonight");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'gone forever'", () => {
    const r = complianceFilter("This price is gone forever after today");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("pivots 'expires today' / 'offer ends today'", () => {
    const r = complianceFilter("Offer ends today at midnight");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── Overlapping scarcity collapse ──
  it("collapses overlapping scarcity pivots into single clean output", () => {
    const r = complianceFilter("Pricing dies tonight — gone forever");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
    // Should NOT contain the pivot phrase twice
    const pivotPhrase = "Limited-time access to this offer";
    const count = r.cleanedText.split(pivotPhrase).length - 1;
    expect(count).toBe(1);
  });

  // ── Existing USD patterns still work ──
  it("still pivots USD income guarantee", () => {
    const r = complianceFilter("make $10,000 in 30 days");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  // ── False positive guard: legitimate pricing is NOT pivoted ──
  it("does NOT pivot plain pricing mention without timeframe", () => {
    const r = complianceFilter("Price: ₹2.5 lakhs for the programme");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });

  it("does NOT pivot plain currency mention in testimonial context", () => {
    const r = complianceFilter("My investment was £5,000 for the course");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });

  it("does NOT pivot 'limited-time access' (already a pivot output)", () => {
    const r = complianceFilter("Limited-time access to this offer");
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
  });
});

/**
 * REGRESSION — pivot rule 2's negation blindness.
 *
 * Bare `\bguaranteed\b` fired just as hard on copy DENYING a guarantee as on copy making one.
 * Measured on landing page 238: two of three blocking hits were denials — "no waitlist with a
 * guaranteed place" and "with no guaranteed timeline" — and the pivot rewrote the first into
 * "no waitlist with a Proven approach used by thousands of professionals place".
 *
 * The guard is deliberately tight in two independent ways (at most four intervening words, and
 * no intervening copula). Both halves are pinned below, in BOTH directions: the denials must
 * pass, and every real guarantee claim must still be caught.
 */
describe("complianceFilter — guarantee negation guard", () => {
  // ── Denials must pass. These are the real page-238 sentences. ──
  it.each([
    "There is no waitlist with a guaranteed place.",
    "When those are filled, the next availability opens before the following cohort, with no guaranteed timeline.",
    "There is no guaranteed timeline.",
    "This is not a guaranteed outcome.",
    "Placement is never guaranteed.",
    "We make no guaranteed claims about revenue.",
  ])("does NOT pivot a clear denial: %s", (text) => {
    const r = complianceFilter(text);
    expect(r.classification).toBe("VALID");
    expect(r.wasModified).toBe(false);
    expect(r.triggers).toHaveLength(0);
  });

  // ── Real guarantee claims must still be caught. The guard must not open a path. ──
  it.each([
    "The session is free and the output is guaranteed.",
    "Every participant is guaranteed a written output.",
    "Guaranteed results in your first quarter.",
    "100% success rate, guaranteed.",
    // The negation is present but governs a DIFFERENT clause — a copula intervenes, which is
    // the grammatical signal that the guarantee is being asserted afresh.
    "There is no reason to doubt it: the outcome is guaranteed.",
    "Not the point — results are guaranteed.",
  ])("still pivots a real guarantee claim: %s", (text) => {
    const r = complianceFilter(text);
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.wasModified).toBe(true);
  });

  it("catches the un-negated claim in a field that also carries a denial", () => {
    const r = complianceFilter(
      "There is no waitlist with a guaranteed place. The output is guaranteed regardless.",
    );
    expect(r.classification).toBe("PIVOT_REQUIRED");
    // Exactly one trigger: the denial contributed nothing.
    expect(r.triggers).toHaveLength(1);
    expect(r.triggers[0].span).toBe("guaranteed");
    expect(r.cleanedText).toContain("no waitlist with a guaranteed place");
  });
});

/**
 * REGRESSION — attributable triggers.
 *
 * `flaggedTerms` is collected over the CLEANED text on the pivot path, so it is normally EMPTY
 * once a pivot has removed the offending phrase. The caller then had a real verdict and nothing
 * to attribute it to, and reported the field's first 80 characters as the match.
 */
describe("complianceFilter — attributable triggers", () => {
  it("records the matched span even when flaggedTerms comes back empty", () => {
    const r = complianceFilter("Every participant is guaranteed a written output from the session.");
    expect(r.classification).toBe("PIVOT_REQUIRED");
    expect(r.flaggedTerms).toHaveLength(0); // the historical hole
    expect(r.triggers).toHaveLength(1); // now closed
    expect(r.triggers[0].span).toBe("guaranteed");
    expect(r.triggers[0].ruleId).toBe("2");
  });

  it("carries a compliance class per rule, not one class for the whole file", () => {
    expect(complianceFilter("Guaranteed results.").triggers[0].classId).toBe("promised_result");
    expect(complianceFilter("This offer expires today.").triggers[0].classId).toBe("deceptive_urgency");
    expect(complianceFilter("We cure your migraines.").triggers[0].classId).toBe("clinical_outcome_claim");
    expect(complianceFilter("Are you a struggling consultant?").triggers[0].classId).toBe(
      "second_person_protected_attribute",
    );
  });

  it("records a trigger on the REJECTED path too, with the hard-ban class", () => {
    const r = complianceFilter("This page contains adult content.");
    expect(r.classification).toBe("REJECTED");
    expect(r.triggers[0].classId).toBe("prohibited_content");
    expect(r.triggers[0].span).toBe("adult content");
  });

  it("returns no triggers when the text is clean", () => {
    expect(complianceFilter("A twelve-week programme for operations consultants.").triggers).toHaveLength(0);
  });
});
