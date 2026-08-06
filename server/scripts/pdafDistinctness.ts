/**
 * pdafDistinctness.ts — the CATEGORICAL 2-of-4 P.D.A.F. comparator.
 *
 * ⚠️ THIS FILE CONTAINS NO INFERENCE, NO TEXT ANALYSIS AND NO DATABASE ACCESS,
 * AND MUST NOT ACQUIRE ANY. It compares dimension labels that were ASSIGNED —
 * nothing here ever looks at the finished copy to guess what those labels are.
 * The baseline audit's guesswork lives in pdaf-collapse-audit.ts, deliberately
 * on the other side of this boundary.
 *
 * This is the piece the Phase 5 distinctness gate will use unchanged: at that
 * point the four dimensions come from real columns written at generation time,
 * so the gate does exactly what it does here, with assigned values instead of
 * recovered ones.
 *
 * THE RULE — from docs/andromeda/copy-research/Andromeda_Copy_EntityID_Distinctness.md:
 *   "any two copy variants must satisfy AT LEAST TWO of the four dimensions"
 *   "If a copy pair differs in 0 or only 1 dimension, they will collapse under
 *    a single Entity ID. REJECT AND REGENERATE."
 *
 * The four dimensions (report §"ANDROMEDA COPY DISTINCTNESS VALIDATION RULE"):
 *   P — Persona / archetype: who the ad speaks to
 *   D — Desire or pain: the core psychological motivator
 *   A — Awareness stage: the reader's journey phase
 *   F — Syntactic / narrative format: the copy architecture
 *
 * NOT IN THIS FILE, BY DECISION (build spec §7): no cosine similarity, no 0.40
 * threshold, no local sentence-transformer. That number comes from a model that
 * is not Meta's, and the alignment audit contradicts itself on it — its own
 * evidence-hygiene section excludes static thresholds as practitioner folklore.
 * The gate is the categorical rule above, which we own and can prove.
 */

/** One of the four axes. */
export type PdafDimension = "persona" | "desire" | "awareness" | "format";

export const PDAF_DIMENSIONS: readonly PdafDimension[] = [
  "persona",
  "desire",
  "awareness",
  "format",
] as const;

/**
 * The dimension labels for a single piece of copy.
 *
 * `null` means "no value was assigned on this axis" — which is a real and
 * important state, not a missing-data problem. Node 6 assigns no awareness
 * stage at all, so every headline it produces carries awareness: null. Two
 * pieces that are both unassigned DO NOT DIFFER on that axis: an axis nobody
 * varied cannot be the axis that separates two ads.
 */
export type PdafLabels = {
  persona: string | null;
  desire: string | null;
  awareness: string | null;
  format: string | null;
};

export type PairVerdict = {
  /** How many of the four axes actually differ. */
  differingCount: number;
  /** Which axes differ, for the regenerate-on-a-different-dimension instruction. */
  differingDimensions: PdafDimension[];
  /** True when the pair clears the 2-of-4 bar. */
  distinct: boolean;
  /** True when the pair would collapse to one Entity ID (0 or 1 axes differ). */
  collapses: boolean;
};

/**
 * Do two labels count as different on one axis?
 *
 * Both-null → NOT different (see PdafLabels). One-null → different, because one
 * piece was positioned on that axis and the other was not. Comparison is
 * case- and whitespace-insensitive so trivial storage differences in a free-text
 * field (e.g. a trailing space on targetMarket) never masquerade as diversity.
 */
function axisDiffers(a: string | null, b: string | null): boolean {
  const norm = (v: string | null) =>
    v === null ? null : v.trim().toLowerCase().replace(/\s+/g, " ");
  const na = norm(a);
  const nb = norm(b);
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  return na !== nb;
}

/** Compare one pair on all four axes. The whole gate, in one function. */
export function comparePair(a: PdafLabels, b: PdafLabels): PairVerdict {
  const differingDimensions = PDAF_DIMENSIONS.filter((d) => axisDiffers(a[d], b[d]));
  const differingCount = differingDimensions.length;
  return {
    differingCount,
    differingDimensions,
    distinct: differingCount >= 2,
    collapses: differingCount < 2,
  };
}

export type BatchAudit<TId> = {
  itemCount: number;
  pairCount: number;
  collapsingPairs: Array<{ a: TId; b: TId; verdict: PairVerdict }>;
  /** Histogram: index 0..4 = number of pairs differing on exactly that many axes. */
  differingHistogram: number[];
  /** Share of pairs that collapse, 0..1. NaN when there are fewer than two items. */
  collapseRate: number;
};

/**
 * Compare every pair in a batch. This is what a batch has to clear before it
 * ships: the rule is pairwise across the whole set, not variant-versus-previous.
 */
export function auditBatch<TId>(
  items: Array<{ id: TId; labels: PdafLabels }>,
): BatchAudit<TId> {
  const collapsingPairs: Array<{ a: TId; b: TId; verdict: PairVerdict }> = [];
  const differingHistogram = [0, 0, 0, 0, 0];
  let pairCount = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const verdict = comparePair(items[i].labels, items[j].labels);
      pairCount++;
      differingHistogram[verdict.differingCount]++;
      if (verdict.collapses) {
        collapsingPairs.push({ a: items[i].id, b: items[j].id, verdict });
      }
    }
  }

  return {
    itemCount: items.length,
    pairCount,
    collapsingPairs,
    differingHistogram,
    collapseRate: pairCount === 0 ? NaN : collapsingPairs.length / pairCount,
  };
}
