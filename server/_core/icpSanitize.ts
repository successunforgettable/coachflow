/**
 * ICP text sanitisers shared by every generation path.
 *
 * Extracted from icps.ts (2026-07-26) so the angle path gets the same treatment —
 * it previously wrote raw model output straight to the DB with no strip and no
 * compliance filter.
 */

/**
 * FAQ scaffolding strip (item 6, 2026-07-23) — the OBJECTIONS prompt asks the model to format each objection
 * as `What they say: "…". What they mean: …` (a useful internal frame). Stripped HERE, at the ICP source, so
 * the STORED objections are clean prose — every downstream surface (LP whoFor/FAQ, email, kit) inherits clean
 * text and the literal `**`/scaffolding labels can never render on a published page. Pure.
 */
export function stripObjectionScaffolding(text: unknown): unknown {
  if (typeof text !== "string") return text;
  return text
    .replace(/\*+/g, "")                                  // literal **/* markdown
    .replace(/\.?\s*\bwhat they mean:\s*/gi, " — ")        // "What they mean:" → a clean connector
    .replace(/\bwhat they say:\s*/gi, "")                  // "What they say:" label → drop
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
