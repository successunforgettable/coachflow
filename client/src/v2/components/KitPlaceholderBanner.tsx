/**
 * KitPlaceholderBanner — Phase D Sprint 3
 *
 * Kit-level aggregator that surfaces operator-fill placeholders across ALL
 * assets in a kit (offer + LP + email + WhatsApp + headlines + ad copy +
 * lead magnet + hero mechanism + ad creatives). Distinct from
 * `components/PlaceholderBanner.tsx` which is panel-level (one data blob,
 * one panel render).
 *
 * Use sites:
 *   - V2CampaignKit (kit page) — shows full banner with per-asset breakdown
 *   - PushKitModal — uses count + tokens for a smaller warning section
 *
 * Self-hides when report.total === 0. Warning state (orange tint), not
 * "error panic" — placeholders are intentional Phase D Sprint 1+2 emissions,
 * not generator failures. The CTA routes users to review/edit before pushing
 * to live channels.
 *
 * See:
 *   - client/src/v2/lib/placeholderDetector.ts — detection logic
 *   - docs/redteam-audit-baseline-v2.md §7 — Phase 1+2 emit 354+ canonical
 *     placeholders per kit; this banner is the surface that makes them
 *     actionable for non-technical users
 */
import type { PlaceholderReport } from "../lib/placeholderDetector";

type Props = {
  report: PlaceholderReport;
  onReviewClick?: () => void;
  /** Compact mode for embedding inside push modal — no Review CTA, smaller. */
  compact?: boolean;
};

export default function KitPlaceholderBanner({ report, onReviewClick, compact = false }: Props) {
  if (report.total === 0) return null;

  const assetEntries = Object.entries(report.byAsset).sort(([, a], [, b]) => b - a);
  const exampleTokens = report.uniqueTokens.slice(0, 3);

  if (compact) {
    // Compact: single line + count + asset list. Used inside PushKitModal so it
    // doesn't dominate the modal vertical space.
    return (
      <div role="region" aria-label="Placeholders need review" style={{
        background: "rgba(255, 91, 29, 0.08)",
        border: "1px solid rgba(255, 91, 29, 0.28)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
      }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#A06200",
          margin: "0 0 4px",
        }}>
          ⚠ {report.total} placeholder{report.total === 1 ? "" : "s"} across {assetEntries.length} asset{assetEntries.length === 1 ? "" : "s"} still need your input
        </p>
        <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.5 }}>
          Pushing now will deliver placeholders like <code style={{ background: "#F5F1EA", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>{exampleTokens[0] ?? "[INSERT_PRICE]"}</code> to your audience verbatim. Recommended: cancel, edit on the kit page, push again.
        </p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Placeholders need review" style={{
      background: "#FFF8F0",
      border: "1px solid rgba(255, 91, 29, 0.35)",
      borderRadius: 16,
      padding: "18px 22px",
      marginBottom: 24,
      fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
    }}>
      <p style={{
        fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
        fontStyle: "italic",
        fontWeight: 800,
        fontSize: 20,
        color: "var(--v2-text-dark, #1A1624)",
        margin: "0 0 8px",
        lineHeight: 1.25,
      }}>
        Some content still needs your details before publishing
      </p>
      <p style={{ fontSize: 14, color: "#555", margin: "0 0 14px", lineHeight: 1.55 }}>
        ZAP generated <strong>{report.total} placeholder{report.total === 1 ? "" : "s"}</strong> {exampleTokens.length > 0 && <>(like {exampleTokens.map((token, i) => (<span key={i}>{i > 0 && ", "}<code style={{ background: "#F5F1EA", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>{token}</code></span>))}) </>}
        across <strong>{assetEntries.length} asset{assetEntries.length === 1 ? "" : "s"}</strong>. These are intentional — ZAP does not invent your pricing, guarantee terms, cohort dates, or programme duration. Fill them in before pushing to Meta, GHL, or sending to leads.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {assetEntries.map(([asset, count]) => (
          <span key={asset} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 9999,
            background: "rgba(255, 91, 29, 0.12)",
            color: "#A06200",
            fontSize: 12,
            fontWeight: 700,
            border: "1px solid rgba(255, 91, 29, 0.18)",
          }}>
            {asset}
            <span style={{
              background: "rgba(255, 91, 29, 0.24)",
              borderRadius: 9999,
              padding: "1px 8px",
              fontWeight: 800,
              fontSize: 11,
            }}>{count}</span>
          </span>
        ))}
      </div>
      {onReviewClick && (
        <button
          onClick={onReviewClick}
          style={{
            padding: "10px 22px",
            borderRadius: 9999,
            border: "none",
            background: "var(--v2-primary-btn, #FF5B1D)",
            color: "#fff",
            fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >Review & Complete →</button>
      )}
    </div>
  );
}
