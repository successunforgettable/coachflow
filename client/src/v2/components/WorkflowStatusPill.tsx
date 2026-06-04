/**
 * WorkflowStatusPill — shared GHL snapshot status indicator.
 *
 * Pure presentational component. Three-state pill:
 *   green  (ok)      — count >= 75% of total (snapshot active)
 *   amber  (partial) — count > 0 but < 75% (incomplete install)
 *   red    (missing) — count === 0 (snapshot not applied)
 *
 * Extracted from V2Settings.tsx (commit 1dfd804) for reuse across
 * Settings, PushKitModal pre-push, and Node 11 wizard completion.
 */

export function WorkflowStatusPill({ count, total }: { count: number; total: number }) {
  const installed = count >= Math.ceil(total * 0.75);
  const partial = count > 0 && !installed;
  const tone = installed ? "ok" : partial ? "partial" : "missing";
  const palette = {
    ok:      { bg: "rgba(88,204,2,0.14)",  fg: "#2E7D00" },
    partial: { bg: "rgba(255,180,0,0.18)", fg: "#A06200" },
    missing: { bg: "rgba(220,38,38,0.14)", fg: "#B12121" },
  }[tone];
  const label = installed
    ? `Snapshot active — ${count}/${total} workflows`
    : partial
    ? `Incomplete install — ${count}/${total} workflows`
    : "Snapshot not applied";
  return (
    <span style={{
      display: "inline-block",
      padding: "5px 12px",
      borderRadius: 9999,
      background: palette.bg,
      color: palette.fg,
      fontSize: 12,
      fontWeight: 700,
      fontFamily: "'Instrument Sans', 'Inter', system-ui, sans-serif",
    }}>{installed ? "\u2713" : partial ? "\u26A0" : "\u2717"} {label}</span>
  );
}
