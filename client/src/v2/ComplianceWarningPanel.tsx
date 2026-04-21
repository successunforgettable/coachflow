/**
 * ComplianceWarningPanel — W5 Phase 1 (Headlines).
 *
 * Replaces the passive "N issues" badge with an active rewrite pipeline:
 * shows violation reasons and the pre-computed compliant rewrite, lets
 * the user Accept, Dismiss, or request more alternatives.
 *
 * Rendering responsibility is split with the parent (V2HeadlinesResultPanel):
 *   - Parent runs a single batched query for all rewrites in the set and
 *     decides *whether* this panel renders, based on per-row accepted /
 *     dismissed state.
 *   - This panel receives live rewrites + an initialMode. It owns only
 *     the expand / collapse UI and the Accept / Dismiss / See-more
 *     mutation calls; after each mutation it asks the parent to refetch
 *     (onRewritesChanged) so the batched query stays authoritative.
 *
 * Phase 1 only handles sourceTable='headlines'. Phases 2/3 pass 'adCopy'
 * / 'landingPages' through unchanged.
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

export type CardRewrite = {
  id: number;
  rewrittenText: string;
  complianceScore: number;
  violationReasons: unknown;
  userAccepted: boolean;
  userDismissed: boolean;
};

interface Props {
  sourceTable: "headlines" | "adCopy" | "landingPages";
  sourceId: number;
  originalText: string;
  /** Override — if non-empty, shown as the violation bullets. Otherwise
   *  the panel falls back to the cached rewrite row's violationReasons. */
  violations: string[];
  /** Live (not accepted, not dismissed) rewrites for this source row. */
  liveRewrites: CardRewrite[];
  /** Rewrites the user has already dismissed — shown read-only in the
   *  dismissed-mode expanded view. */
  dismissedRewrites: CardRewrite[];
  /** "dismissed" → amber collapsed + read-only expanded; "active" → red
   *  collapsed + full action set. Chosen by the parent based on whether
   *  any rewrite for this row is marked dismissed (and none accepted). */
  initialMode: "active" | "dismissed";
  onAccept: (newText: string) => void;
  onDismiss: () => void;
  onGeneratedMore: () => void;
}

