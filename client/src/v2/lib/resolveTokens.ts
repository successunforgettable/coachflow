/**
 * Client-side placeholder resolver — render + download substitution.
 *
 * Mirrors server/lib/placeholderResolver.ts (regex + synonym map MUST stay in
 * sync with that file). Used at the two in-browser surfaces:
 *   - kit render: resolve each asset's data before the *Preview components
 *   - Download Brief: resolve extracted fields before building the PDF
 *
 * External pushes (Meta / GHL) resolve server-side via placeholderResolver;
 * this client copy never touches those payloads.
 *
 * The resolved map here is a flat Record<token, value> (as produced by
 * V2CampaignKit from trpc.placeholders.list), not the server's
 * Map<string, ResolvedEntry>.
 */

/** Canonical placeholder regex — mirrors placeholderDetector.ts TOKEN_PATTERN. */
const TOKEN_PATTERN = /\[INSERT_[A-Z_0-9]+\]/g;

/**
 * Synonym normalization: LLM-invented variants → canonical token.
 * Mirrors server/lib/placeholderResolver.ts TOKEN_SYNONYMS.
 */
const TOKEN_SYNONYMS: Record<string, string> = {
  "[INSERT_CART_CLOSE]":       "[INSERT_COHORT_CLOSE_DATE]",
  "[INSERT_NEXT_COHORT_DATE]": "[INSERT_COHORT_CLOSE_DATE]",
  "[INSERT_REMAINING_SPOTS]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_SPOTS_REMAINING]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_AVAILABLE_SPOTS]":  "[INSERT_COHORT_LIMIT]",
  "[INSERT_SUPPORT_EMAIL]":    "[INSERT_CONTACT_EMAIL]",
  "[INSERT_REFUND_EMAIL]":     "[INSERT_CONTACT_EMAIL]",
  "[INSERT_BOOKING_LINK]":     "[INSERT_BOOKING_URL]",
  "[INSERT_START_DATE]":       "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_NEXT_LAUNCH_DATE]": "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_NEXT_OPEN_DATE]":   "[INSERT_PROGRAMME_START_DATE]",
  "[INSERT_LAUNCH_DATE]":      "[INSERT_DEADLINE]",
};

function normalizeToken(token: string): string {
  return TOKEN_SYNONYMS[token] ?? token;
}

/**
 * Substitute [INSERT_*] tokens in text using the resolved map.
 * Normalizes through the synonym map before lookup. Tokens with no registry
 * value are left intact. A nullish/empty map is a no-op.
 */
export function resolveTokensInText(
  text: string,
  resolvedMap: Record<string, string> | undefined | null,
): string {
  if (!resolvedMap || !text || typeof text !== "string") return text;
  return text.replace(TOKEN_PATTERN, (match) => {
    const canonical = normalizeToken(match);
    const value = resolvedMap[canonical] ?? resolvedMap[match];
    return value !== undefined && value !== "" ? value : match;
  });
}

/**
 * Recursively substitute tokens in every string leaf of an object/array.
 * Non-string leaves pass through untouched. Returns a new structure; the input
 * is not mutated. A nullish/empty map returns the input unchanged (no clone).
 */
export function resolveTokensInObject<T>(
  value: T,
  resolvedMap: Record<string, string> | undefined | null,
): T {
  if (!resolvedMap) return value;
  if (typeof value === "string") {
    return resolveTokensInText(value, resolvedMap) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveTokensInObject(item, resolvedMap)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveTokensInObject(v, resolvedMap);
    }
    return out as unknown as T;
  }
  return value;
}
