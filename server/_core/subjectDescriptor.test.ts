import { describe, it, expect } from "vitest";
import {
  resolveSubjectDescriptor, subjectClause, subjectClausesForBatch,
  resolveAgeBand, isPersonStyle,
} from "./subjectDescriptor";

// The REAL order, read from the deck itself rather than restated. It was a
// hardcoded 5-slot literal including "object" until 2026-08-01; that literal
// kept PASSING after the object slot was retired while no longer describing the
// deck, which is the quiet way a test stops testing anything. Derived now.
//
// Historically person-bearing styles sat at indices 0, 2, 4 — all even — which
// is exactly what broke the mixed path (alternating on the variation index
// instead of the person ordinal). Post-retirement they sit at 0, 2, 3, so the
// parity coincidence is gone; the ordinal bookkeeping in subjectClausesForBatch
// is what makes both layouts correct, and that is what these tests pin.
import { AD_VARIATIONS } from "./adVariations";
const REAL_STYLE_ORDER: string[] = AD_VARIATIONS.map((v) => v.style);

// Verbatim prod values, read from idealCustomerProfiles.demographics on 2026-07-29.
const PROD_254 = "All genders; slightly skewed toward women 38–46 in managerial and professional roles who report higher rates of values-career misalignment";
const PROD_253 = "Mixed, slight skew male 55% / female 45% — both represented equally in the core pain";
const PROD_250 = "All genders, skewing slightly female (55–60%)";
const PROD_247 = "Female";

describe("resolveAgeBand", () => {
  it("prefers a named core cluster over the outer band", () => {
    expect(resolveAgeBand("35–50, with the core cluster at 38–46")).toBe("38-46");
  });
  it("reads a plain band and normalises the en dash", () => {
    expect(resolveAgeBand("35–50")).toBe("35-50");
    expect(resolveAgeBand("26-38")).toBe("26-38");
  });
  it("returns null for unusable input", () => {
    expect(resolveAgeBand(null)).toBeNull();
    expect(resolveAgeBand("")).toBeNull();
    expect(resolveAgeBand({ age_range: "x" })).toBeNull();
  });
});

describe("tier 1 — deterministic skew parse", () => {
  it("resolves a bare token", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: PROD_247, age_range: "26–38" } });
    expect(r.mode).toBe("resolved");
    expect(r.gender).toBe("female");
    expect(r.tier).toBe(1);
    expect(r.ageBand).toBe("26-38");
  });

  it("resolves a STRONG skew", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: "Predominantly women in senior operational roles" } });
    expect(r).toMatchObject({ mode: "resolved", gender: "female", tier: 1 });
  });

  it("resolves a percentage gap of 20 points or more", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: "70% female / 30% male" } });
    expect(r).toMatchObject({ mode: "resolved", gender: "female", tier: 1 });
  });

  it("DECLINES a weak skew — that is a mixed audience, not a clear one", () => {
    // PROD_250. Tier 1 must not resolve; with no ICP text this lands on mixed.
    const r = resolveSubjectDescriptor({ demographics: { gender: PROD_250 } });
    expect(r.tier).not.toBe(1);
    expect(r.mode).toBe("mixed");
  });

  it("DECLINES a sub-20-point percentage split (PROD_253, 55/45)", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: PROD_253 } });
    expect(r.mode).toBe("mixed");
    expect(r.gender).toBeNull();
  });

  it("never latches onto the LOSING side of a percentage pair", () => {
    // "male 55% / female 45%" must never resolve female. Regression guard for the
    // exact failure mode a naive concat would produce.
    const r = resolveSubjectDescriptor({ demographics: { gender: "male 75% / female 25%" } });
    expect(r.gender).toBe("male");
  });

  it("reads a JSON-string demographics column", () => {
    const r = resolveSubjectDescriptor({ demographics: JSON.stringify({ gender: "Female", age_range: "30–40" }) });
    expect(r).toMatchObject({ mode: "resolved", gender: "female", ageBand: "30-40" });
  });
});

describe("tier 2 — the ICP's own first-person words", () => {
  it("resolves the 2026-07-28 ICP that tier 1 correctly hedged on", () => {
    // The real case: demographics said "All genders, skewing slightly female"
    // while the ICP's own introduction said "other mums in my antenatal group".
    const r = resolveSubjectDescriptor({
      demographics: { gender: PROD_254, age_range: "35–50" },
      introduction: "My baby is seven months old and I cannot remember the last time I slept.",
      fears: "I lie awake worrying that other mums in my antenatal group have figured this out. I worry the sleep deprivation is making me a worse mother than I would otherwise be.",
    });
    expect(r.mode).toBe("resolved");
    expect(r.gender).toBe("female");
    expect(r.tier).toBe(2);
  });

  it("does NOT read a pronoun describing the baby as the speaker's gender", () => {
    // "I love her more than I knew was possible" is about the BABY. Bare pronouns
    // are excluded from the lexicon precisely for this.
    const r = resolveSubjectDescriptor({
      demographics: {},
      introduction: "I love her more than I knew was possible. She wakes every two hours and her sleep is all I think about.",
    });
    expect(r.mode).toBe("unresolved");
    expect(r.gender).toBeNull();
  });

  it("resolves male from self-referential markers", () => {
    const r = resolveSubjectDescriptor({
      demographics: {},
      introduction: "I took paternity leave and it changed nothing.",
      fears: "The other dads at the group seem to have it worked out.",
    });
    expect(r).toMatchObject({ mode: "resolved", gender: "male", tier: 2 });
  });

  it("returns MIXED when both sides are genuinely balanced", () => {
    const r = resolveSubjectDescriptor({
      demographics: {},
      introduction: "As a mum, I felt it first.",
      fears: "As a dad, I feel exactly the same.",
    });
    expect(r.mode).toBe("mixed");
    expect(r.tier).toBe(3);
  });

  it("a female ICP that merely MENTIONS dads still resolves female, not mixed", () => {
    // Deliberate: "mixed" means a genuinely split audience, not any text where
    // the other gender appears. A mum describing her partner's dad group is a
    // female ICP. The 3:1 majority rule is what keeps this out of tier 3 — and
    // tier 3 alternating here would wrongly depict men for a mothers' audience.
    const r = resolveSubjectDescriptor({
      demographics: {},
      introduction: "As a mum I felt it first. My partner says the other dads at his group feel the same.",
      fears: "Other mums in my antenatal group say it too.",
    });
    expect(r).toMatchObject({ mode: "resolved", gender: "female", tier: 2 });
  });

  it("a single stray marker is not enough to resolve", () => {
    const r = resolveSubjectDescriptor({ demographics: {}, introduction: "As a mum I worry." });
    expect(r.mode).toBe("unresolved");
  });
});

