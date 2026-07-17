import { describe, it, expect } from "vitest";
import { mapLibraryRow, mergeRealTestimonials, type RealTestimonial } from "./realTestimonials";
import type { LandingPageContent } from "../../drizzle/schema";

const contentWith = (t: RealTestimonial[]) => ({ mainHeadline: "H", testimonials: t } as unknown as LandingPageContent);
const T = (name: string, quote = `quote from ${name}`, location = ""): RealTestimonial => ({ headline: "", quote, name, location });

describe("mapLibraryRow — library row → content.testimonials shape", () => {
  it("maps name/quote and puts the library title into location (the rendered subtitle)", () => {
    expect(mapLibraryRow({ name: "Ravi Menon", title: "CEO, Acme", quote: "Doubled revenue." }))
      .toEqual({ headline: "", quote: "Doubled revenue.", name: "Ravi Menon", location: "CEO, Acme" });
  });
  it("tolerates a null title → empty location", () => {
    expect(mapLibraryRow({ name: "Sam", title: null, quote: "Great." }))
      .toEqual({ headline: "", quote: "Great.", name: "Sam", location: "" });
  });
});

describe("mergeRealTestimonials — the additive 3-cap-fix contract", () => {
  it("replaces content.testimonials with the FULL real set when the library has entries (>3 supported)", () => {
    const real = Array.from({ length: 8 }, (_, i) => T(`Person ${i}`));
    const out = mergeRealTestimonials(contentWith([T("stale generated one")]), real);
    expect(out.testimonials).toHaveLength(8);              // 8 real, not capped at 3
    expect(out.testimonials).toEqual(real);
  });
  it("leaves content UNCHANGED when the library is empty (never removes the generated ≤3 real proof)", () => {
    const generated = [T("A"), T("B"), T("C")];
    const content = contentWith(generated);
    const out = mergeRealTestimonials(content, []);
    expect(out).toBe(content);                             // same reference — no-op
    expect(out.testimonials).toEqual(generated);
  });
  it("filters blank/whitespace quotes from the real set — never surfaces an empty testimonial", () => {
    const out = mergeRealTestimonials(contentWith([]), [T("Real"), { headline: "", quote: "   ", name: "Blank", location: "" }]);
    expect(out.testimonials).toHaveLength(1);
    expect(out.testimonials[0].name).toBe("Real");
  });
  it("all output testimonials come from the input real[] — the merge NEVER fabricates", () => {
    const real = [T("Only Source")];
    const out = mergeRealTestimonials(contentWith([T("would-be-invented")]), real);
    expect(out.testimonials.every((t) => real.includes(t))).toBe(true);
  });
});
