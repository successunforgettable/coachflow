/**
 * variationCounts.ts — how many variants a copy node generates, as configuration
 * rather than three hardcoded ternaries.
 *
 * ⚠️ THIS MODULE DOES NOT CUT ANYTHING, AND MUST NOT. The build decision is
 * explicit (build spec §8a, decision 2): the reduction to a budget-scaled count
 * happens AT THE DISTINCTNESS GATE, never by generating fewer pieces up front.
 * The gate needs a surplus to reject from, and the regenerate-on-collapse loop
 * needs somewhere to regenerate toward. Generating 40 and keeping the 12 that
 * clear the 2-of-4 bar is correct; generating 12 and hoping is not.
 *
 * So the DEFAULTS HERE REPRODUCE TODAY'S BEHAVIOUR EXACTLY — lite 3, standard 15,
 * power 30 for ad copy. Nothing about the shipped output changes by introducing
 * this file. What changes is that the number now has one home and can be tuned
 * without editing a generator.
 *
 * The budget bands below are the TARGETS FOR THE GATE, recorded here so the two
 * numbers live together and nobody later mistakes a generation count for a ship
 * count. From the account-diversity research: more budget and more conversion
 * signal means Meta can meaningfully separate more distinct ads; past the band,
 * extras collapse and compete for the same auction ticket.
 */

export type BudgetBand = "small" | "mid" | "large";

/**
 * How many GENUINELY DISTINCT pieces an account can carry, by budget band —
 * distinct meaning "clears the 2-of-4 P.D.A.F. rule", not "is a different string".
 * Consumed by the distinctness gate when it ships. NOT a generation count.
 */
export const DISTINCT_TARGET_BY_BAND: Readonly<Record<BudgetBand, { min: number; max: number }>> = {
  small: { min: 8, max: 12 },
  mid: { min: 15, max: 25 },
  large: { min: 25, max: 40 },
};

/** Generation counts. Deliberately the pre-existing values. */
export const AD_COPY_COUNTS = {
  lite: 3,
  standard: 15,
  power: 30,
} as const;

/** Headline-node counts, expressed per formula (5 formulas run in parallel). */
export const HEADLINE_COUNTS_PER_FORMULA = {
  lite: 2,      // was Math.round(5 * 0.4)
  standard: 5,
  power: 15,    // was 5 * 3
} as const;

function envOverride(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * How many ad-copy variants to GENERATE. An explicit caller value wins, then an
 * env override, then the mode defaults. Unset env → byte-identical to the old
 * `input.liteMode ? 3 : input.powerMode ? 30 : 15`.
 */
export function resolveAdCopyCount(input: {
  liteMode?: boolean;
  powerMode?: boolean;
  variationCount?: number;
}): number {
  if (input.variationCount && input.variationCount > 0) return Math.floor(input.variationCount);
  const override = envOverride("ZAP_AD_COPY_VARIATION_COUNT");
  if (override) return override;
  if (input.liteMode) return AD_COPY_COUNTS.lite;
  if (input.powerMode) return AD_COPY_COUNTS.power;
  return AD_COPY_COUNTS.standard;
}
