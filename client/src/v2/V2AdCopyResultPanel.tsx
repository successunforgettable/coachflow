/**
 * V2AdCopyResultPanel — Node 7 Results Panel
 *
 * Displays the generated ad copy set in a 3-tab layout:
 *   Tab 1 — Headlines (contentType="headline"): flat list, copy/thumbs
 *   Tab 2 — Body Copy (contentType="body"): angle pill badge, copy/thumbs, compliance badge, Publish to Meta
 *   Tab 3 — Links (contentType="link"): flat list, copy/thumbs
 *
 * All rating controls are UI-state only (no backend calls).
 *
 * Props:
 *   adSetId    — nanoid from the job result
 *   serviceId  — numeric service ID (for getLatestByServiceId fallback)
 */
import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";
import ComplianceWarningPanel from "./ComplianceWarningPanel";
import { useFavourites } from "./hooks/useFavourites";
import ExportButtons from "./components/ExportButtons";
import { formatWhatsAppTxt, formatHeadlinesTxt, formatAdCopyTxt, formatOfferTxt, formatMechanismsTxt, formatHvcoTxt, formatIcpTxt, formatLandingPageTxt } from "./lib/exportUtils";
import V2AdImageCreator from "./V2AdImageCreator";
import V2VideoCreator from "./V2VideoCreator";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdTab = "headlines" | "body" | "links";

interface AdRow {
  id: number;
  contentType: "headline" | "body" | "link";
  bodyAngle: string | null;
  content: string;
  complianceScore: number | null;
  selectionScore?: string | null;
  rating: number;
  // W5 Phase 2 — plain-English violation reasons normalised server-side.
  violationReasons?: string[] | null;
}

// W5 Phase 2 — per-card rewrite shape passed from the parent's batched
// listForAdSet query down to each item component.
type CardRewrite = {
  id: number;
  rewrittenText: string;
  complianceScore: number;
  violationReasons: unknown;
  userAccepted: boolean;
  userDismissed: boolean;
};

// Shared 3-state render logic used by HeadlineItem / BodyItem / LinkItem.
// Mirrors the V2HeadlinesResultPanel flow:
//   - any accepted rewrite → don't render (score also updated, row is compliant)
//   - any dismissed + none accepted → amber "Warning dismissed" badge
//   - otherwise red "click to fix" badge
function renderCompliancePanelIfFlagged({
  complianceRewritesEnabled,
  item,
  content,
  rewritesForCard,
  onAccept,
  onRewritesChanged,
}: {
  complianceRewritesEnabled: boolean;
  item: AdRow;
  content: string;
  rewritesForCard: CardRewrite[];
  onAccept: (newText: string) => void;
  onRewritesChanged: () => void;
}) {
  if (!complianceRewritesEnabled) return null;
  if (item.complianceScore === null || item.complianceScore === undefined || item.complianceScore >= 70) return null;
  const anyAccepted = rewritesForCard.some(r => r.userAccepted);
  if (anyAccepted) return null;
  const anyDismissed  = rewritesForCard.some(r => r.userDismissed);
  const liveRewrites  = rewritesForCard.filter(r => !r.userAccepted && !r.userDismissed);
  const dismissed     = rewritesForCard.filter(r => r.userDismissed);
  return (
    <ComplianceWarningPanel
      sourceTable="adCopy"
      sourceId={item.id}
      originalText={content}
      violations={item.violationReasons ?? []}
      contentType={item.contentType}
      initialMode={anyDismissed ? "dismissed" : "active"}
      liveRewrites={liveRewrites}
      dismissedRewrites={dismissed}
      onAccept={onAccept}
      onDismiss={onRewritesChanged}
      onGeneratedMore={onRewritesChanged}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toTitleCase(snake: string): string {
  return snake
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Compliance badge ─────────────────────────────────────────────────────────
function ComplianceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const isGreen = score >= 90;
  const isAmber = score >= 70 && score < 90;
  const bg     = isGreen ? "rgba(88,204,2,0.12)"  : isAmber ? "rgba(255,165,0,0.12)"  : "rgba(220,38,38,0.12)";
  const border = isGreen ? "rgba(88,204,2,0.40)"  : isAmber ? "rgba(255,165,0,0.40)"  : "rgba(220,38,38,0.40)";
  const color  = isGreen ? "#2E7D00"              : isAmber ? "#92400E"               : "#991B1B";
  const label  = isGreen ? "Meta Compliant"       : isAmber ? "Review"                : "Flagged";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "9999px",
      padding: "3px 10px",
      fontSize: "11px",
      fontFamily: "var(--v2-font-body)",
      fontWeight: 600,
      color,
      letterSpacing: "0.02em",
    }}>
      <span style={{ fontSize: "10px" }}>{isGreen ? "✓" : isAmber ? "⚠" : "✗"}</span>
      {score}/100 — {label}
    </span>
  );
}

