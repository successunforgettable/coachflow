/**
 * The five tabloid ad-creative variation slots — ONE source of truth.
 *
 * This array was previously a duplicated literal in THREE places:
 *   - adCreativesGenerator.ts:456   (runAdCreativesGeneration — Auto Mode)
 *   - routers/adCreatives.ts:917    (generateAsync — the coach's Generate button)
 *   - routers/adCreatives.ts:1063   (generateAdCreativesBatch — from campaigns.ts)
 *
 * Three hand-maintained copies of the same list is how a fix lands in one loop
 * and misses its siblings. That is not hypothetical here: the 2026-07-30 site
 * sweep (docs/handovers/AD_IMAGE_SITE_SWEEP_2026-07-30.md) found P8 body
 * rotation, the P6 subject resolver and the compositor zone each present on
 * some of these loops and absent on others, while STATE.md recorded them as
 * fixed everywhere. Same class as the hvco ordinal defect, whose fix was to
 * collapse two layers onto one call path (see _core/pickSelected.ts).
 *
 * ⚠️ ORDER IS LOAD-BEARING — DO NOT REORDER.
 *   - Ad-copy body rotation is index-based: bodies[i % bodies.length].
 *   - The subject resolver alternates over PERSON-BEARING slots, which sit at
 *     indices 0, 2 and 3. Reordering silently changes who appears in each
 *     visible slot — subjectDescriptor.test.ts asserts against this exact order.
 *   - Auto Mode passes a length-validated headline array positionally.
 *
 * ⚠️ ARITY IS DERIVED, NEVER HARDCODED. Every consumer must loop to
 * AD_VARIATIONS.length. Two call sites hardcoded `i < 5` until the object-slot
 * retirement (2026-08-01) and would have crashed on `variations[4].formula` the
 * moment this array shrank — on the coach's Generate button and the campaigns
 * batch path. If you change this array's length, the only correct diff is zero
 * changes anywhere else.
 *
 * ─── OBJECT SLOT RETIRED, 2026-08-01 ────────────────────────────────────────
 * `{ style: "object", formula: "contrast" }` sat at index 3. Prompt-based text
 * suppression failed three times on it — background signage (L1–L4 fixed it),
 * then engraved plinths (L5 fixed it), then embroidered fabric and a debossed
 * moulded block. Cumulative across both L5 batches: 46 clean / 2 leaked on 48
 * renders, a ~12% upper confidence bound, which fails the no-uncontrolled-text
 * bar for unattended publishing. Retired rather than iterated on a fourth time.
 * Full evidence: docs/handovers/OBJECT_SLOT_L5_RESULT_2026-07-31.md.
 *
 * This retirement is TABLOID-ONLY. The template-card deck (orchestration.ts)
 * and EDITORIAL_VARIATIONS both remain at five, deliberately — the resulting
 * style-dependent deck size is accepted and intended, not an oversight.
 *
 * "object" is deliberately absent from the union below so tsc rejects any
 * residual literal rather than letting it fall through to a person prompt.
 * It REMAINS in the `designStyle` DB enum — historical rows carry it.
 */

export type AdVariationStyle =
  | "person_shocked"
  | "screenshot"
  | "person_intense"
  | "person_curious";

export type AdVariationFormula =
  | "benefit"
  | "social_proof"
  | "curiosity"
  | "contrast"
  | "challenge";

export type AdVariation = {
  readonly style: AdVariationStyle;
  readonly formula: AdVariationFormula;
};

export const AD_VARIATIONS: readonly AdVariation[] = [
  { style: "person_shocked", formula: "benefit" },
  { style: "screenshot", formula: "social_proof" },
  { style: "person_intense", formula: "curiosity" },
  { style: "person_curious", formula: "challenge" },
] as const;

/**
 * Styles retired from the deck that still exist on historical `adCreatives`
 * rows. `regenerateSingle` and `makeVertical` read `designStyle` straight off
 * the stored row, so an old `object` row would re-enter the retired prompt path
 * on demand — the deck removal alone does not close that door.
 *
 * Mapped EXPLICITLY rather than left to generateAdImagePrompt's
 * `stylePrompts[style] || stylePrompts.person_shocked` fallback: relying on the
 * fallthrough would silently turn a still life into a person and leave nothing
 * to grep for. `object` maps to `screenshot` because that preserves the slot's
 * visual role — the other still life, and the one proven clean (6/6 on the
 * L1–L4 run, plus clean on the live Step D run).
 *
 * NOTE: the stored `designStyle` value is deliberately NOT rewritten, so the
 * row keeps its history. The UI badge on such a row therefore still reads
 * "object" while the image is a screenshot — cosmetic, flagged, not fixed here.
 */
const RETIRED_STYLE_REPLACEMENT: Readonly<Record<string, AdVariationStyle>> = {
  object: "screenshot",
};

/** The style a stored row should actually render as today. */
export function liveStyleFor(storedStyle: string | null | undefined): string {
  const s = storedStyle || "person_shocked";
  return RETIRED_STYLE_REPLACEMENT[s] ?? s;
}
