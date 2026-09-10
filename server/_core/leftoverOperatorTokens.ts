/**
 * THE ONE DEFINITION OF A LEFTOVER OPERATOR TOKEN — shared by every publish gate.
 *
 * A leftover operator token is an `[INSERT_*]` placeholder that survived to an artefact about to go
 * public: the generator emitted it for the operator to fill, and nothing filled it. On a public page
 * it reads as a broken sentence with a raw bracket in it.
 *
 * Both publish paths call this, so there is one regex and one meaning:
 *   - `runLandingPagePublish` (landingPagePublisher.ts) refuses a landing page carrying any.
 *   - `publishLeadMagnet` / `publishDeliverableBody` (leadMagnetPublisher.ts) refuse a lead magnet
 *     or bonus deliverable carrying any. Added 2026-09-10, after magnet 7293 went live with
 *     `[INSERT_OFFER_LINK]` on both public pages and in its PDF: the landing-page gate existed and
 *     the magnet path had no equivalent.
 *
 * Deliberately narrow — `[INSERT_…]` only. A toolkit's reader-facing fill-in cells (`[NAME]`,
 * `[DATE]`) are content for the reader, not facts for the operator, and must not match.
 */
const LEFTOVER_OPERATOR_TOKEN = /\[INSERT_[A-Z_0-9]+\]/g;

/** Every distinct leftover operator token in `text`, in order of first appearance. Empty when clean. */
export function findLeftoverOperatorTokens(text: string): string[] {
  return Array.from(new Set(String(text ?? "").match(LEFTOVER_OPERATOR_TOKEN) ?? []));
}

/**
 * `text` with every leftover operator token removed and the spacing it leaves tidied. For CONTEXT
 * handed to a generator that has no way to fill a token — never for a published artefact, which the
 * publish gates refuse instead of repairing.
 */
export function stripLeftoverOperatorTokens(text: string): string {
  return String(text ?? "")
    .replace(LEFTOVER_OPERATOR_TOKEN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
