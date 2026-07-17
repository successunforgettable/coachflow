import { describe, it, expect } from "vitest";
import { mapLibraryRow, partitionProof, mergeProof, type RealTestimonial, type LibraryRow } from "./realTestimonials";
import type { LandingPageContent } from "../../drizzle/schema";

const contentWith = (t: RealTestimonial[]) => ({ mainHeadline: "H", testimonials: t } as unknown as LandingPageContent);
const row = (serviceId: number | null, quote = `q-${serviceId}`, name = "N"): LibraryRow => ({ serviceId, name, title: null, quote });

describe("mapLibraryRow — library row → content testimonial shape", () => {
  it("maps quote/name and puts title into location (the rendered subtitle)", () => {
    expect(mapLibraryRow({ name: "Ravi", title: "CEO, Acme", quote: "Doubled revenue." }))
      .toEqual({ headline: "", quote: "Doubled revenue.", name: "Ravi", location: "CEO, Acme" });
  });
  it("null title → empty location", () => {
    expect(mapLibraryRow({ name: "Sam", title: null, quote: "Great." }).location).toBe("");
  });
});

describe("partitionProof — offer (serviceId===S) vs portable coach proof (everything else)", () => {
  it("splits by scope: this-service → offer; NULL or another service → coach", () => {
    const rows = [row(4, "for #4"), row(null, "global"), row(1, "for #1"), row(2, "for #2")];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer.map((t) => t.quote)).toEqual(["for #4"]);                 // only serviceId=4
    expect(coach.map((t) => t.quote)).toEqual(["global", "for #1", "for #2"]); // NULL + other programs
  });

  it("THE LAUNCH CASE — new program (serviceId=4) with 40 testimonials across #1–3: all become COACH proof, none lost", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row((i % 3) + 1, `across-#${(i % 3) + 1}-n${i}`)); // serviceIds 1,2,3
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer).toHaveLength(0);        // zero offer proof for the new program (honest — it hasn't run)
    expect(coach).toHaveLength(40);       // ALL 40 are portable coach proof — the bug (they used to vanish) is gone
  });

  it("DE-DUP by construction — each row lands in exactly one bucket, never both", () => {
    const rows = [row(4), row(null), row(1), row(4, "second-for-4")];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer.length + coach.length).toBe(rows.length);
    const allQuotes = [...offer, ...coach].map((t) => t.quote);
    expect(new Set(allQuotes).size).toBe(allQuotes.length); // no quote appears twice across the buckets
  });

  it("drops blank/whitespace quotes; serviceId null when no service → everything is coach proof", () => {
    const rows = [row(4, "real"), { serviceId: 4, name: "X", title: null, quote: "  " }];
    expect(partitionProof(rows, 4).offer.map((t) => t.quote)).toEqual(["real"]);
    // page with no service id at all → nothing is "this service", so all real rows are coach proof
    const { offer, coach } = partitionProof([row(1), row(null)], null);
    expect(offer).toHaveLength(0);
    expect(coach).toHaveLength(2);
  });

  it("NEVER fabricates — every output testimonial derives from an input row", () => {
    const rows = [row(4, "only source A"), row(null, "only source B")];
    const { offer, coach } = partitionProof(rows, 4);
    const quotes = [...offer, ...coach].map((t) => t.quote);
    expect(quotes.sort()).toEqual(["only source A", "only source B"]);
  });
});

describe("mergeProof — writes the two buckets into content", () => {
  it("sets testimonials=offer and coachTestimonials=coach", () => {
    const out = mergeProof(contentWith([]), { offer: [mapLibraryRow(row(4))], coach: [mapLibraryRow(row(null)), mapLibraryRow(row(1))] });
    expect(out.testimonials).toHaveLength(1);
    expect(out.coachTestimonials).toHaveLength(2);
  });
  it("empty library → content UNCHANGED (never removes the generated proof, never fabricates)", () => {
    const generated = [mapLibraryRow(row(4, "generated"))];
    const content = contentWith(generated);
    const out = mergeProof(content, { offer: [], coach: [] });
    expect(out).toBe(content); // same reference — no-op
  });
});
