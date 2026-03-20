/**
 * V2FreeOptInResultPanel — Node 5 Results Panel
 *
 * 4 fixed tabs: Long Titles / Short Titles / Advanced Variations / Subheadlines.
 * 5 cards per tab. Per card: title text, copy, thumbs-up, thumbs-down, star (UI state only).
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = "long" | "short" | "beast_mode" | "subheadlines";

interface HvcoRow {
  id: number;
  tabType: string;
  title: string;
  rating: number;
  isFavorite: boolean;
}

const TABS: { key: TabType; label: string }[] = [
  { key: "long",        label: "Long Titles" },
  { key: "short",       label: "Short Titles" },
  { key: "beast_mode",  label: "Advanced Variations" },
  { key: "subheadlines", label: "Subheadlines" },
];

// ─── Shared icon-button style ─────────────────────────────────────────────────
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

// ─── Title card ───────────────────────────────────────────────────────────────
function TitleCard({ hvco }: { hvco: HvcoRow }) {
  const [copied, setCopied]       = useState(false);
  const [thumbUp, setThumbUp]     = useState(false);
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]     = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(hvco.title).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "16px 20px",
      marginBottom: "10px",
    }}>
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "17px",
        color: "#1A1624",
        margin: "0 0 12px",
        lineHeight: 1.35,
      }}>
        {hvco.title}
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >
          {copied ? "✓" : "⎘"}
        </button>
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >
          👍
        </button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >
          👎
        </button>
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
function TabPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
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
export default function V2FreeOptInResultPanel({
  hvcoSetId,
}: {
  hvcoSetId: string;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("long");

  const { data, isLoading, isError } = trpc.hvco.getBySetId.useQuery(
    { hvcoSetId },
    { enabled: !!hvcoSetId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Free Opt-In Titles…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load titles. Try refreshing.
      </div>
    );
  }

  const titles = data as HvcoRow[];
  const byTab: Record<TabType, HvcoRow[]> = {
    long:         titles.filter(t => t.tabType === "long"),
    short:        titles.filter(t => t.tabType === "short"),
    beast_mode:   titles.filter(t => t.tabType === "beast_mode"),
    subheadlines: titles.filter(t => t.tabType === "subheadlines"),
  };

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
            Your Free Opt-In Titles
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {titles.length} titles across 4 categories
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {TABS.map(t => (
          <TabPill
            key={t.key}
            label={t.label}
            count={byTab[t.key].length}
            active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
          />
        ))}
      </div>

      {/* ── Cards ── */}
      {byTab[activeTab].map(t => (
        <TitleCard key={t.id} hvco={t} />
      ))}
      {byTab[activeTab].length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No titles in this category.
        </p>
      )}
    </div>
  );
}