export default function ComplianceWarningPanel({
  sourceTable,
  sourceId,
  originalText,
  violations,
  liveRewrites,
  dismissedRewrites,
  initialMode,
  onAccept,
  onDismiss,
  onGeneratedMore,
}: Props) {
  const [expanded, setExpanded]       = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const generateMore = trpc.complianceRewrites.generateMore.useMutation();
  const acceptMut    = trpc.complianceRewrites.accept.useMutation();
  const dismissMut   = trpc.complianceRewrites.dismiss.useMutation();
  const undismissMut = trpc.complianceRewrites.undismiss.useMutation();

  const activeRewrite    = liveRewrites[activeIndex] ?? liveRewrites[0] ?? null;
  const alternativeCount = liveRewrites.length;
  const busy = generateMore.isPending || acceptMut.isPending || dismissMut.isPending;

  // Resolve the violation list for display: prop first, fall back to the
  // first available cached rewrite's violationReasons JSON.
  const displayViolations: string[] = (() => {
    if (violations.length > 0) return violations;
    const any = [...liveRewrites, ...dismissedRewrites][0];
    if (any && Array.isArray(any.violationReasons)) return any.violationReasons as string[];
    return [];
  })();
  // Real issue count — trust the list. Panel only renders when the parent
  // has already established complianceScore < 70, so the list shouldn't be
  // empty in practice; if it is we fall through to "issue(s)" without a
  // count on the badge.
  const issueCount = displayViolations.length;

  // ── Dismissed state ──────────────────────────────────────────────────
  // Amber badge; clicking expands to a read-only recap (no action buttons).
  if (initialMode === "dismissed") {
    if (!expanded) {
      return (
        <button
          onClick={() => setExpanded(true)}
          style={{
            ...badgeStyle("#92400E", "rgba(255,165,0,0.12)", "rgba(255,165,0,0.40)"),
            cursor: "pointer",
          }}
          title="Warning dismissed — click to review"
        >
          ⚠ Warning dismissed — click to review
        </button>
      );
    }
    // Pick the most recently-dismissed rewrite as the candidate to undismiss.
    // dismissedRewrites comes from the parent's batched query, ordered desc
    // by createdAt — first element is newest.
    const undismissTarget = dismissedRewrites[0] ?? null;

    async function handleReconsider() {
      if (!undismissTarget) return;
      try {
        setErrorMsg(null);
        await undismissMut.mutateAsync({ rewriteId: undismissTarget.id });
        // Parent refetches; if no dismissed rows remain and none accepted,
        // the card re-renders in active red-badge state.
        onGeneratedMore();
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Couldn't reconsider — try again");
      }
    }

    return (
      <div style={dismissedPanelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "13px", color: "#92400E" }}>
            Warning dismissed
          </span>
          <button onClick={() => setExpanded(false)} style={closeButtonStyle} title="Collapse">✕</button>
        </div>
        {displayViolations.length > 0 && (
          <div>
            <div style={labelStyle}>Original compliance issues</div>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
              {displayViolations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        )}
        <div>
          <div style={labelStyle}>Kept headline</div>
          <div style={{ fontSize: "13px", color: T.dark, fontStyle: "italic" }}>{originalText}</div>
        </div>
        {errorMsg && (
          <div role="alert" style={{ fontSize: "12px", color: "#991B1B", background: "rgba(220,38,38,0.08)", borderRadius: "8px", padding: "6px 10px" }}>
            {errorMsg}
          </div>
        )}
        {/* Reconsider — flips the most recent dismissed rewrite back to
            live, causing the parent to re-render the card in active
            red-badge state after batched refetch. */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleReconsider}
            disabled={undismissMut.isPending || !undismissTarget}
            style={pillButton("transparent", T.dark, undismissMut.isPending || !undismissTarget, `2px solid ${T.dark}`)}
            title="Reconsider the warning and see the suggested rewrites again"
          >
            {undismissMut.isPending ? "Reconsidering…" : "Reconsider"}
          </button>
        </div>
      </div>
    );
  }

  // ── Active collapsed badge ──────────────────────────────────────────
  if (!expanded) {
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
        ⚠ {issueCount > 0 ? `${issueCount} issue${issueCount > 1 ? "s" : ""}` : "issue"} — click to fix
      </button>
    );
  }

  async function handleAccept() {
    if (!activeRewrite) return;
    try {
      setErrorMsg(null);
      const res = await acceptMut.mutateAsync({ rewriteId: activeRewrite.id });
      onAccept(res.rewrittenText);
      // Parent's batched query refetches; parent decides to stop rendering
      // this panel because anyAccepted flips to true.
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Accept failed — try again");
    }
  }

  async function handleDismiss() {
    if (!activeRewrite) {
      // No server rewrite to mark — just hide locally for this render.
      onDismiss();
      return;
    }
    try {
      setErrorMsg(null);
      await dismissMut.mutateAsync({ rewriteId: activeRewrite.id });
      onDismiss();
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
      onGeneratedMore();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn't generate more alternatives");
    }
  }

  // ── Active expanded state ───────────────────────────────────────────
  return (
    <div style={activePanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#991B1B" }}>
          Compliance issues detected
        </span>
        <button onClick={() => setExpanded(false)} style={closeButtonStyle} title="Collapse">✕</button>
      </div>

      {displayViolations.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
          {displayViolations.map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      )}

      <div>
        <div style={labelStyle}>Original (flagged)</div>
        <div style={{ fontSize: "13px", color: T.dark, fontStyle: "italic" }}>{originalText}</div>
      </div>

      {activeRewrite ? (
        <div>
          <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
            <span>Suggested compliant version{alternativeCount > 1 ? ` (${activeIndex + 1} of ${alternativeCount})` : ""}</span>
            {alternativeCount > 1 && (
              <span style={{ display: "inline-flex", gap: "4px" }}>
                <button onClick={() => setActiveIndex(i => Math.max(0, i - 1))} disabled={activeIndex === 0} style={chevronStyle(activeIndex === 0)} title="Previous alternative">‹</button>
                <button onClick={() => setActiveIndex(i => Math.min(alternativeCount - 1, i + 1))} disabled={activeIndex >= alternativeCount - 1} style={chevronStyle(activeIndex >= alternativeCount - 1)} title="Next alternative">›</button>
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

const activePanelStyle: React.CSSProperties = {
  marginTop: "10px",
  background: T.bg,
  borderRadius: "14px",
  border: "1.5px solid rgba(220,38,38,0.25)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  fontFamily: T.fontBody,
};

const dismissedPanelStyle: React.CSSProperties = {
  marginTop: "10px",
  background: T.bg,
  borderRadius: "14px",
  border: "1.5px solid rgba(255,165,0,0.35)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  fontFamily: T.fontBody,
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#999",
  marginBottom: "4px",
};

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#888",
  cursor: "pointer",
  fontSize: "12px",
};

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