// ─── Score badge (W3 — hookRate) ──────────────────────────────────────────────
function ScoreBadge({ score }: { score?: string | null }) {
  if (score === null || score === undefined) return null;
  const n = parseFloat(score);
  if (isNaN(n)) return null;
  const isTop  = n >= 80;
  const isGood = n >= 60;
  const bg     = isTop  ? "rgba(139,92,246,0.12)" : isGood ? "rgba(88,204,2,0.12)"  : "rgba(26,22,36,0.06)";
  const border = isTop  ? "rgba(139,92,246,0.40)" : isGood ? "rgba(88,204,2,0.40)"  : "rgba(26,22,36,0.15)";
  const color  = isTop  ? "#5B21B6"               : isGood ? "#2E7D00"              : "#666";
  const label  = isTop  ? "⚡ Top Pick"            : isGood ? "✓ Strong"             : "~ Test";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "9999px",
      padding: "3px 10px",
      fontSize: "11px",
      fontFamily: "var(--v2-font-body)",
      fontWeight: 600,
      color,
      letterSpacing: "0.02em",
    }}>
      {label}
    </span>
  );
}

// ─── Angle pill badge ─────────────────────────────────────────────────────────
function AnglePill({ angle }: { angle: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      background: "rgba(139,92,246,0.10)",
      border: "1px solid rgba(139,92,246,0.30)",
      borderRadius: "9999px",
      padding: "3px 10px",
      fontSize: "11px",
      fontFamily: "var(--v2-font-body)",
      fontWeight: 600,
      color: "#6D28D9",
      letterSpacing: "0.02em",
    }}>
      {toTitleCase(angle)}
    </span>
  );
}

// ─── Icon button style ────────────────────────────────────────────────────────
const iconBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(26,22,36,0.12)",
  borderRadius: "9999px",
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: "15px",
  flexShrink: 0,
  transition: "background 0.15s",
};

