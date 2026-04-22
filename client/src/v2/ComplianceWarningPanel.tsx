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
  /** Sub-type of the source row's text — drives the dismissed-mode KEPT
   *  label ("KEPT HEADLINE" / "KEPT BODY" / "KEPT LINK"). Node 6 always
   *  passes "headline"; Node 7 passes the per-row item.contentType. If
   *  omitted the panel falls back to "KEPT ORIGINAL". */
  contentType?: "headline" | "body" | "link";
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
  contentType,
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
  // Free-tier cap sentinel — true when the last generateMore caught a
  // FORBIDDEN error whose message matches the cap string. Surfaces a
  // dedicated amber "upgrade now" block instead of the raw error text.
  const [capError, setCapError]       = useState(false);

  const generateMore = trpc.complianceRewrites.generateMore.useMutation();
  const acceptMut    = trpc.complianceRewrites.accept.useMutation();
  const dismissMut   = trpc.complianceRewrites.dismiss.useMutation();
  const undismissMut = trpc.complianceRewrites.undismiss.useMutation();

  const activeRewrite    = liveRewrites[activeIndex] ?? liveRewrites[0] ?? null;
  const alternativeCount = liveRewrites.length;
  const busy = generateMore.isPending || acceptMut.isPending || dismissMut.isPending;

  // "Kept" label for the dismissed-mode section showing the original text.
  // Node 6 always passes contentType="headline"; Node 7 passes the per-row
  // value (headline/body/link). Fallback covers the optional-prop omission
  // case (e.g., future callers that don't wire it).
  const keptLabel = (() => {
    if (contentType === "body") return "Kept body";
    if (contentType === "link") return "Kept link";
    if (contentType === "headline") return "Kept headline";
    // Fallback inference: if the caller is the Node 6 headlines panel,
    // treat as headline. Otherwise "Kept original".
    if (sourceTable === "headlines") return "Kept headline";
    return "Kept original";
  })();

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
    // Dismissal is a property of the warning on a headline, not of each
    // individual rewrite — Reconsider restores the pre-dismissal state of
    // the entire headline, flipping every currently-dismissed rewrite
    // back to live in one call.
    const hasDismissedRewrites = dismissedRewrites.length > 0;

    async function handleReconsider() {
      if (!hasDismissedRewrites) return;
      try {
        setErrorMsg(null);
        setCapError(false);
        await undismissMut.mutateAsync({ sourceTable, sourceId });
        // Parent refetches; with no dismissed rows remaining and none
        // accepted, the card re-renders in active red-badge state.
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
          {/* Label reflects the actual sub-type of the kept text so adCopy
              body and link cards don't mis-label as "Kept headline". */}
          <div style={labelStyle}>{keptLabel}</div>
          <div style={{ fontSize: "13px", color: T.dark, fontStyle: "italic" }}>{originalText}</div>
        </div>
        {errorMsg && (
          <div role="alert" style={{ fontSize: "12px", color: "#991B1B", background: "rgba(220,38,38,0.08)", borderRadius: "8px", padding: "6px 10px" }}>
            {errorMsg}
          </div>
        )}
        {/* Reconsider — flips every currently-dismissed rewrite for this
            headline back to live, causing the parent to re-render the
            card in active red-badge state after batched refetch. */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleReconsider}
            disabled={undismissMut.isPending || !hasDismissedRewrites}
            style={pillButton("transparent", T.dark, undismissMut.isPending || !hasDismissedRewrites, `2px solid ${T.dark}`)}
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
      setCapError(false);
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
      setCapError(false);
      await dismissMut.mutateAsync({ rewriteId: activeRewrite.id });
      onDismiss();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Dismiss failed — try again");
    }
  }

  async function handleGenerateMore() {
    try {
      setErrorMsg(null);
      setCapError(false);
      // Ask for 2 more than current count so we always expand the choice
      // set. Clamp to 5 (the server's Zod max) so an over-the-cap click
      // can't surface a raw Zod error — the button is also disabled past
      // the cap per the disabled-state wiring below, this is belt-and-
      // braces against future callers or UI drift.
      await generateMore.mutateAsync({
        sourceTable: sourceTable as "headlines" | "adCopy",
        sourceId,
        count: Math.min(Math.max(alternativeCount + 2, 3), 5),
      });
      onGeneratedMore();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't generate more alternatives";
      // Free-tier cap detection: the server throws TRPCError FORBIDDEN
      // with this specific sentence from enforceFreeTierRewriteCap. Lift
      // to the dedicated upgrade CTA instead of showing raw error text.
      if (err instanceof Error && err.message.includes("Free tier compliance rewrite limit reached")) {
        setCapError(true);
      } else {
        // Non-cap error — clear any stale amber cap block so the real
        // errorMsg isn't swallowed when a different error follows a cap hit.
        setCapError(false);
        setErrorMsg(msg);
      }
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

      {capError ? (
        <div
          role="alert"
          style={{
            background: "rgba(255,165,0,0.12)",
            border: "1px solid rgba(255,165,0,0.40)",
            borderRadius: "12px",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontFamily: T.fontBody, fontSize: "13px", fontWeight: 700, color: "#92400E" }}>
            Free tier limit reached
          </div>
          <div style={{ fontFamily: T.fontBody, fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
            Upgrade to Pro for unlimited compliance rewrites across all your campaigns.
          </div>
          <a
            href="/pricing?utm_source=app&utm_medium=quota_gate&utm_campaign=compliance-rewrite"
            style={{
              alignSelf: "flex-start",
              display: "inline-block",
              background: T.orange,
              color: "#fff",
              borderRadius: T.pill,
              padding: "8px 16px",
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: "12px",
              textDecoration: "none",
              marginTop: "2px",
            }}
          >
            Upgrade now
          </a>
        </div>
      ) : errorMsg ? (
        <div role="alert" style={{ fontSize: "12px", color: "#991B1B", background: "rgba(220,38,38,0.08)", borderRadius: "8px", padding: "6px 10px" }}>
          {errorMsg}
        </div>
      ) : null}

      {(() => {
        // Disable See-more at the 5-rewrite cap per W5 Phase 2 R2 UX polish.
        // totalRewrites counts every rewrite that's been produced (live +
        // dismissed) so the user can't keep requesting more once the
        // effective ceiling is reached — matches the server's Zod max(5)
        // constraint on the `count` param.
        const totalRewrites   = liveRewrites.length + dismissedRewrites.length;
        const atCap           = totalRewrites >= 5;
        const seeMoreDisabled = busy || atCap;
        return (
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
              Keep original and dismiss warning
            </button>
            <button
              onClick={handleGenerateMore}
              disabled={seeMoreDisabled}
              style={ghostButton(seeMoreDisabled)}
              title={atCap ? "Maximum 5 alternatives reached for this row" : "Generate two additional compliant alternatives"}
            >
              {generateMore.isPending ? "Generating…" : atCap ? "Max alternatives reached" : "See 2 more alternatives"}
            </button>
          </div>
        );
      })()}
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
