/**
 * PlaceholderBanner — surfaces operator-fillable placeholders in generated copy.
 *
 * Today's date-fabrication ban (NO_DATE_FABRICATION_RULE, commit c7c6562) and
 * credential-fabrication ban (NO_CREDENTIAL_FABRICATION_RULE, commit 9346623)
 * direct the model to use bracketed [INSERT_*] tokens when it would otherwise
 * fabricate calendar dates or author credentials. Those tokens render raw in
 * the result panels — first paying users without context might not understand
 * they're meant to be replaced before publishing. This banner makes the
 * convention explicit: lists the unique tokens found, instructs the operator
 * to replace them.
 *
 * Detection-everywhere pattern: caller passes the panel's data object via the
 * `data` prop; component JSON-stringifies internally and regex-scans the whole
 * blob. This means new content fields, new tabs, or model-invented placeholder
 * names (e.g., the [INSERT_REMAINING_SPOTS] variant observed in production)
 * are picked up automatically without per-field enumeration.
 *
 * Self-hides when no placeholders found — placing this in a panel that
 * happens not to contain any [INSERT_*] tokens is a no-op render.
 */
import { useMemo } from "react";

interface Props {
  /**
   * Any data structure containing the result content. Component JSON-stringifies
   * and regex-scans for [INSERT_*] tokens. Pass the parent's full data object;
   * undefined/null/empty/circular all handled gracefully (banner self-hides).
   */
  data: unknown;
}

const PLACEHOLDER_RE = /\[INSERT_[A-Z][A-Z0-9_]*\]/g;

export default function PlaceholderBanner({ data }: Props) {
  const placeholders = useMemo(() => {
    if (data === undefined || data === null) return [];
    let text: string;
    try {
      text = JSON.stringify(data);
    } catch {
      // Circular reference or other JSON errors — fail closed (no banner).
      return [];
    }
    if (!text) return [];
    const matches = text.match(PLACEHOLDER_RE) || [];
    return Array.from(new Set(matches)).sort();
  }, [data]);

  if (placeholders.length === 0) return null;

  return (
    <div
      style={{
        background: "rgba(255, 91, 29, 0.08)",
        border: "1px solid rgba(255, 91, 29, 0.30)",
        borderRadius: "12px",
        padding: "14px 18px",
        marginBottom: "16px",
        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
        fontSize: "13px",
        color: "#1A1624",
        lineHeight: 1.55,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
        📝 This output contains {placeholders.length} operator placeholder
        {placeholders.length === 1 ? "" : "s"}:
      </p>
      <p
        style={{
          margin: "0 0 6px",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: "12px",
          color: "rgba(255, 91, 29, 0.95)",
          wordBreak: "break-all",
        }}
      >
        {placeholders.join("  ")}
      </p>
      <p style={{ margin: 0, color: "rgba(26, 22, 36, 0.65)" }}>
        Replace these with your details before publishing.
      </p>
    </div>
  );
}
