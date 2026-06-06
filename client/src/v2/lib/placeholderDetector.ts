/**
 * Placeholder Detector — Phase D Sprint 3
 *
 * Scans a kit's generated assets for `[INSERT_X]` operator-fill placeholders
 * emitted by the Phase D Sprint 1 + 2 architecture. These placeholders are
 * INTENTIONAL — ZAP's hardened generators emit them whenever operator-supplied
 * facts (price, guarantee terms, cohort dates, etc.) are absent from the
 * service / ICP / sourceOfTruth fixtures.
 *
 * The detector's job is to make these placeholders visible to non-technical
 * users via the PlaceholderBanner UX before they push to Meta / GHL or send
 * email sequences to live audiences.
 *
 * See:
 *   - docs/redteam-audit-baseline-v2.md §7 — 354 canonical emissions per kit
 *   - server/_core/validator.ts CANONICAL_PLACEHOLDER_TOKENS allow-list
 *   - PlaceholderBanner.tsx for the rendering surface
 */

export type PlaceholderFinding = {
  asset: string;          // Human-readable label (e.g. "Offer", "Landing Page")
  assetKey: string;       // Internal key for routing (e.g. "offer", "lp", "email")
  field: string;          // Dotted path within the asset (e.g. "godfatherAngle.pricing")
  placeholderToken: string; // The matched token, verbatim (e.g. "[INSERT_PRICE]")
  count: number;          // Occurrences of this exact token in this exact field
};

export type PlaceholderReport = {
  total: number;                              // Sum of all `count` across UNFILLED findings
  uniqueTokenCount: number;                   // Distinct UNFILLED token names
  uniqueTokens: string[];                     // Distinct UNFILLED token names (sorted)
  byAsset: Record<string, number>;            // Asset label → UNFILLED token occurrence count
  byToken: Record<string, number>;            // Token name → UNFILLED occurrence count
  findings: PlaceholderFinding[];             // Per-field findings (unfilled only)
  allUniqueTokens?: string[];                 // ALL tokens (filled + unfilled) — for editor
};

/**
 * Canonical placeholder regex. Matches any `[INSERT_X]` token with uppercase
 * letters, underscores, or digits inside the brackets. Matches the allow-list
 * shape enforced by validateOfferFabricationPatterns + the operator-fill
 * canonical tokens emitted by emailSequenceGenerator / landingPageGenerator.
 */
const TOKEN_PATTERN = /\[INSERT_[A-Z_0-9]+\]/g;

/**
 * Detect placeholder tokens in a single text body. Returns per-token count
 * aggregations. Pure function — no DOM, no I/O — suitable for unit tests.
 */
export function detectPlaceholdersInText(text: string): { token: string; count: number }[] {
  if (!text || typeof text !== "string") return [];
  const matches = text.match(TOKEN_PATTERN);
  if (!matches) return [];
  const counts: Record<string, number> = {};
  for (const m of matches) counts[m] = (counts[m] ?? 0) + 1;
  return Object.entries(counts).map(([token, count]) => ({ token, count }));
}

/**
 * Recursive walker — scans every string field in a possibly-nested object
 * for placeholder tokens. Used by the per-asset scanners below.
 *
 * - Strings: matched directly
 * - Arrays: recursed per item with index appended to path
 * - Objects: recursed per key with key appended to path
 * - Numbers / booleans / null / undefined: skipped
 */
function scanFields(
  assetKey: string,
  assetLabel: string,
  obj: unknown,
  prefix: string,
  out: PlaceholderFinding[],
): void {
  if (obj == null) return;
  if (typeof obj === "string") {
    for (const { token, count } of detectPlaceholdersInText(obj)) {
      out.push({ asset: assetLabel, assetKey, field: prefix, placeholderToken: token, count });
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => scanFields(assetKey, assetLabel, item, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      // Some asset blobs are stored as JSON strings inside outer wrappers; try parse.
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        try {
          const parsed = JSON.parse(value);
          scanFields(assetKey, assetLabel, parsed, nextPath, out);
          // Also scan the raw string in case the parsed walker missed something
          continue;
        } catch { /* fall through to string scan */ }
      }
      scanFields(assetKey, assetLabel, value, nextPath, out);
    }
  }
}

