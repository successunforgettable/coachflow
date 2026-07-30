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
 *     indices 0, 2 and 4. Reordering silently changes who appears in each
 *     visible slot — subjectDescriptor.test.ts asserts against this exact order.
 *   - Auto Mode passes a length-validated headline array positionally.
 *
 * The order below is byte-for-byte identical to all three literals it replaces.
 */

export type AdVariationStyle =
  | "person_shocked"
  | "screenshot"
  | "person_intense"
  | "object"
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
  { style: "object", formula: "contrast" },
  { style: "person_curious", formula: "challenge" },
] as const;

/** The person-bearing styles. Kept here so the still-life set is derived, never restated. */
export const PERSON_BEARING_STYLES: ReadonlySet<string> = new Set<string>([
  "person_shocked",
  "person_intense",
  "person_curious",
]);
