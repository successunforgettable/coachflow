import { describe, it, expect } from "vitest";
import { mapLibraryRow, partitionProof, mergeProof, type RealTestimonial, type LibraryRow } from "./realTestimonials";
import type { LandingPageContent } from "../../drizzle/schema";

const contentWith = (t: RealTestimonial[]) => ({ mainHeadline: "H", testimonials: t } as unknown as LandingPageContent);
/** A DISPLAYABLE row — coach-supplied and scoped. Defaults mirror the only combination that renders. */
const row = (
  serviceId: number | null,
  quote = `q-${serviceId}`,
  name = "N",
  scope: "service_specific" | "coach_portable" = serviceId == null ? "coach_portable" : "service_specific",
): LibraryRow => ({ serviceId, name, title: null, quote, scope, source: "coach_supplied" });
/** An UNTAGGED row — every row predating migration 0110 looks like this. Must render nowhere. */
const untagged = (serviceId: number | null, quote = `u-${serviceId}`): LibraryRow =>
  ({ serviceId, name: "N", title: null, quote });

describe("mapLibraryRow — library row → content testimonial shape", () => {
  it("maps quote/name and puts title into location (the rendered subtitle)", () => {
    expect(mapLibraryRow({ name: "Ravi", title: "CEO, Acme", quote: "Doubled revenue." }))
      .toEqual({ headline: "", quote: "Doubled revenue.", name: "Ravi", location: "CEO, Acme" });
  });
  it("null title → empty location", () => {
    expect(mapLibraryRow({ name: "Sam", title: null, quote: "Great." }).location).toBe("");
  });
});

describe("partitionProof — display is OPT-IN; absence of a tag is not permission", () => {
  // ── THE DEFECT THIS REPLACES (2026-09-03) ────────────────────────────────────────────────
  // The old contract was "serviceId===S → offer, EVERYTHING ELSE → coach proof". That promoted
  // unscoped rows to portable endorsement and put ten seeded demo quotes — including invented
  // percentage claims — onto eighteen live public pages. These tests assert the new contract in
  // BOTH directions so neither gate can silently stop working.

  it("drops UNTAGGED rows entirely — the pre-0110 state renders nowhere", () => {
    const rows = [untagged(4), untagged(null), untagged(1)];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer).toHaveLength(0);
    expect(coach).toHaveLength(0);
  });

  it("drops seeded_demo and imported even when scope says otherwise", () => {
    const rows: LibraryRow[] = [
      { serviceId: 4, name: "Demo", title: null, quote: "lead quality jumped 40%", scope: "service_specific", source: "seeded_demo" },
      { serviceId: null, name: "Bulk", title: null, quote: "pasted, unvetted", scope: "coach_portable", source: "imported" },
    ];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer).toHaveLength(0);
    expect(coach).toHaveLength(0);
  });

  it("drops coach_supplied rows that carry NO scope — provenance alone is not placement", () => {
    const rows: LibraryRow[] = [
      { serviceId: 4, name: "A", title: null, quote: "no scope", source: "coach_supplied" },
      { serviceId: null, name: "B", title: null, quote: "no scope either", source: "coach_supplied" },
    ];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer).toHaveLength(0);
    expect(coach).toHaveLength(0);
  });

  it("RENDERS a fully tagged service_specific row as OFFER proof, for its own service only", () => {
    const { offer, coach } = partitionProof([row(4, "for #4")], 4);
    expect(offer.map((t) => t.quote)).toEqual(["for #4"]);
    expect(coach).toHaveLength(0);
    // the same row on a DIFFERENT service renders nowhere — it was scoped to one programme
    const other = partitionProof([row(4, "for #4")], 9);
    expect(other.offer).toHaveLength(0);
    expect(other.coach).toHaveLength(0);
  });

  it("RENDERS a fully tagged coach_portable row as COACH proof, on any service", () => {
    const portable = row(null, "about the coach");
    expect(partitionProof([portable], 4).coach.map((t) => t.quote)).toEqual(["about the coach"]);
    expect(partitionProof([portable], 99).coach.map((t) => t.quote)).toEqual(["about the coach"]);
  });

  it("a coach_portable row scoped to another service still renders as coach proof — real cross-service proof is not lost", () => {
    const rows = [row(1, "from programme #1", "N", "coach_portable")];
    const { offer, coach } = partitionProof(rows, 4);
    expect(offer).toHaveLength(0);
    expect(coach.map((t) => t.quote)).toEqual(["from programme #1"]);
  });

  it("DE-DUP by construction — a rendered row lands in exactly one bucket, never both", () => {
    const rows = [row(4), row(null), row(4, "second-for-4")];
    const { offer, coach } = partitionProof(rows, 4);
    const all = [...offer, ...coach].map((t) => t.quote);
    expect(new Set(all).size).toBe(all.length);
  });

  it("drops blank/whitespace quotes even when fully tagged", () => {
    const rows: LibraryRow[] = [
      row(4, "real"),
      { serviceId: 4, name: "X", title: null, quote: "  ", scope: "service_specific", source: "coach_supplied" },
    ];
    expect(partitionProof(rows, 4).offer.map((t) => t.quote)).toEqual(["real"]);
  });

  it("NEVER fabricates — every output derives from an input row", () => {
    const rows = [row(4, "only source A"), row(null, "only source B")];
    const { offer, coach } = partitionProof(rows, 4);
    expect([...offer, ...coach].map((t) => t.quote).sort()).toEqual(["only source A", "only source B"]);
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