/**
 * Detect canonical operator-fill placeholders across all assets in a kit's
 * dependent data. Returns a structured report with aggregations + full
 * per-field findings for the PlaceholderBanner to render.
 *
 * `kitData` is shaped to match the existing trpc query result shapes used in
 * V2CampaignKit.tsx. Missing fields are tolerated — the detector skips any
 * asset that's not loaded yet.
 */
export function detectPlaceholders(kitData: {
  offer?: unknown;          // offers.get result (godfatherAngle / freeAngle / dollarAngle)
  lp?: unknown;             // landingPages.get result
  email?: unknown;          // emailSequences.get result
  whatsapp?: unknown;       // whatsappSequences.get result
  headlines?: unknown;
  adCopy?: unknown;
  hvco?: unknown;           // hvco.get result (lead magnet)
  heroMechanism?: unknown;
  adCreatives?: unknown;    // adCreatives.getBatch result
}, resolvedMap?: Record<string, string>): PlaceholderReport {
  const findings: PlaceholderFinding[] = [];

  if (kitData.offer) scanFields("offer", "Offer", kitData.offer, "", findings);
  if (kitData.lp) scanFields("lp", "Landing Page", kitData.lp, "", findings);
  if (kitData.email) scanFields("email", "Email Sequence", kitData.email, "", findings);
  if (kitData.whatsapp) scanFields("whatsapp", "WhatsApp Sequence", kitData.whatsapp, "", findings);
  if (kitData.headlines) scanFields("headlines", "Headlines", kitData.headlines, "", findings);
  if (kitData.adCopy) scanFields("adCopy", "Ad Copy", kitData.adCopy, "", findings);
  if (kitData.hvco) scanFields("leadMagnet", "Lead Magnet", kitData.hvco, "", findings);
  if (kitData.heroMechanism) scanFields("heroMechanism", "Hero Mechanism", kitData.heroMechanism, "", findings);
  if (kitData.adCreatives) scanFields("adCreatives", "Ad Creatives", kitData.adCreatives, "", findings);

  // If a resolvedMap is provided, subtract tokens that have a registry value.
  // These are "filled" — the token exists in the raw text but the user has
  // provided a value in the placeholder registry. The banner should count only
  // unfilled tokens so it self-hides when everything's filled.
  const unfilledFindings = resolvedMap
    ? findings.filter(f => !resolvedMap[f.placeholderToken])
    : findings;

  const total = unfilledFindings.reduce((sum, f) => sum + f.count, 0);
  const byAsset: Record<string, number> = {};
  const byToken: Record<string, number> = {};
  for (const f of unfilledFindings) {
    byAsset[f.asset] = (byAsset[f.asset] ?? 0) + f.count;
    byToken[f.placeholderToken] = (byToken[f.placeholderToken] ?? 0) + f.count;
  }
  const uniqueTokens = Object.keys(byToken).sort();

  // Also expose ALL tokens (including filled) for the editor to render
  const allTokens: Record<string, number> = {};
  for (const f of findings) {
    allTokens[f.placeholderToken] = (allTokens[f.placeholderToken] ?? 0) + f.count;
  }

  return {
    total,
    uniqueTokenCount: uniqueTokens.length,
    uniqueTokens,
    byAsset,
    byToken,
    findings: unfilledFindings,
    allUniqueTokens: Object.keys(allTokens).sort(),
  };
}

/** Convenience helper — used by PushKitModal to render a brief warning. */
export function summarizePlaceholders(report: PlaceholderReport): string {
  if (report.total === 0) return "";
  const assetCount = Object.keys(report.byAsset).length;
  return `${report.total} placeholder${report.total === 1 ? "" : "s"} across ${assetCount} asset${assetCount === 1 ? "" : "s"}`;
}
