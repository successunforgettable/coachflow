/**
 * The landing-page text the publish gate screens an ad against.
 *
 * WHY THIS MODULE EXISTS. `routers/meta.ts` built this text from `lp.content` — a column
 * `landingPages` does not have. Its copy lives in `originalAngle` / `godfatherAngle` /
 * `freeAngle` / `dollarAngle`, selected by `activeAngle`. The read was always `undefined`,
 * so the text was always "" and `checkAdToPageMatch` NEVER RAN: the ad-to-page check was
 * silently dead on every publish, at both call sites.
 *
 * The angle selection mirrors `landingPagePublisher.ts:86-91` — the active angle is the one
 * that actually renders, so it is the only one worth judging an ad against.
 *
 * ⚠️ `scripts/step4c-multiad-publish.ts` carries its own copy of this derivation. It is
 * deliberately untouched by this pass; folding it onto this helper is the follow-up that
 * closes the pair before it drifts again.
 */

const LP_ANGLE_COL_MAP = {
  original: "originalAngle",
  godfather: "godfatherAngle",
  free: "freeAngle",
  dollar: "dollarAngle",
} as const;

export type LpActiveAngleKey = keyof typeof LP_ANGLE_COL_MAP;

/**
 * The six prose fields compared by the ad-to-page check. Deliberately a subset: these are
 * the page's argument. Scaffolding (CTA labels, FAQ, guarantee, bonuses) would dilute the
 * overlap ratio without saying anything about what the page is selling.
 */
export const LP_AD_MATCH_FIELDS = [
  "eyebrowHeadline",
  "mainHeadline",
  "subheadline",
  "problemAgitation",
  "solutionIntro",
  "uniqueMechanism",
] as const;

/** The active angle's content object, or null when the row has none. */
export function activeAngleContent(lp: unknown): Record<string, unknown> | null {
  if (!lp || typeof lp !== "object") return null;
  const row = lp as Record<string, unknown>;
  const raw = typeof row.activeAngle === "string" ? row.activeAngle : "original";
  const key = (raw in LP_ANGLE_COL_MAP ? raw : "original") as LpActiveAngleKey;
  // Fall back to the original angle when the selected one is empty. Unreachable for a page
  // that actually published — `landingPagePublisher` throws on an empty active angle — but a
  // hand-edited row should degrade to "no text", never to a crash inside a gate.
  const picked = row[LP_ANGLE_COL_MAP[key]] ?? row.originalAngle;
  return picked && typeof picked === "object" ? (picked as Record<string, unknown>) : null;
}

/** The joined page text, or "" when there is nothing to judge. "" means the gate stays silent. */
export function pageTextForAdMatch(lp: unknown): string {
  const content = activeAngleContent(lp);
  if (!content) return "";
  return LP_AD_MATCH_FIELDS
    .map((k) => content[k])
    .filter((v): v is string => typeof v === "string")
    .join(" ");
}
