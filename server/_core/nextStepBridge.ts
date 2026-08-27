/**
 * THE MAGNET → FREE-EVENT BRIDGE — pointer resolution and the additional-page guard.
 *
 * `nextStepUrl` has been a render-time seam in `leadMagnetRenderer.ts` since the tier-3 work
 * (`c8a0bf5`): all three renderers accept it, and NOTHING HAS EVER POPULATED IT. This module is
 * what fills it, and the two functions here are the whole of the decision — everything else is a
 * database read.
 *
 * 🔑 WHY THE PAIRING IS EXPLICIT AND NEVER DERIVED — one test, applied to both sides.
 *
 * READ side: the pointer lives on `hvcoTitles`, not on `campaignKits`. A kit-level pointer would
 * force `publishLeadMagnet` to hop `hvco.serviceId` → *first ICP for that service* → kit, and that
 * middle hop is a `.limit(1)` on a loose join: right when there is one ICP, silently wrong when
 * there are several. On `hvcoTitles` it is read off a row the publisher already holds, with no
 * join at all.
 *
 * WRITE side: `landingPages.generate` takes `nextStepForHvcoId` as an EXPLICIT input. It must never
 * infer which magnet a page belongs to from the kit's or the service's currently-selected one —
 * that is the identical failure mirrored, correct by accident with one magnet and silently wrong
 * with several. The pairing is a CONTENT decision (this page answers the gap THAT magnet leaves),
 * made at generation time, so the caller states it.
 *
 * ⚠️ A WRONG BRIDGE IS WORSE THAN NO BRIDGE. A magnet linking to the wrong live page looks
 * finished and reads as correct — nothing errors, and neither the coach nor the reader finds out.
 * That is why the failure mode this module refuses is silence, not breakage.
 */

/**
 * Which of the three states the bridge is in. Reported rather than collapsed to success/failure,
 * because "the pointer is set but you have not published the page yet" is a state a coach can be
 * in for a long time without knowing, and it renders identically to having no pointer at all.
 */
export type BridgeOutcome =
  /** Pointer set, target published — the deliverable renders a real button. */
  | "linked"
  /** Pointer set, target not published (or gone) — the honest text card, and there is work to do. */
  | "target-unpublished"
  /** No pointer — the honest text card, and nothing is wrong. Today's state for every row. */
  | "no-pointer";

/**
 * Resolve the magnet's next-step destination from its pointer and the page it points at.
 *
 * Publication state is read FRESH here rather than mirrored onto the pointer. One field, one
 * meaning: the pointer records WHICH page, never whether it is live yet.
 *
 * Returns `url: null` for both non-linked outcomes, so the renderers fall through to the tier-3
 * text card unchanged. Never throws, never guesses at another page.
 */
export function resolveNextStep(
  pointer: number | null | undefined,
  page: { publicUrl: string | null } | null | undefined,
): { url: string | null; outcome: BridgeOutcome } {
  // `!pointer` rather than `== null`: 0 is not a row id, and reading it as one would point the
  // bridge at nothing while reporting a link.
  if (!pointer) return { url: null, outcome: "no-pointer" };
  const url = page?.publicUrl?.trim();
  if (!url) return { url: null, outcome: "target-unpublished" };
  return { url: page!.publicUrl!, outcome: "linked" };
}

/**
 * Why an additional landing page may not be generated for this kit — or `null` when it may.
 *
 * 🔴 THE COMPLETENESS CONSTRAINT, ENFORCED SERVER-SIDE. `crownIfPrimary` skips `autoSelectBest`
 * for an additional page, which also skips the kit COMPLETENESS check — so a kit whose ONLY
 * landing page were the free-event page would never flip draft → complete, because nothing else
 * would ever crown one. `validateCascadePrereqs` does not cover this: it requires offer, mechanism,
 * hvco, headlines and adCopy, and says nothing about a landing page.
 *
 * Server-side rather than a UI affordance, deliberately: a guarantee a caller can bypass is not a
 * guarantee, and the eventual automatic trigger is a caller too.
 */
export function additionalPageRefusalReason(
  kit: { selectedLandingPageId: number | null } | null | undefined,
): string | null {
  if (!kit?.selectedLandingPageId) {
    return "This campaign has no primary landing page yet. A free-next-step page is an additional artefact and cannot be the first or only landing page on a campaign — generate the campaign's own page first.";
  }
  return null;
}
