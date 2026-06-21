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
