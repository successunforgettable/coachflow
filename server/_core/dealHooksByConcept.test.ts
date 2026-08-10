/**
 * dealHooksByConcept.test.ts — the on-image hook is dealt by CONCEPT, and never twice.
 *
 * ⚠️ THE DEFECT THIS PINS, measured 2026-08-10. The picture's two text surfaces were dealt
 * independently: the headline came from the gated pool per slot, the hook came from
 * `bodyTexts[i % bodyTexts.length]`. On the step-3 proof, 3 of 4 pictures carried a hook line
 * from a DIFFERENT concept than the headline they baked — and the one agreement was a modulo
 * coincidence rather than a mechanism, which is exactly why a passing eyeball check proved
 * nothing.
 *
 * ⚠️ AND THE SECOND DEFECT IN THE SAME DEAL. Node 7 returned 3 hooks for 4 slots, so the
 * modulo REPEATED one: adCopy 6044 baked onto slots 1 and 4 — duplicate text on the exact
 * surface Meta's OCR reads. The replacement never reuses a row; a slot with nothing left
 * ships no line, which makes a short hook deck visible instead of silently collapsing.
 */

import { describe, it, expect } from "vitest";
import { dealHooksByConcept, type OnImageTextRow } from "./compositeHeadline";

const hook = (id: number, conceptId: number | null, text = `hook-${id}`): OnImageTextRow => ({
  id, conceptId, awareness: "problem_aware", text, source: "image_hook",
});

describe("concept first", () => {
  it("gives every slot the hook of its own concept when the deck allows it", () => {
    const rows = [hook(1, 11), hook(2, 22), hook(3, 33), hook(4, 44)];
    const out = dealHooksByConcept(rows, [33, 11, 44, 22], 4);
    expect(out.map((h) => h!.conceptId)).toEqual([33, 11, 44, 22]);
  });

  it("matches by concept id even when the rows arrive in an unrelated order", () => {
    const rows = [hook(9, 44), hook(8, 11)];
    const out = dealHooksByConcept(rows, [11, 44], 2);
    expect(out[0]!.id).toBe(8);
    expect(out[1]!.id).toBe(9);
  });

  it("never matches on the text — a row with a NULL concept is not a wildcard", () => {
    const rows = [hook(1, null)];
    const out = dealHooksByConcept(rows, [11], 1);
    // It still lands, but as the second-pass fallback, not as a concept match.
    expect(out[0]!.id).toBe(1);
    expect(out[0]!.conceptId).toBeNull();
  });
});

describe("then any unused row", () => {
  it("falls back to a hook of another concept rather than leaving the band blank", () => {
    const rows = [hook(1, 99)];
    const out = dealHooksByConcept(rows, [11], 1);
    expect(out[0]!.id).toBe(1);
  });

  it("serves slots with no concept at all (the wizard and legacy paths) in order", () => {
    const rows = [hook(1, 11), hook(2, 22)];
    const out = dealHooksByConcept(rows, [null, null], 2);
    expect(out.map((h) => h!.id)).toEqual([1, 2]);
  });

  it("satisfies concept matches BEFORE handing rows out as fallbacks", () => {
    // Slot 0 has no concept and would take row 1 first under a naive left-to-right deal,
    // stealing the only row that matches slot 1.
    const rows = [hook(1, 22), hook(2, 33)];
    const out = dealHooksByConcept(rows, [null, 22], 2);
    expect(out[1]!.id).toBe(1);
    expect(out[0]!.id).toBe(2);
  });
});

describe("never the same row twice", () => {
  it("leaves the fourth slot with NO line when only three hooks exist — the real 2026-08-10 case", () => {
    const rows = [hook(1, 11), hook(2, 22), hook(3, 33)];
    const out = dealHooksByConcept(rows, [11, 22, 33, 44], 4);
    expect(out.slice(0, 3).map((h) => h!.id)).toEqual([1, 2, 3]);
    expect(out[3]).toBeNull();
  });

  it("does not hand one row to two slots even when both want the same concept", () => {
    const rows = [hook(1, 11)];
    const out = dealHooksByConcept(rows, [11, 11], 2);
    expect(out[0]!.id).toBe(1);
    expect(out[1]).toBeNull();
  });

  it("produces no duplicate ids across the deck under any mix", () => {
    const rows = [hook(1, 11), hook(2, 11), hook(3, null)];
    const out = dealHooksByConcept(rows, [11, 11, 11, 11], 4);
    const ids = out.filter(Boolean).map((h) => h!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns all-null when there are no hook rows at all", () => {
    expect(dealHooksByConcept([], [11, 22], 2)).toEqual([null, null]);
  });

  it("returns exactly one entry per slot, never more", () => {
    const rows = [hook(1, 11), hook(2, 22), hook(3, 33), hook(4, 44), hook(5, 55)];
    expect(dealHooksByConcept(rows, [11, 22], 2)).toHaveLength(2);
  });
});

describe("determinism", () => {
  it("deals identically on repeated calls", () => {
    const rows = [hook(1, 11), hook(2, 22), hook(3, 11)];
    const slots = [11, 11, 22, 33];
    const a = dealHooksByConcept(rows, slots, 4).map((h) => h?.id ?? null);
    const b = dealHooksByConcept(rows, slots, 4).map((h) => h?.id ?? null);
    expect(b).toEqual(a);
  });
});
