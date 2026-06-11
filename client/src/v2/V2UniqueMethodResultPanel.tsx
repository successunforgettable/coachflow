/**
 * V2UniqueMethodResultPanel — Node 4 Results Panel
 *
 * 3 fixed tabs: Your Unique Method / Headline Ideas / Advanced Options.
 * 5 cards per tab. Per card: mechanismName (bold title), mechanismDescription,
 * copy button, thumbs-up, thumbs-down, star (all UI state only).
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";
import PlaceholderBanner from "./components/PlaceholderBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = "hero_mechanisms" | "headline_ideas" | "beast_mode";

interface MechanismRow {
  id: number;
  tabType: string;
  mechanismName: string;
  mechanismDescription: string;
  rating: number;
  isFavorite: boolean;
}

const TABS: { key: TabType; label: string }[] = [
  { key: "hero_mechanisms", label: "Your Unique Method" },
  { key: "headline_ideas",  label: "Headline Ideas" },
  { key: "beast_mode",      label: "Advanced Options" },
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

// ─── Mechanism card ───────────────────────────────────────────────────────────
function MechanismCard({ mechanism, isSelected, onSelect }: { mechanism: MechanismRow; isSelected: boolean; onSelect?: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = `${mechanism.mechanismName}\n\n${mechanism.mechanismDescription}`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: isSelected ? "2px solid #8B5CF6" : "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "18px 20px",
      marginBottom: "12px",
      position: "relative",
    }}>
      {isSelected && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.40)",
          borderRadius: "9999px", padding: "3px 12px", fontSize: "11px",
          fontFamily: "var(--v2-font-body)", fontWeight: 700, color: "#7C3AED",
          letterSpacing: "0.02em", marginBottom: "10px",
        }}>
          ✓ Selected
        </span>
      )}
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "17px",
        color: "#1A1624",
        margin: "0 0 8px",
        lineHeight: 1.3,
      }}>
        {mechanism.mechanismName}
      </p>
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "14px",
        color: "#444",
        lineHeight: 1.65,
        margin: "0 0 12px",
        whiteSpace: "pre-wrap",
      }}>
        {mechanism.mechanismDescription}
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >
          {copied ? "✓" : "⎘"}
        </button>
        {!isSelected && onSelect && (
          <button
            onClick={onSelect}
            style={{
              background: "#8B5CF6", color: "#fff", border: "none",
              borderRadius: "9999px", padding: "6px 16px",
              fontFamily: "var(--v2-font-body)", fontWeight: 700,
              fontSize: "12px", cursor: "pointer", letterSpacing: "0.01em",
              transition: "opacity 0.15s",
            }}
            title="Use this one"
          >
            Use this one
          </button>
        )}
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
export default function V2UniqueMethodResultPanel({
  mechanismSetId,
  onContinue,
  generationWarning,
  onRetry,
  selectedId,
  onChangeSelection,
  isStale,
}: {
  mechanismSetId: string;
  onContinue: () => void;
  generationWarning?: string;
  onRetry?: () => void;
  selectedId?: number | null;
  onChangeSelection?: (id: number) => void;
  isStale?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("hero_mechanisms");

  const { data, isLoading, isError } = trpc.heroMechanisms.getBySetId.useQuery(
    { mechanismSetId },
    { enabled: !!mechanismSetId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Unique Method…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load mechanisms. Try refreshing.
      </div>
    );
  }

  const mechanisms = data as MechanismRow[];
  const byTab: Record<TabType, MechanismRow[]> = {
    hero_mechanisms: mechanisms.filter(m => m.tabType === "hero_mechanisms"),
    headline_ideas:  mechanisms.filter(m => m.tabType === "headline_ideas"),
    beast_mode:      mechanisms.filter(m => m.tabType === "beast_mode"),
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
      {/* ── Stale note ── */}
      {isStale && (
        <div style={{
          background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.40)",
          borderRadius: "12px", padding: "10px 14px", marginBottom: "16px",
          fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#92400E",
        }}>
          Built with your previous selection — regenerate to update.
        </div>
      )}

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
            Your Unique Method
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {mechanisms.length} mechanisms across 3 categories
          </p>
        </div>
      </div>

      {/* ── Operator placeholders banner — surfaces [INSERT_*] tokens across all mechanisms ── */}
      <PlaceholderBanner data={mechanisms} />

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
      {byTab[activeTab].map(m => (
        <MechanismCard
          key={m.id}
          mechanism={m}
          isSelected={selectedId === m.id}
          onSelect={onChangeSelection ? () => onChangeSelection(m.id) : undefined}
        />
      ))}
      {byTab[activeTab].length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No items in this category.
        </p>
      )}

      {/* ── Generation warning banner ── */}
      {generationWarning && (
        <div style={{
          marginTop: "20px",
          background: "#FFF3CD",
          border: "1px solid #FF5B1D",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <span style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "14px",
            color: "#1A1624",
          }}>
            Some mechanism names couldn't be generated — try generating again for better results.
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: "#FF5B1D",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "7px 16px",
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
