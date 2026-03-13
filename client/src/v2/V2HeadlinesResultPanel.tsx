/**
 * V2HeadlinesResultPanel — Node 6 Results Panel
 *
 * Displays the generated headline set in a 5-tab layout (Story, Eyebrow,
 * Question, Authority, Urgency). Each card has copy, thumbs-up, thumbs-down,
 * and star controls (all UI-state only). Compliance badge reads complianceScore
 * from the DB row. Fixed "Continue to Next Step" button always visible top-right.
 *
 * Props:
 *   headlineSetId — nanoid from the job result
 *   serviceId     — numeric service ID (for getLatestByServiceId fallback)
 *   onContinue    — called when the user clicks "Continue to Next Step"
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormulaTab = "story" | "eyebrow" | "question" | "authority" | "urgency";

interface HeadlineRow {
  id: number;
  formulaType: string;
  headline: string;
  subheadline: string | null;
  eyebrow: string | null;
  complianceScore: number | null;
  rating: number;
}

// ─── Compliance badge ─────────────────────────────────────────────────────────
function ComplianceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const isGreen = score >= 90;
  const isAmber = score >= 70 && score < 90;
  const bg    = isGreen ? "rgba(88,204,2,0.12)"  : isAmber ? "rgba(255,165,0,0.12)"  : "rgba(220,38,38,0.12)";
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
      marginTop: "6px",
    }}>
      <span style={{ fontSize: "10px" }}>{isGreen ? "✓" : isAmber ? "⚠" : "✗"}</span>
      {score}/100 — {label}
    </span>
  );
}

// ─── Per-headline card ────────────────────────────────────────────────────────
function HeadlineCard({ headline }: { headline: HeadlineRow }) {
  const [copied, setCopied]     = useState(false);
  const [thumbUp, setThumbUp]   = useState(false);
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]   = useState(false);

  function handleCopy() {
    const text = [headline.eyebrow, headline.headline, headline.subheadline]
      .filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "18px 20px",
      marginBottom: "12px",
    }}>
      {/* Eyebrow */}
      {headline.eyebrow && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "11px",
          fontWeight: 700,
          color: "#FF5B1D",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 0 6px",
        }}>
          {headline.eyebrow}
        </p>
      )}
      {/* Main headline */}
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "18px",
        color: "#1A1624",
        margin: "0 0 4px",
        lineHeight: 1.35,
      }}>
        {headline.headline}
      </p>
      {/* Subheadline */}
      {headline.subheadline && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "13px",
          color: "#555",
          margin: "0 0 8px",
          lineHeight: 1.5,
        }}>
          {headline.subheadline}
        </p>
      )}
      {/* Compliance badge */}
      <ComplianceBadge score={headline.complianceScore} />
      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }}>
        {/* Copy */}
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy to clipboard"
        >
          {copied ? "✓" : "⎘"}
        </button>
        {/* Thumbs Up */}
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >
          👍
        </button>
        {/* Thumbs Down */}
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >
          👎
        </button>
        {/* Star */}
        <button
          onClick={() => setStarred(p => !p)}
          style={{ ...iconBtn, background: starred ? "rgba(255,165,0,0.12)" : undefined, borderColor: starred ? "rgba(255,165,0,0.45)" : undefined, color: starred ? "#D97706" : undefined }}
          title="Star"
        >
          {starred ? "★" : "☆"}
        </button>
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
export default function V2HeadlinesResultPanel({
  headlineSetId,
  serviceId: _serviceId,
  onContinue,
}: {
  headlineSetId: string;
  serviceId: number;
  onContinue: () => void;
}) {
  const [activeTab, setActiveTab] = useState<FormulaTab>("story");

  const { data, isLoading, isError } = trpc.headlines.getBySetId.useQuery(
    { headlineSetId },
    { enabled: !!headlineSetId, staleTime: 60_000 }
  );

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your headlines…
      </div>
    );
  }

  // ── Error ──
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load headlines. Try refreshing.
      </div>
    );
  }

  const TABS: { key: FormulaTab; label: string }[] = [
    { key: "story",     label: "Story" },
    { key: "eyebrow",   label: "Eyebrow" },
    { key: "question",  label: "Question" },
    { key: "authority", label: "Authority" },
    { key: "urgency",   label: "Urgency" },
  ];

  const activeHeadlines: HeadlineRow[] = (data.headlines[activeTab] ?? []) as HeadlineRow[];

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
            Your Headlines
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {TABS.reduce((sum, t) => sum + (data.headlines[t.key]?.length ?? 0), 0)} headlines across 5 formulas
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "20px",
        overflowX: "auto",
        paddingBottom: "4px",
      }}>
        {TABS.map(t => (
          <TabPill
            key={t.key}
            label={t.label}
            count={data.headlines[t.key]?.length ?? 0}
            active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
          />
        ))}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeHeadlines.length === 0 ? (
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>
            No {activeTab} headlines in this set.
          </p>
        ) : (
          activeHeadlines.map((h) => <HeadlineCard key={h.id} headline={h} />)
        )}
      </div>
    </div>
  );
}
