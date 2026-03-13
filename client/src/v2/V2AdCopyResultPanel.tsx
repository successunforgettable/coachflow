/**
 * V2AdCopyResultPanel — Node 7 Results Panel
 *
 * Displays the generated ad copy set in a 3-tab layout:
 *   Tab 1 — Headlines (contentType="headline"): flat list, copy/thumbs
 *   Tab 2 — Body Copy (contentType="body"): angle pill badge, copy/thumbs, compliance badge, Publish to Meta
 *   Tab 3 — Links (contentType="link"): flat list, copy/thumbs
 *
 * Fixed "Continue to Next Step" button always visible top-right.
 * All rating controls are UI-state only (no backend calls).
 *
 * Props:
 *   adSetId    — nanoid from the job result
 *   serviceId  — numeric service ID (for getLatestByServiceId fallback)
 *   onContinue — called when the user clicks "Continue to Next Step"
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdTab = "headlines" | "body" | "links";

interface AdRow {
  id: number;
  contentType: "headline" | "body" | "link";
  bodyAngle: string | null;
  content: string;
  complianceScore: number | null;
  rating: number;
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

// ─── Headline item card ───────────────────────────────────────────────────────
function HeadlineItem({ item, index }: { item: AdRow; index: number }) {
  const [copied, setCopied]     = useState(false);
  const [thumbUp, setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(item.content).catch(() => {});
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
        {item.content}
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >{copied ? "✓" : "⎘"}</button>
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
      </div>
    </div>
  );
}

// ─── Body copy item card ──────────────────────────────────────────────────────
function BodyItem({ item, index }: { item: AdRow; index: number }) {
  const [copied, setCopied]     = useState(false);
  const [thumbUp, setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(item.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePublishToMeta() {
    // Toast: coming soon
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
        {item.content}
      </p>
      {/* Compliance badge */}
      <ComplianceBadge score={item.complianceScore} />
      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >{copied ? "✓" : "⎘"}</button>
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
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
    </div>
  );
}

// ─── Link item card ───────────────────────────────────────────────────────────
function LinkItem({ item, index }: { item: AdRow; index: number }) {
  const [copied, setCopied]     = useState(false);
  const [thumbUp, setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(item.content).catch(() => {});
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
        {item.content}
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >{copied ? "✓" : "⎘"}</button>
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >👍</button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >👎</button>
      </div>
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
  onContinue,
}: {
  adSetId: string;
  serviceId: number;
  onContinue: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdTab>("headlines");

  const { data, isLoading, isError } = trpc.adCopy.getByAdSetId.useQuery(
    { adSetId },
    { enabled: !!adSetId, staleTime: 60_000 }
  );

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
      {/* ── Fixed top-right Continue button ── */}
      <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 10 }}>
        <button
          onClick={onContinue}
          style={{
            background: "#8B5CF6",
            color: "#fff",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 22px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(139,92,246,0.30)",
          }}
        >
          Continue to Next Step →
        </button>
      </div>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", paddingRight: "180px" }}>
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

      {/* ── Tabs ── */}
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

      {/* ── Tab content ── */}
      <div>
        {activeTab === "headlines" && (
          headlines.length === 0
            ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No headlines found.</p>
            : headlines.map((h, i) => <HeadlineItem key={h.id} item={h} index={i} />)
        )}
        {activeTab === "body" && (
          bodies.length === 0
            ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No body copy found.</p>
            : bodies.map((b, i) => <BodyItem key={b.id} item={b} index={i} />)
        )}
        {activeTab === "links" && (
          links.length === 0
            ? <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>No links found.</p>
            : links.map((l, i) => <LinkItem key={l.id} item={l} index={i} />)
        )}
      </div>
    </div>
  );
}
