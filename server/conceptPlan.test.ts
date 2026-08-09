/**
 * conceptPlan.test.ts — step 2b: awareness is concept-derived, and identity is the id.
 *
 * The live run cannot prove the dedupe removal, because no concept set on production contains a
 * duplicate desire (measured 2026-08-10: 0 of 1 sets). This file is therefore the ONLY proof of
 * that half of the step, and it is written to fail if the dedupe ever comes back.
 */

import { describe, it, expect } from "vitest";
import {
  planSlots,
  desireLabelFor,
  conceptPool,
  conceptFromLabel,
  conceptLabel,
  measureConceptCoherence,
  type ConceptSlot,
} from "./_core/conceptPlan";
import { awarenessPlanForCount, type AwarenessStage } from "./_core/conceptAxis";

const c = (id: number, desire: string, awareness: AwarenessStage): ConceptSlot => ({ id, desire, awareness });

/** A full, healthy set: the cold mix at 8 — unaware 3, problem 3, solution 1, product 1. */
const FULL_SET: ConceptSlot[] = [
  c(1, "want A", "unaware"),
  c(2, "want B", "problem_aware"),
  c(3, "want C", "solution_aware"),
  c(4, "want D", "product_aware"),
  c(5, "want E", "unaware"),
  c(6, "want F", "problem_aware"),
  c(7, "want G", "unaware"),
  c(8, "want H", "problem_aware"),
];

/** Two concepts sharing a desire, distinct on awareness — legal, and what the dedupe destroyed. */
const SHARED_DESIRE_SET: ConceptSlot[] = [
  c(11, "the same want", "unaware"),
  c(12, "the same want", "problem_aware"),
  c(13, "a different want", "solution_aware"),
];

describe("planSlots — the no-concept fallback is byte-identical to the old behaviour", () => {
  it("returns exactly awarenessPlanForCount(n) when there are no concepts", () => {
    for (const n of [3, 4, 15, 16, 18]) {
      expect(planSlots([], n, "deck constant").map((s) => s.stage)).toEqual(awarenessPlanForCount(n));
    }
  });

  it("gives every fallback slot the deck-constant desire and NO concept stamp", () => {
    const slots = planSlots([], 15, "deck constant");
    expect(slots.every((s) => s.desire === "deck constant")).toBe(true);
    expect(slots.every((s) => s.conceptId === null)).toBe(true);
  });

  it("carries a null deck constant through rather than inventing one", () => {
    expect(planSlots([], 4, null).every((s) => s.desire === null)).toBe(true);
  });
});

describe("planSlots — awareness comes off the concept, not off a parallel plan", () => {
  it("every slot's stage IS its concept's stage, at n below / equal to / above the set size", () => {
    for (const n of [3, 8, 15, 18]) {
      const slots = planSlots(FULL_SET, n, "unused");
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        const src = FULL_SET.find((x) => x.id === s.conceptId)!;
        expect(src).toBeDefined();
        expect(s.stage).toBe(src.awareness);
        expect(s.desire).toBe(src.desire);
      }
    }
  });

  it("deals in row order and cycles — slot i takes concept i % size", () => {
    const slots = planSlots(FULL_SET, 15, "unused");
    expect(slots.map((s) => s.conceptId)).toEqual(
      Array.from({ length: 15 }, (_, i) => FULL_SET[i % FULL_SET.length].id),
    );
  });

  it("a full 8-concept set reproduces the cold mix it was built from — the weighting is CARRIED, not replaced", () => {
    // The step deliberately moves the deck's awareness mix. This asserts what it moves it TO:
    // with a healthy set, nowhere, because the concept batch is itself cold-weighted.
    const mix = (stages: AwarenessStage[]) =>
      stages.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    for (const n of [16, 18]) {
      expect(mix(planSlots(FULL_SET, n, "x").map((s) => s.stage))).toEqual(mix(awarenessPlanForCount(n)));
    }
  });

  it("a SHORT set propagates its own shortfall — a stage with no concept gets no slot", () => {
    // The reason the concept-generation top-up exists. Recorded here so the consequence is
    // pinned by a test rather than left as prose in a handover.
    const short = FULL_SET.filter((x) => x.awareness !== "product_aware");
    const stages = new Set(planSlots(short, 15, "x").map((s) => s.stage));
    expect(stages.has("product_aware")).toBe(false);
  });
});

