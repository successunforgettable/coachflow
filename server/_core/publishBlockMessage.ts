/**
 * The coach-facing message when the publish gate refuses an ad.
 *
 * WHY THIS IS ITS OWN MODULE. The refusal used ONE message for every blocking class, worded
 * for the compliance axis: "it states things about the reader, or claims your own material
 * doesn't back up". That is accurate for `second_person_protected_attribute`,
 * `promised_result` and their siblings, and simply WRONG for `ad_to_page_mismatch`, which is
 * a DESTINATION check — the ad and its landing page are about different subjects. A coach
 * reading the compliance wording would go and rewrite copy that was never the problem.
 *
 * Pure and dependency-free so the wording can be asserted without a database or a tRPC
 * context; the router builds its `TRPCError` message from here.
 */

export type BlockingHitLike = {
  classId: string | number;
  matched: string;
  location: string;
};

export const AD_TO_PAGE_MISMATCH_CLASS = "ad_to_page_mismatch";

/** Used when the destination mismatch is the ONLY reason the ad was refused. */
export const AD_TO_PAGE_MISMATCH_MESSAGE =
  "This ad wasn't published because it and the landing page it points to are about different things — " +
  "point the ad at the landing page for this offer, or update the page so it matches what the ad promises.";

/** Used when compliance hits are ALSO present, so the sentence reads as an addition. */
export const AD_TO_PAGE_MISMATCH_MESSAGE_ALSO =
  "It also points at a landing page about a different subject — " +
  "point the ad at the landing page for this offer, or update the page so it matches what the ad promises.";

/**
 * Builds the refusal message from the blocking hits. The compliance wording is UNCHANGED and
 * is now scoped to the compliance hits only, so a destination mismatch can no longer drag an
 * unrelated "rewrite your copy" instruction in behind it.
 */
export function buildPublishBlockMessage(blocking: BlockingHitLike[]): string {
  const isMismatch = (h: BlockingHitLike) => String(h.classId) === AD_TO_PAGE_MISMATCH_CLASS;
  const mismatch = blocking.filter(isMismatch);
  const compliance = blocking.filter((h) => !isMismatch(h));

  const parts: string[] = [];
  if (compliance.length > 0) {
    const detail = compliance.slice(0, 4).map((h) => `${h.location}: "${h.matched}"`).join("; ");
    parts.push(
      `This ad wasn't published because it states things about the reader, or claims your own material doesn't back up: ${detail}. ` +
      `Rewrite it to speak from your own experience and what the programme does, or add the real figures and client material to your profile first.`,
    );
  }
  if (mismatch.length > 0) {
    parts.push(compliance.length > 0 ? AD_TO_PAGE_MISMATCH_MESSAGE_ALSO : AD_TO_PAGE_MISMATCH_MESSAGE);
  }
  return parts.join(" ");
}
