/**
 * ComplianceWarningPanel — W5 Phase 1 (Headlines).
 *
 * Replaces the passive "1 issue" badge on flagged content with an active
 * pipeline: the panel shows the specific violation reasons and surfaces
 * the pre-computed compliant rewrite, letting the user Accept, Dismiss,
 * or request two more alternatives.
 *
 * Gated at render sites on ENABLE_COMPLIANCE_REWRITES (env flag on the
 * server; the client infers it by whether trpc.complianceRewrites.getForItem
 * returns any rows — if the flag is off, pre-compute never ran, so the
 * query is empty and the caller can render nothing new).
 *
 * Phase 1 only uses sourceTable='headlines'. Phases 2/3 will pass
 * 'adCopy' / 'landingPages' through the same component unchanged.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";

const T = {
  orange:    "#FF5B1D",
  purple:    "#8B5CF6",
  bg:        "#F5F1EA",
  dark:      "#1A1624",
  pill:      "9999px",
  fontBody:  "Instrument Sans, sans-serif",
  fontHead:  "Fraunces, serif",
};

interface Props {
  sourceTable: "headlines" | "adCopy" | "landingPages";
  sourceId: number;
  originalText: string;
  // Plain-English violation reasons, typically from complianceChecker's
  // ComplianceIssue[].reason. Used only when the server has rewrites cached;
  // the server's violationReasons JSON is the source of truth at render time.
  violations: string[];
  onAccept: (newText: string) => void;
  onDismiss: () => void;
}

type LocalStatus = "idle" | "accepted" | "dismissed";

export default function ComplianceWarningPanel({
  sourceTable,
  sourceId,
  originalText,
  violations,
  onAccept,
  onDismiss,
}: Props) {
  const [expanded, setExpanded]       = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [localStatus, setLocalStatus] = useState<LocalStatus>("idle");
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const { data: rewrites = [], refetch } = trpc.complianceRewrites.getForItem.useQuery(
    { sourceTable, sourceId },
    { staleTime: 30_000 },
  );

  const generateMore = trpc.complianceRewrites.generateMore.useMutation();
  const acceptMut    = trpc.complianceRewrites.accept.useMutation();
  const dismissMut   = trpc.complianceRewrites.dismiss.useMutation();

  // The "currently shown" rewrite — cache-ordered desc by createdAt, so
  // index 0 is the newest. If the server pre-computed one rewrite at
  // generation time, this is it.
  const activeRewrite   = rewrites[activeIndex] ?? rewrites[0] ?? null;
  const alternativeCount = rewrites.length;
  const busy = generateMore.isPending || acceptMut.isPending || dismissMut.isPending;

  // ── Post-decision states ─────────────────────────────────────────────
  if (localStatus === "accepted") {
    return (
      <div style={badgeStyle("#2E7D00", "rgba(88,204,2,0.12)", "rgba(88,204,2,0.40)")}>
        ✓ Compliance-fixed
      </div>
    );
  }
  if (localStatus === "dismissed") {
    return (
      <div style={badgeStyle("#92400E", "rgba(255,165,0,0.12)", "rgba(255,165,0,0.40)")}>
        ⚠ Warning dismissed
      </div>
    );
  }

  // ── Collapsed badge ──────────────────────────────────────────────────
  if (!expanded) {
    const issueCount = Math.max(violations.length, 1);
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          ...badgeStyle("#991B1B", "rgba(220,38,38,0.10)", "rgba(220,38,38,0.35)"),
          cursor: "pointer",
          border: "1px solid rgba(220,38,38,0.35)",
        }}
        title="Open compliance rewrite suggestions"
      >
        ⚠ {issueCount} issue{issueCount > 1 ? "s" : ""} — click to fix
      </button>
    );
  }

  async function handleAccept() {
    if (!activeRewrite) return;
    try {
      setErrorMsg(null);
      const res = await acceptMut.mutateAsync({ rewriteId: activeRewrite.id });
      onAccept(res.rewrittenText);
      setLocalStatus("accepted");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Accept failed — try again");
    }
  }

  async function handleDismiss() {
    if (!activeRewrite) {
      // No rewrite to dismiss at the row level; just hide the panel locally.
      onDismiss();
      setLocalStatus("dismissed");
      return;
    }
    try {
      setErrorMsg(null);
      await dismissMut.mutateAsync({ rewriteId: activeRewrite.id });
      onDismiss();
      setLocalStatus("dismissed");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Dismiss failed — try again");
    }
  }

  async function handleGenerateMore() {
    try {
      setErrorMsg(null);
      // Ask for 2 more than current count so we always expand the choice set.
      await generateMore.mutateAsync({
        sourceTable: "headlines",
        sourceId,
        count: Math.max(alternativeCount + 2, 3),
      });
      await refetch();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't generate more alternatives");
    }
  }

  // ── Expanded state ───────────────────────────────────────────────────
  return (
    <div style={{
      marginTop: "10px",
      background: T.bg,
      borderRadius: "14px",
      border: "1.5px solid rgba(220,38,38,0.25)",
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontFamily: T.fontBody,
    }}>
      {/* Header + collapse */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#991B1B" }}>
          Compliance issues detected
        </span>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "12px" }}
          title="Collapse"
        >
          ✕
        </button>
      </div>

      {/* Plain-English violations — prop first, fall back to the cached
          rewrite row's violationReasons JSON (populated at generate time). */}
      {(() => {
        const fromCache = Array.isArray(activeRewrite?.violationReasons)
          ? (activeRewrite?.violationReasons as string[])
          : [];
        const shown = violations.length > 0 ? violations : fromCache;
        if (shown.length === 0) return null;
        return (
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
            {shown.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        );
      })()}

      {/* Original */}
      <div>
        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: "4px" }}>
          Original (flagged)
        </div>
        <div style={{ fontSize: "13px", color: T.dark, fontStyle: "italic" }}>
          {originalText}
        </div>
      </div>

      {/* Suggested rewrite or empty state */}
      {activeRewrite ? (
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
            <span>Suggested compliant version{alternativeCount > 1 ? ` (${activeIndex + 1} of ${alternativeCount})` : ""}</span>
            {alternativeCount > 1 && (
              <span style={{ display: "inline-flex", gap: "4px" }}>
                <button
                  onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                  disabled={activeIndex === 0}
                  style={chevronStyle(activeIndex === 0)}
                  title="Previous alternative"
                >‹</button>
                <button
                  onClick={() => setActiveIndex(i => Math.min(alternativeCount - 1, i + 1))}
                  disabled={activeIndex >= alternativeCount - 1}
                  style={chevronStyle(activeIndex >= alternativeCount - 1)}
                  title="Next alternative"
                >›</button>
              </span>
            )}
          </div>
          <div style={{ fontSize: "14px", color: T.dark, fontWeight: 500, lineHeight: 1.4 }}>
            {activeRewrite.rewrittenText}
          </div>
          <div style={{ fontSize: "11px", color: "#2E7D00", marginTop: "4px" }}>
            Compliance score: {activeRewrite.complianceScore}/100
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: "#888", fontStyle: "italic" }}>
          No rewrite generated yet. Click "See 2 more alternatives" to request one.
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ fontSize: "12px", color: "#991B1B", background: "rgba(220,38,38,0.08)", borderRadius: "8px", padding: "6px 10px" }}>
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={handleAccept}
          disabled={busy || !activeRewrite}
          style={pillButton(T.orange, "#fff", busy || !activeRewrite)}
          title="Replace the original with the suggested rewrite"
        >
          {acceptMut.isPending ? "Applying…" : "Accept rewrite"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={busy}
          style={pillButton("transparent", T.dark, busy, `2px solid ${T.dark}`)}
          title="Keep the original, dismiss the warning"
        >
          Keep original
        </button>
        <button
          onClick={handleGenerateMore}
          disabled={busy}
          style={ghostButton(busy)}
          title="Generate two additional compliant alternatives"
        >
          {generateMore.isPending ? "Generating…" : "See 2 more alternatives"}
        </button>
      </div>
    </div>
  );
}

// ── Style helpers ────────────────────────────────────────────────────
function badgeStyle(color: string, bg: string, border: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "9999px",
    padding: "4px 12px",
    fontSize: "11px",
    fontFamily: T.fontBody,
    fontWeight: 600,
    color,
    letterSpacing: "0.02em",
    marginTop: "6px",
  };
}

function pillButton(bg: string, fg: string, disabled: boolean, border = "none"): React.CSSProperties {
  return {
    background: bg,
    color: fg,
    border,
    borderRadius: T.pill,
    padding: "8px 16px",
    fontFamily: T.fontBody,
    fontWeight: 700,
    fontSize: "12px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "opacity 0.15s",
  };
}

function ghostButton(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: "#666",
    border: "1px dashed rgba(26,22,36,0.2)",
    borderRadius: T.pill,
    padding: "8px 14px",
    fontFamily: T.fontBody,
    fontWeight: 600,
    fontSize: "12px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function chevronStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid rgba(26,22,36,0.15)",
    borderRadius: "6px",
    padding: "0 6px",
    fontFamily: T.fontBody,
    fontSize: "12px",
    color: disabled ? "#bbb" : T.dark,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
