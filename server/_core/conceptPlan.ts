/**
 * conceptPlan.ts — turning a concept set into per-slot copy assignments (step 2b).
 *
 * A concept is a (desire, awareness) UNIT. Before this module, ad copy read `desire` from the
 * concept set while `awareness` came from a separate synthetic allocation
 * (`awarenessPlanForCount`), so the pair stamped on a row need not have corresponded to any
 * concept that actually existed. Everything here exists to make one slot descend from one
 * concept, and to make that descent checkable afterwards.
 *
 * ⚠️ IDENTITY IS THE ID, NEVER THE PROSE. Two concepts may legitimately share a desire while
 * differing in awareness (`conceptValidator` enforces distinctness on the PAIR, not on the
 * desire alone). Anything in this module that pairs, de-duplicates or looks up a concept does so
 * on `id`. Matching on desire text would silently merge two real concepts, and matching on
 * awareness text would merge four of them.
 *
 * Extracted from adCopyGenerator so the rules can be tested against the shipped code rather than
 * against a re-implementation of it.
 */

import { awarenessPlanForCount, dealAcrossSlots, type AwarenessStage } from "./conceptAxis";

/** One concept, reduced to the two axes a copy slot takes from it, plus its identity. */
export type ConceptSlot = { id: number; desire: string; awareness: AwarenessStage };

/** One planned copy slot. `conceptId` is null only on the no-concept fallback. */
export type PlannedSlot = {
  stage: AwarenessStage;
  desire: string | null;
  conceptId: number | null;
};

/**
 * Plan `n` slots from a concept set, dealing the concepts across the slots in row order.
 *
 * With no concepts this returns the cold-weighted plan and the single deck-constant desire —
 * the pre-concept behaviour, byte for byte, so an older ICP or a failed concept run cannot
 * regress. That fallback is the reason this is not simply `dealAcrossSlots`.
 *
 * ⚠️ NO DE-DUPLICATION BY DESIRE. The dedupe that step 2a kept is deliberately absent: with
 * awareness now carried by the concept, two concepts sharing a want but differing in stage are
 * two real slots, and dropping one of them destroys a slot the coach paid for.
 */
export function planSlots(
  concepts: readonly ConceptSlot[],
  n: number,
  fallbackDesire: string | null,
): PlannedSlot[] {
  if (!concepts.length) {
    return awarenessPlanForCount(n).map((stage) => ({
      stage,
      desire: fallbackDesire,
      conceptId: null,
    }));
  }
  return dealAcrossSlots(concepts, n).map((c) => ({
    stage: c.awareness,
    desire: c.desire,
    conceptId: c.id,
  }));
}

/** The distinctness gate's label for a concept. */
export function conceptLabel(id: number): string {
  return `concept:${id}`;
}

/**
 * The value the distinctness gate compares on its DESIRE axis.
 *
 * The stamped concept id, not the desire prose. Labelling the axis with text would mean two
 * rows collapse when a generator happens to phrase two different wants alike, and stay distinct
 * when it rephrases one want two ways — identity by prose. The database column still stores the
 * real prose; only the gate's internal label is the id.
 *
 * Falls back to the desire string only where there is no concept at all (the deck-constant
 * path), where every row shares one value and the axis is silent by design.
 */
export function desireLabelFor(
  conceptId: number | null | undefined,
  desire: string | null,
): string | null {
  return conceptId != null ? conceptLabel(conceptId) : (desire ?? null);
}

/**
 * The gate's replacement pool for the desire axis: concept ids.
 *
 * Needs no de-duplication — ids are unique by definition. That is the point: a pool of desire
 * STRINGS had to be de-duplicated by text, which merged two concepts sharing a want into one
 * pool entry and made the pool smaller than the concept set.
 */
export function conceptPool(concepts: readonly ConceptSlot[]): string[] {
  return concepts.map((c) => conceptLabel(c.id));
}

/** Resolve a gate label back to its concept. Returns null for a non-concept label. */
export function conceptFromLabel(
  label: unknown,
  conceptById: ReadonlyMap<number, ConceptSlot>,
): ConceptSlot | null {
  const m = /^concept:(\d+)$/.exec(String(label ?? ""));
  return m ? (conceptById.get(Number(m[1])) ?? null) : null;
}

/**
 * How faithfully a finished deck descends from its concepts.
 *
 * A stamp that RESOLVES is not the same as a stamp that is TRUE, so each row is compared against
 * the concept it points at on both axes rather than merely checked for being non-null.
 *
 * `stageMoved` is reported separately from the fault counts on purpose: the distinctness gate may
 * legitimately move a row to a different awareness to clear a collision, and such a row still
 * truthfully records which concept supplied its desire. `desireMismatch` and `dangling` are
 * faults — there is no legitimate path to either.
 */
export type ConceptCoherence = {
  rows: number;
  stamped: number;
  unstamped: number;
  dangling: number;
  desireMismatch: number;
  stageMoved: number;
  conceptsRepresented: number;
};

export function measureConceptCoherence(
  rows: ReadonlyArray<{ conceptId?: number | null; desire?: string | null; awareness?: string | null }>,
  concepts: readonly ConceptSlot[],
): ConceptCoherence {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const out: ConceptCoherence = {
    rows: rows.length,
    stamped: 0,
    unstamped: 0,
    dangling: 0,
    desireMismatch: 0,
    stageMoved: 0,
    conceptsRepresented: 0,
  };
  const seen = new Set<number>();
  for (const r of rows) {
    if (r.conceptId == null) { out.unstamped++; continue; }
    const src = byId.get(Number(r.conceptId));
    if (!src) { out.dangling++; continue; }
    out.stamped++;
    seen.add(src.id);
    if (String(r.desire ?? "").trim() !== src.desire) out.desireMismatch++;
    if (String(r.awareness ?? "") !== src.awareness) out.stageMoved++;
  }
  out.conceptsRepresented = seen.size;
  return out;
}