describe("the dedupe-by-desire-string is GONE — identity is the id", () => {
  it("two concepts sharing a desire BOTH reach the deal", () => {
    const slots = planSlots(SHARED_DESIRE_SET, 3, "x");
    expect(slots.map((s) => s.conceptId)).toEqual([11, 12, 13]);
    // The pair that a desire-string dedupe would have collapsed into one.
    const shared = slots.filter((s) => s.desire === "the same want");
    expect(shared).toHaveLength(2);
    expect(shared.map((s) => s.stage)).toEqual(["unaware", "problem_aware"]);
  });

  it("the gate pool holds one entry PER CONCEPT, not one per distinct desire", () => {
    // Under the old string pool this was 2 (the shared want merged), which is exactly how a
    // concept disappeared before reaching a single row.
    expect(conceptPool(SHARED_DESIRE_SET)).toEqual(["concept:11", "concept:12", "concept:13"]);
    expect(new Set(conceptPool(SHARED_DESIRE_SET)).size).toBe(SHARED_DESIRE_SET.length);
  });

  it("two rows from concepts sharing a desire do NOT collapse on the gate's desire axis", () => {
    const a = desireLabelFor(11, "the same want");
    const b = desireLabelFor(12, "the same want");
    expect(a).not.toBe(b); // identical prose, different concepts → different axis values
  });

  it("two rows from the SAME concept DO collapse on that axis", () => {
    expect(desireLabelFor(11, "the same want")).toBe(desireLabelFor(11, "the same want"));
  });

  it("a rephrased want does not fake distinctness — the label ignores the prose entirely", () => {
    expect(desireLabelFor(11, "the same want")).toBe(desireLabelFor(11, "an entirely different sentence"));
  });
});

describe("labels resolve back to concepts by id, never by matching text", () => {
  const byId = new Map(SHARED_DESIRE_SET.map((x) => [x.id, x]));

  it("round-trips a concept through its label", () => {
    for (const x of SHARED_DESIRE_SET) {
      expect(conceptFromLabel(conceptLabel(x.id), byId)).toEqual(x);
    }
  });

  it("returns null for a desire STRING, so no text can ever be mistaken for an identity", () => {
    expect(conceptFromLabel("the same want", byId)).toBeNull();
    expect(conceptFromLabel("unaware", byId)).toBeNull();
    expect(conceptFromLabel(null, byId)).toBeNull();
    expect(conceptFromLabel("concept:", byId)).toBeNull();
    expect(conceptFromLabel("concept:abc", byId)).toBeNull();
  });

  it("returns null for an id that is not in this set rather than guessing a neighbour", () => {
    expect(conceptFromLabel("concept:999", byId)).toBeNull();
  });

  it("falls back to the desire string only when there is no concept at all", () => {
    expect(desireLabelFor(null, "deck constant")).toBe("deck constant");
    expect(desireLabelFor(undefined, null)).toBeNull();
  });
});

describe("measureConceptCoherence — a stamp that resolves is not a stamp that is true", () => {
  it("counts a faithful deck as fully coherent", () => {
    const rows = planSlots(FULL_SET, 8, "x").map((s) => ({
      conceptId: s.conceptId, desire: s.desire, awareness: s.stage,
    }));
    expect(measureConceptCoherence(rows, FULL_SET)).toEqual({
      rows: 8, stamped: 8, unstamped: 0, dangling: 0,
      desireMismatch: 0, stageMoved: 0, conceptsRepresented: 8,
    });
  });

  it("catches a stamp pointing at the WRONG concept — the failure a non-null check cannot see", () => {
    const rows = [{ conceptId: 1, desire: "want B", awareness: "problem_aware" }];
    const m = measureConceptCoherence(rows, FULL_SET);
    expect(m.stamped).toBe(1);
    expect(m.desireMismatch).toBe(1);
    expect(m.stageMoved).toBe(1);
  });

  it("separates a gate-moved stage from a fault", () => {
    // The gate may legitimately move awareness to clear a collision; the row still truthfully
    // records which concept supplied its desire, so this is reported, not counted as broken.
    const rows = [{ conceptId: 1, desire: "want A", awareness: "solution_aware" }];
    const m = measureConceptCoherence(rows, FULL_SET);
    expect(m.stageMoved).toBe(1);
    expect(m.desireMismatch).toBe(0);
    expect(m.dangling).toBe(0);
  });

  it("counts a dangling stamp and an unstamped row apart from each other", () => {
    const m = measureConceptCoherence(
      [{ conceptId: 999, desire: "x", awareness: "unaware" }, { conceptId: null, desire: "y", awareness: "unaware" }],
      FULL_SET,
    );
    expect(m.dangling).toBe(1);
    expect(m.unstamped).toBe(1);
    expect(m.stamped).toBe(0);
  });
});