describe("tier 3 / unresolved", () => {
  it("falls through to unresolved with NO gender when nothing is readable", () => {
    const r = resolveSubjectDescriptor({ demographics: {}, introduction: "I am stuck in my career." });
    expect(r).toMatchObject({ mode: "unresolved", gender: null, tier: null });
  });
  it("treats a missing ICP as unresolved, never as a default", () => {
    expect(resolveSubjectDescriptor(null)).toMatchObject({ mode: "unresolved", gender: null });
  });
});

describe("subjectClause — Arfeen's locked rule", () => {
  it("CLEAR ICP -> per batch: all five slots identical", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: "Female", age_range: "35–50" } });
    const five = [0, 1, 2, 3, 4].map(i => subjectClause(r, i));
    expect(new Set(five).size).toBe(1);
    expect(five[0]).toBe("A woman aged 35-50");
  });

  it("MIXED ICP -> alternates across the PERSON-BEARING slots, both represented", () => {
    // Regression guard for the 2026-07-29 live finding. The real style order puts
    // every person-bearing style on an EVEN variation index, so alternating on
    // the variation index rendered three women and zero men. Assert on what a
    // VIEWER sees — the clauses attached to the person styles — not on the raw
    // five-element sequence, which is what let the bug through.
    const r = resolveSubjectDescriptor({ demographics: { gender: PROD_250, age_range: "35–50" } });
    expect(r.mode).toBe("mixed");

    const clauses = subjectClausesForBatch(r, REAL_STYLE_ORDER);
    const visible = REAL_STYLE_ORDER
      .map((s, i) => ({ s, c: clauses[i] }))
      .filter(x => isPersonStyle(x.s))
      .map(x => x.c);

    expect(visible).toEqual([
      "A woman aged 35-50", "A man aged 35-50", "A woman aged 35-50",
    ]);
    // The point of the decision: BOTH are actually depicted.
    expect(new Set(visible).size).toBe(2);
    expect(visible.some(c => c.includes("woman"))).toBe(true);
    expect(visible.some(c => c.includes("man aged"))).toBe(true);
  });

  it("CLEAR ICP -> every person-bearing slot is the same, via the batch helper", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: "Female", age_range: "35–50" } });
    const clauses = subjectClausesForBatch(r, REAL_STYLE_ORDER);
    const visible = REAL_STYLE_ORDER.filter(isPersonStyle).map((_, i) =>
      clauses[REAL_STYLE_ORDER.map((s, j) => (isPersonStyle(s) ? j : -1)).filter(j => j >= 0)[i]]);
    expect(new Set(visible).size).toBe(1);
    expect(visible[0]).toBe("A woman aged 35-50");
  });

  it("isPersonStyle marks exactly the three person-bearing styles", () => {
    expect(REAL_STYLE_ORDER.filter(isPersonStyle))
      .toEqual(["person_shocked", "person_intense", "person_curious"]);
  });

  it("UNRESOLVED -> the pre-existing neutral wording, never a guess", () => {
    const r = resolveSubjectDescriptor({ demographics: {} });
    expect(subjectClause(r, 0)).toBe("Person (30-45 years old)");
  });

  it("uses the resolved age band, replacing the hardcoded 30-45", () => {
    const r = resolveSubjectDescriptor({ demographics: { gender: "Female", age_range: "35–50, with the core cluster at 38–46" } });
    expect(subjectClause(r, 0)).toBe("A woman aged 38-46");
  });

  it("NEVER phrases the subject as an absence — positive framing only", () => {
    // Diffusion has no NOT. Guard the whole output surface against a regression
    // that reintroduces "not a man" / "no women" phrasing.
    const cases = [
      resolveSubjectDescriptor({ demographics: { gender: "Female" } }),
      resolveSubjectDescriptor({ demographics: { gender: PROD_250 } }),
      resolveSubjectDescriptor({ demographics: {} }),
    ];
    for (const r of cases) {
      for (let i = 0; i < 5; i++) {
        const c = subjectClause(r, i);
        expect(c).not.toMatch(/\b(no|not|never|without|avoid|exclude)\b/i);
      }
    }
  });
});
