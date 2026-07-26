/**
 * icpRichness — client-side "is this Dream Buyer Profile worth surfacing?" check.
 *
 * Mirrors the server enrichment signal (server/_core/icpEnrichment.ts ICP_CONTENT_FIELDS):
 * the 16 text section fields plus the demographics JSON object. There is no status flag
 * on the ICP row, so richness is inferred by counting populated sections.
 *
 * Used to gate the kit-page Dream Buyer Profile card: a fully-generated ICP is complete
 * by construction (all 17 required), so it always shows; a thin *imported* profile
 * (~5 fields before enrichment) suppresses the card so we never surface a broken/empty one.
 */

// The 14 generated text section fields (matches server ICP_CONTENT_FIELDS).
// mediaConsumption / influencers / demographics are no longer generated, so they
// are not counted — otherwise every new profile would look 3 sections thinner
// than it is. Demographics is still handled separately below for legacy rows.
export const ICP_TEXT_SECTION_KEYS = [
  "introduction",
  "fears",
  "hopesDreams",
  "psychographics",
  "pains",
  "frustrations",
  "goals",
  "values",
  "objections",
  "buyingTriggers",
  "communicationStyle",
  "decisionMaking",
  "successMetrics",
  "implementationBarriers",
] as const;

/** A profile with fewer than this many populated sections (of 17) is treated as thin. */
export const ICP_RICHNESS_THRESHOLD = 6;

function demographicsPopulated(raw: unknown): boolean {
  if (!raw) return false;
  let obj: Record<string, unknown>;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return typeof raw === "string" ? raw.trim().length > 0 : false;
  }
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some(v => v != null && String(v).trim().length > 0);
}

/** Count populated sections: the 14 generated text fields, plus demographics on legacy rows. */
export function countPopulatedIcpSections(icp: unknown): number {
  if (!icp || typeof icp !== "object") return 0;
  const row = icp as Record<string, unknown>;
  let count = 0;
  for (const key of ICP_TEXT_SECTION_KEYS) {
    const v = row[key];
    if (v != null && String(v).trim().length > 0) count++;
  }
  if (demographicsPopulated(row["demographics"])) count++;
  return count;
}

/** True when the profile has enough populated sections to be worth surfacing. */
export function isIcpRich(icp: unknown): boolean {
  return countPopulatedIcpSections(icp) >= ICP_RICHNESS_THRESHOLD;
}
