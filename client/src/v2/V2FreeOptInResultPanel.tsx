/**
 * V2FreeOptInResultPanel — Node 5 Results Panel
 *
 * 4 fixed tabs: Long Titles / Short Titles / Advanced Variations / Subheadlines.
 * 5 cards per tab. Per card: title text, copy, thumbs-up, thumbs-down, star (UI state only).
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";

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

// ─── Inline regen panel ──────────────────────────────────────────────────────
function HvcoRegenPanel({
  itemId,
  onSuccess,
  onClose,
}: {
  itemId: number;
  onSuccess: (title: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.hvco.regenerateSingle.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({ id: itemId, promptOverride: prompt.trim() || undefined });
      onSuccess(result.title);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "10px", padding: "12px", background: "rgba(139,92,246,0.04)", borderRadius: "12px", border: "1px solid rgba(139,92,246,0.15)" }}>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Optional: describe what to change..."
        style={{ width: "100%", minHeight: "56px", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#1A1624", lineHeight: 1.5, border: "1px solid rgba(139,92,246,0.30)", borderRadius: "8px", padding: "8px 10px", resize: "vertical", outline: "none", background: "#FFFFFF", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
        <button onClick={handleRegen} disabled={loading}
          style={{ background: loading ? "#ccc" : "#FF5B1D", color: "#fff", border: "none", borderRadius: "9999px", padding: "7px 18px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "12px", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: "6px" }}>
          {loading ? (<><span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Regenerating...</>) : "Regenerate"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "none", fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#888", cursor: "pointer", padding: "7px 10px" }}>Cancel</button>
      </div>
      {error && <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#DC2626", margin: "6px 0 0" }}>{error}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Title card ───────────────────────────────────────────────────────────────
function TitleCard({ hvco, isFreeTier, onUpgradeClick }: { hvco: HvcoRow; isFreeTier?: boolean; onUpgradeClick?: () => void }) {
  const [title, setTitle]           = useState(hvco.title);
  const [copied, setCopied]         = useState(false);
  const [thumbUp, setThumbUp]       = useState(false);
  const [thumbDown, setThumbDown]   = useState(false);
  const [starred, setStarred]       = useState(false);
  const [regenOpen, setRegenOpen]   = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(title).catch(() => {});
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
        {title}
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={handleCopy} style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }} title="Copy">{copied ? "✓" : "⎘"}</button>
        <button onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }} style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }} title="Thumbs up">👍</button>
        <button onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }} style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }} title="Thumbs down">👎</button>
        <button onClick={() => setStarred(p => !p)} style={{ ...iconBtn, background: starred ? "rgba(255,165,0,0.12)" : undefined, borderColor: starred ? "rgba(255,165,0,0.45)" : undefined, color: starred ? "#D97706" : undefined }} title="Star">{starred ? "★" : "☆"}</button>
        {isFreeTier ? (
          <button onClick={() => onUpgradeClick?.()} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro to regenerate">↺</button>
        ) : (
          <button onClick={() => setRegenOpen(p => !p)} style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }} title="Regenerate">↺</button>
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <HvcoRegenPanel
          itemId={hvco.id}
          onSuccess={(t) => { setTitle(t); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
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
  isFreeTier,
}: {
  hvcoSetId: string;
  isFreeTier?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("long");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

      {/* ── Search ── */}
      <input
        type="text"
        placeholder="Search titles..."
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

      {/* ── Cards ── */}
      {byTab[activeTab]
        .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(t => (
        <TitleCard key={t.id} hvco={t} isFreeTier={isFreeTier} onUpgradeClick={() => setShowUpgradeModal(true)} />
      ))}
      {byTab[activeTab].filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No titles in this category.
        </p>
      )}
      {showUpgradeModal && <UpgradePrompt variant="modal" featureName="Per-Item Regeneration" onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}
