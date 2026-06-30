/**
 * Placeholder resolver — shared substitution authority.
 *
 * Single source of truth for turning [INSERT_*] tokens into their filled
 * registry values. Used at every point where campaign text leaves the system
 * to an external API (Meta ad creatives, GHL custom values). In-browser
 * render + download use the mirrored client resolver (client/src/v2/lib/resolveTokens.ts).
 *
 * Two-level registry precedence (campaign override > account default > absent)
 * lives in buildResolvedMap; resolveTokensInText/resolveTokensInObject apply it.
 */
import { getDb } from "../db";
import { placeholderValues } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export type ResolvedEntry = {
  token: string;
  value: string;
  source: "campaign" | "default";
};

/**
 * Build the resolved map for a given user + service.
 * Precedence: campaign-specific (serviceId = N) > account default (serviceId IS NULL) > absent.
 */
export async function buildResolvedMap(
  userId: number,
  serviceId: number,
): Promise<Map<string, ResolvedEntry>> {
  const db = await getDb();
  if (!db) return new Map();

  const rows = await db
    .select()
    .from(placeholderValues)
    .where(
      and(
        eq(placeholderValues.userId, userId),
        // Drizzle doesn't have OR for nullable, so fetch all for user and filter in-app
      ),
    );

  // Filter to relevant rows: account defaults + this campaign
  const relevant = rows.filter(
    (r) => r.serviceId === null || r.serviceId === serviceId,
  );

  const map = new Map<string, ResolvedEntry>();

  // Pass 1: account defaults
  for (const row of relevant) {
    if (row.serviceId === null) {
      map.set(row.token, { token: row.token, value: row.value, source: "default" });
    }
  }

  // Pass 2: campaign-specific overrides
  for (const row of relevant) {
    if (row.serviceId === serviceId) {
      map.set(row.token, { token: row.token, value: row.value, source: "campaign" });
    }
  }

  return map;
}

/**
 * Synonym normalization map: LLM-invented variants → canonical token.
 * Applied at resolution time so the registry keys on canonical names
 * regardless of which variant the LLM emitted. Fixes existing campaigns
 * at runtime with no DB migration.
 */
export const TOKEN_SYNONYMS: Record<string, string> = {
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

/** Normalize a token through the synonym map. */
export function normalizeToken(token: string): string {
  return TOKEN_SYNONYMS[token] ?? token;
}

/**
 * Substitute [INSERT_*] tokens in text using the resolved map.
 * Normalizes through synonym map before lookup so registry values
 * resolve regardless of which token variant the LLM emitted.
 * Tokens with no registry value are left intact.
 */
export function resolveTokensInText(
  text: string,
  resolvedMap: Map<string, ResolvedEntry>,
): string {
  return text.replace(/\[INSERT_[A-Z][A-Z0-9_]*\]/g, (match) => {
    const canonical = normalizeToken(match);
    const entry = resolvedMap.get(canonical) ?? resolvedMap.get(match);
    return entry ? entry.value : match;
  });
}

/**
 * Recursively substitute tokens in every string leaf of an object/array.
 * Walks nested JSON (objects, arrays, primitives) and applies resolveTokensInText
 * to each string. Non-string leaves (numbers, booleans, null) pass through
 * untouched. Returns a new structure; the input is not mutated.
 *
 * Used at export points where asset bodies are nested JSON (e.g. landing-page
 * angle blobs, email-sequence arrays) rather than flat strings.
 */
export function resolveTokensInObject<T>(
  value: T,
  resolvedMap: Map<string, ResolvedEntry>,
): T {
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