// ─── Inline regen panel ──────────────────────────────────────────────────────
function RegenPanel({
  itemId,
  onSuccess,
  onClose,
}: {
  itemId: number;
  onSuccess: (newContent: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.adCopy.regenerateSingle.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({
        id: itemId,
        promptOverride: prompt.trim() || undefined,
      });
      onSuccess(result.content);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "10px", padding: "12px", background: "rgba(139,92,246,0.04)", borderRadius: "12px", border: "1px solid rgba(139,92,246,0.15)" }}>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Optional: describe what to change..."
        style={{
          width: "100%",
          minHeight: "56px",
          fontFamily: "var(--v2-font-body)",
          fontSize: "13px",
          color: "#1A1624",
          lineHeight: 1.5,
          border: "1px solid rgba(139,92,246,0.30)",
          borderRadius: "8px",
          padding: "8px 10px",
          resize: "vertical",
          outline: "none",
          background: "#FFFFFF",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
        <button
          onClick={handleRegen}
          disabled={loading}
          style={{
            background: loading ? "#ccc" : "#FF5B1D",
            color: "#fff",
            border: "none",
            borderRadius: "9999px",
            padding: "7px 18px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "12px",
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.01em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {loading ? (
            <><span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Regenerating...</>
          ) : (
            "Regenerate"
          )}
        </button>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--v2-font-body)",
            fontSize: "12px",
            color: "#888",
            cursor: "pointer",
            padding: "7px 10px",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#DC2626", margin: "6px 0 0" }}>{error}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Headline item card ───────────────────────────────────────────────────────
function HeadlineItem({ item, index, isFreeTier, onUpgradeClick, isFav, onToggleFav, complianceRewritesEnabled, rewritesForCard, onRewritesChanged }: { item: AdRow; index: number; isFreeTier?: boolean; onUpgradeClick?: (feature?: string) => void; isFav?: boolean; onToggleFav?: () => void; complianceRewritesEnabled: boolean; rewritesForCard: CardRewrite[]; onRewritesChanged: () => void }) {
  const copyLocked = isFreeTier && index >= 3;
  const [content, setContent]   = useState(item.content);
  const [copied, setCopied]     = useState(false);
  const thumbUp = !!isFav;
  const [thumbDown, setThumbDown] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "16px 18px",
      marginBottom: "10px",
    }}>
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "11px",
        color: "#999",
        margin: "0 0 6px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        Headline {index + 1}
      </p>
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "16px",
        color: "#1A1624",
        margin: "0 0 10px",
        lineHeight: 1.35,
      }}>
        {content}
      </p>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
        <ScoreBadge score={item.selectionScore} />
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {copyLocked ? (
          <button onClick={() => onUpgradeClick?.("Full Copy Access")} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro for full copy access">🔒</button>
        ) : (
          <button onClick={handleCopy} style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }} title="Copy">{copied ? "✓" : "⎘"}</button>
        )}
        <button
          onClick={() => { onToggleFav?.(); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
        {isFreeTier ? (
          <button
            onClick={() => onUpgradeClick?.("Per-Item Regeneration")}
            style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }}
            title="Upgrade to Pro to regenerate"
          >↺</button>
        ) : (
          <button
            onClick={() => setRegenOpen(p => !p)}
            style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
            title="Regenerate"
          >↺</button>
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <RegenPanel
          itemId={item.id}
          onSuccess={(newContent) => { setContent(newContent); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {/* W5 Phase 2 — active compliance rewrite panel for flagged headlines. */}
      {renderCompliancePanelIfFlagged({
        complianceRewritesEnabled,
        item,
        content,
        rewritesForCard,
        onAccept: (newText) => { setContent(newText); onRewritesChanged(); },
        onRewritesChanged,
      })}
    </div>
  );
}

// ─── Body copy item card ──────────────────────────────────────────────────────
function BodyItem({ item, index, isFreeTier, onUpgradeClick, isFav, onToggleFav, complianceRewritesEnabled, rewritesForCard, onRewritesChanged }: { item: AdRow; index: number; isFreeTier?: boolean; onUpgradeClick?: (feature?: string) => void; isFav?: boolean; onToggleFav?: () => void; complianceRewritesEnabled: boolean; rewritesForCard: CardRewrite[]; onRewritesChanged: () => void }) {
  const copyLocked = isFreeTier && index >= 3;
  const [content, setContent]   = useState(item.content);
  const [copied, setCopied]     = useState(false);
  const thumbUp = !!isFav;
  const [thumbDown, setThumbDown] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePublishToMeta() {
    const toast = document.createElement("div");
    toast.textContent = "Coming soon — Meta publishing launches in Phase P";
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1A1624",
      color: "#F5F1EA",
      padding: "12px 24px",
      borderRadius: "9999px",
      fontFamily: "Instrument Sans, sans-serif",
      fontSize: "14px",
      fontWeight: 600,
      zIndex: "99999",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      pointerEvents: "none",
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "18px 20px",
      marginBottom: "12px",
    }}>
      {/* Header row: index + angle pill */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "11px",
          color: "#999",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          Body {index + 1}
        </span>
        {item.bodyAngle && <AnglePill angle={item.bodyAngle} />}
      </div>
      {/* Body text */}
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "14px",
        color: "#1A1624",
        margin: "0 0 10px",
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
      }}>
        {content}
      </p>
      {/* Compliance + score badges */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <ComplianceBadge score={item.complianceScore} />
        <ScoreBadge score={item.selectionScore} />
      </div>
      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
        {copyLocked ? (
          <button onClick={() => onUpgradeClick?.("Full Copy Access")} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro for full copy access">🔒</button>
        ) : (
          <button onClick={handleCopy} style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }} title="Copy">{copied ? "✓" : "⎘"}</button>
        )}
        <button
          onClick={() => { onToggleFav?.(); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
        {isFreeTier ? (
          <button
            onClick={() => onUpgradeClick?.("Per-Item Regeneration")}
            style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }}
            title="Upgrade to Pro to regenerate"
          >↺</button>
        ) : (
          <button
            onClick={() => setRegenOpen(p => !p)}
            style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
            title="Regenerate"
          >↺</button>
        )}
        {/* Publish to Meta */}
        <button
          onClick={handlePublishToMeta}
          style={{
            background: "#1A1624",
            color: "#F5F1EA",
            border: "none",
            borderRadius: "9999px",
            padding: "7px 16px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 600,
            fontSize: "12px",
            cursor: "pointer",
            letterSpacing: "0.01em",
            marginLeft: "4px",
          }}
        >
          Publish to Meta
        </button>
      </div>
      {regenOpen && !isFreeTier && (
        <RegenPanel
          itemId={item.id}
          onSuccess={(newContent) => { setContent(newContent); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {/* W5 Phase 2 — active compliance rewrite panel for flagged body copy. */}
      {renderCompliancePanelIfFlagged({
        complianceRewritesEnabled,
        item,
        content,
        rewritesForCard,
        onAccept: (newText) => { setContent(newText); onRewritesChanged(); },
        onRewritesChanged,
      })}
    </div>
  );
}

// ─── Link item card ───────────────────────────────────────────────────────────
function LinkItem({ item, index, isFreeTier, onUpgradeClick, isFav, onToggleFav, complianceRewritesEnabled, rewritesForCard, onRewritesChanged }: { item: AdRow; index: number; isFreeTier?: boolean; onUpgradeClick?: (feature?: string) => void; isFav?: boolean; onToggleFav?: () => void; complianceRewritesEnabled: boolean; rewritesForCard: CardRewrite[]; onRewritesChanged: () => void }) {
  const copyLocked = isFreeTier && index >= 3;
  const [content, setContent]   = useState(item.content);
  const [copied, setCopied]     = useState(false);
  const thumbUp = !!isFav;
  const [thumbDown, setThumbDown] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "14px 18px",
      marginBottom: "10px",
    }}>
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "11px",
        color: "#999",
        margin: "0 0 6px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        Link {index + 1}
      </p>
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "14px",
        color: "#1A1624",
        margin: "0 0 10px",
        fontWeight: 500,
      }}>
        {content}
      </p>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
        <ScoreBadge score={item.selectionScore} />
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {copyLocked ? (
          <button onClick={() => onUpgradeClick?.("Full Copy Access")} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro for full copy access">🔒</button>
        ) : (
          <button onClick={handleCopy} style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }} title="Copy">{copied ? "✓" : "⎘"}</button>
        )}
        <button
          onClick={() => { onToggleFav?.(); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
        {isFreeTier ? (
          <button
            onClick={() => onUpgradeClick?.("Per-Item Regeneration")}
            style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }}
            title="Upgrade to Pro to regenerate"
          >↺</button>
        ) : (
          <button
            onClick={() => setRegenOpen(p => !p)}
            style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
            title="Regenerate"
          >↺</button>
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <RegenPanel
          itemId={item.id}
          onSuccess={(newContent) => { setContent(newContent); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {/* W5 Phase 2 — active compliance rewrite panel for flagged link copy. */}
      {renderCompliancePanelIfFlagged({
        complianceRewritesEnabled,
        item,
        content,
        rewritesForCard,
        onAccept: (newText) => { setContent(newText); onRewritesChanged(); },
        onRewritesChanged,
      })}
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#1A1624" : "rgba(26,22,36,0.06)",
        color: active ? "#F5F1EA" : "#1A1624",
        border: "none",
        borderRadius: "9999px",
        padding: "7px 16px",
        fontFamily: "var(--v2-font-body)",
        fontWeight: 600,
        fontSize: "13px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
        letterSpacing: "0.01em",
      }}
    >
      {label} <span style={{ opacity: 0.65, fontSize: "11px" }}>({count})</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2AdCopyResultPanel({
  adSetId,
  serviceId: _serviceId,
  isFreeTier,
}: {
  adSetId: string;
  serviceId: number;
  isFreeTier?: boolean;
}) {
  type TopTab = "copy" | "images" | "video";
  const [topTab, setTopTab] = useState<TopTab>("copy");
  const [activeTab, setActiveTab] = useState<AdTab>("headlines");
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const { isFavourited: isAdFav, toggle: toggleAdFav } = useFavourites("adCopy");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError } = trpc.adCopy.getByAdSetId.useQuery(
    { adSetId },
    { enabled: !!adSetId, staleTime: 60_000 }
  );

  // W5 Phase 2 — feature flag probe (same pattern as Node 6). Cached
  // forever on the client; the flag only changes at server restart.
  const { data: rewriteFlag } = trpc.complianceRewrites.isEnabled.useQuery(
    undefined,
    { staleTime: Infinity },
  );
  const complianceRewritesEnabled = rewriteFlag?.enabled === true;

  // Batched rewrites-for-adset query. Fires once on mount when flag is
  // on. Children read their own rewrite list out of the map. staleTime
  // 5 min because rewrites only change via user action; refetchRewrites()
  // after each mutation is the authoritative refresh path.
  const { data: allRewrites = [], refetch: refetchRewrites } = trpc.complianceRewrites.listForAdSet.useQuery(
    { adSetId },
    {
      enabled: complianceRewritesEnabled && !!adSetId,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  );
  const rewritesByAdCopyId = useMemo(() => {
    const map = new Map<number, typeof allRewrites>();
    for (const r of allRewrites) {
      const list = map.get(r.sourceId) ?? [];
      list.push(r);
      map.set(r.sourceId, list);
    }
    return map;
  }, [allRewrites]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your ad copy…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load ad copy. Try refreshing.
      </div>
    );
  }

  const headlines = (data.headlines ?? []) as AdRow[];
  const bodies    = (data.bodies ?? []) as AdRow[];
  const links     = (data.links ?? []) as AdRow[];

  const TABS: { key: AdTab; label: string; count: number }[] = [
    { key: "headlines", label: "Headlines",  count: headlines.length },
    { key: "body",      label: "Body Copy",  count: bodies.length },
    { key: "links",     label: "Links",      count: links.length },
  ];

  return (
    <div style={{
      background: "#F5F1EA",
      borderRadius: "24px",
      border: "1px solid rgba(26,22,36,0.10)",
      padding: "28px 24px",
      marginTop: "24px",
      position: "relative",
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <ZappyMascot state="cheering" size={56} />
        <div>
          <h2 style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "22px",
            color: "#1A1624",
            margin: 0,
          }}>
            Your Ad Copy
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {headlines.length} headlines · {bodies.length} body copies · {links.length} links
          </p>
        </div>
      </div>

      {/* ── Top-level tabs: Copy / Images / Video ── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "rgba(26,22,36,0.07)", borderRadius: "var(--v2-border-radius-pill)", padding: "4px", width: "fit-content" }}>
        {([
          { key: "copy" as TopTab, label: "📝 Copy" },
          { key: "images" as TopTab, label: "🖼 Images" },
          { key: "video" as TopTab, label: "🎬 Video" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTopTab(t.key)}
            style={{
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "8px 18px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 600,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              background: topTab === t.key ? "#fff" : "transparent",
              color: topTab === t.key ? "var(--v2-text-color)" : "rgba(26,22,36,0.50)",
              boxShadow: topTab === t.key ? "0 1px 6px rgba(26,22,36,0.10)" : "none",
              transition: "all 0.18s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Credit / info labels below top tabs ── */}
      {topTab === "video" && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", color: "#999", margin: "-12px 0 16px 4px" }}>
          Script: Free · Render: Credits
        </p>
      )}

      {/* ── COPY TAB — existing ad copy content ── */}
      {topTab === "copy" && (
        <>
          {/* Sub-tabs: Headlines / Body Copy / Links */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {TABS.map(t => (
              <TabPill
                key={t.key}
                label={t.label}
                count={t.count}
                active={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
              />
            ))}
          </div>

          {/* ── Search ── */}
          <input
            type="text"
            placeholder="Search ad copy..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "var(--v2-text-color)",
              background: "#fff",
              border: "1px solid rgba(26,22,36,0.12)",
              borderRadius: "12px",
              padding: "10px 14px",
              outline: "none",
              marginBottom: "16px",
              boxSizing: "border-box" as const,
            }}
          />

          <div>
            {activeTab === "headlines" && (() => {
              const sorted = [...headlines].sort((a, b) => parseFloat(b.selectionScore ?? '0') - parseFloat(a.selectionScore ?? '0'));
              const filtered = searchQuery ? sorted.filter(h => h.content.toLowerCase().includes(searchQuery.toLowerCase())) : sorted;
              return filtered.length === 0
                ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No headlines found.</p>
                : filtered.map((h, i) => <HeadlineItem key={h.id} item={h} index={i} isFreeTier={isFreeTier} onUpgradeClick={(f) => setUpgradeFeature(f || "Per-Item Regeneration")} isFav={isAdFav(h.id)} onToggleFav={() => toggleAdFav(h.id, h.content)} complianceRewritesEnabled={complianceRewritesEnabled} rewritesForCard={rewritesByAdCopyId.get(h.id) ?? []} onRewritesChanged={refetchRewrites} />);
            })()}
            {activeTab === "body" && (() => {
              const sorted = [...bodies].sort((a, b) => parseFloat(b.selectionScore ?? '0') - parseFloat(a.selectionScore ?? '0'));
              const filtered = searchQuery ? sorted.filter(b => b.content.toLowerCase().includes(searchQuery.toLowerCase())) : sorted;
              return filtered.length === 0
                ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No body copy found.</p>
                : filtered.map((b, i) => <BodyItem key={b.id} item={b} index={i} isFreeTier={isFreeTier} onUpgradeClick={(f) => setUpgradeFeature(f || "Per-Item Regeneration")} isFav={isAdFav(b.id)} onToggleFav={() => toggleAdFav(b.id, b.content)} complianceRewritesEnabled={complianceRewritesEnabled} rewritesForCard={rewritesByAdCopyId.get(b.id) ?? []} onRewritesChanged={refetchRewrites} />);
            })()}
            {activeTab === "links" && (() => {
              const sorted = [...links].sort((a, b) => parseFloat(b.selectionScore ?? '0') - parseFloat(a.selectionScore ?? '0'));
              const filtered = searchQuery ? sorted.filter(l => l.content.toLowerCase().includes(searchQuery.toLowerCase())) : sorted;
              return filtered.length === 0
                ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No links found.</p>
                : filtered.map((l, i) => <LinkItem key={l.id} item={l} index={i} isFreeTier={isFreeTier} onUpgradeClick={(f) => setUpgradeFeature(f || "Per-Item Regeneration")} isFav={isAdFav(l.id)} onToggleFav={() => toggleAdFav(l.id, l.content)} complianceRewritesEnabled={complianceRewritesEnabled} rewritesForCard={rewritesByAdCopyId.get(l.id) ?? []} onRewritesChanged={refetchRewrites} />);
            })()}
          </div>
        </>
      )}

      {/* ── IMAGES TAB — Ad Image Creator inline ── */}
      {topTab === "images" && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#888", marginBottom: "16px", fontStyle: "italic" }}>
            Optional — generate scroll-stopping ad images using your copy as context.
          </p>
          <V2AdImageCreator />
        </div>
      )}

      {/* ── VIDEO TAB — Video Creator inline ── */}
      {topTab === "video" && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#888", marginBottom: "16px", fontStyle: "italic" }}>
            Optional — generate video ads with voiceover and motion graphics.
          </p>
          <V2VideoCreator isFreeTier={isFreeTier} />
        </div>
      )}

      {upgradeFeature && <UpgradePrompt variant="modal" featureName={upgradeFeature} onClose={() => setUpgradeFeature(null)} />}
      <ExportButtons content={formatAdCopyTxt(Array.isArray(data) ? data : [])} serviceName="Ad_Copy" nodeName="Ad_Copy" showPdf={true} isFreeTier={isFreeTier} />
    </div>
  );
}
