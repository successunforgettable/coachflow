/**
 * V2OfferResultPanel — Node 3 Results Panel
 *
 * 3 angle tabs: Godfather / Free / Dollar.
 * Pre-selects activeAngle from the data.
 * Each tab shows 8 labelled sections with copy + inline edit (local state only).
 * Download TXT shows Phase L toast.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
type AngleKey = "godfather" | "free" | "dollar";

interface AngleContent {
  offerName?: string;
  valueProposition?: string;
  pricing?: string;
  bonuses?: string;
  guarantee?: string;
  urgency?: string;
  cta?: string;
  [key: string]: string | undefined;
}

const ANGLE_TABS: { key: AngleKey; label: string }[] = [
  { key: "godfather", label: "Godfather" },
  { key: "free",      label: "Free" },
  { key: "dollar",    label: "Dollar" },
];

const SECTION_DEFS: { key: keyof AngleContent; label: string }[] = [
  { key: "offerName",        label: "Offer Name" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "pricing",          label: "Pricing" },
  { key: "bonuses",          label: "Bonuses" },
  { key: "guarantee",        label: "Guarantee" },
  { key: "urgency",          label: "Urgency" },
  { key: "cta",              label: "Call to Action" },
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

// ─── Editable section card ────────────────────────────────────────────────────
function SectionCard({
  label,
  initialValue,
}: {
  label: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).catch(() => {});
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
        fontWeight: 700,
        color: "#FF5B1D",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        margin: "0 0 6px",
      }}>
        {label}
      </p>
      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => setEditing(false)}
          style={{
            width: "100%",
            minHeight: "80px",
            fontFamily: "var(--v2-font-body)",
            fontSize: "14px",
            color: "#1A1624",
            lineHeight: 1.6,
            border: "1px solid rgba(139,92,246,0.40)",
            borderRadius: "8px",
            padding: "8px 10px",
            resize: "vertical",
            outline: "none",
            background: "#FAFAFA",
            boxSizing: "border-box",
          }}
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "14px",
            color: "#1A1624",
            lineHeight: 1.6,
            margin: "0 0 10px",
            whiteSpace: "pre-wrap",
            cursor: "text",
          }}
          title="Click to edit"
        >
          {value || <span style={{ color: "#aaa" }}>—</span>}
        </p>
      )}
      <button
        onClick={handleCopy}
        style={{
          ...iconBtn,
          background: copied ? "rgba(88,204,2,0.12)" : undefined,
          borderColor: copied ? "rgba(88,204,2,0.40)" : undefined,
        }}
        title="Copy to clipboard"
      >
        {copied ? "✓" : "⎘"}
      </button>
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#1A1624" : "rgba(26,22,36,0.06)",
        color: active ? "#F5F1EA" : "#1A1624",
        border: "none",
        borderRadius: "9999px",
        padding: "7px 18px",
        fontFamily: "var(--v2-font-body)",
        fontWeight: 600,
        fontSize: "13px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </button>
  );
}

// ─── Angle tab content ────────────────────────────────────────────────────────
function AngleTabContent({ content }: { content: AngleContent }) {
  return (
    <div>
      {SECTION_DEFS.map(s => (
        <SectionCard
          key={s.key}
          label={s.label}
          initialValue={content[s.key] ?? ""}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2OfferResultPanel({
  offerId,
}: {
  offerId: number;
}) {
  const { data, isLoading, isError } = trpc.offers.get.useQuery(
    { id: offerId },
    { enabled: !!offerId, staleTime: 60_000 }
  );

  const defaultAngle: AngleKey =
    (data as { activeAngle?: string } | undefined)?.activeAngle === "free"
      ? "free"
      : (data as { activeAngle?: string } | undefined)?.activeAngle === "dollar"
      ? "dollar"
      : "godfather";

  const [activeTab, setActiveTab] = useState<AngleKey | null>(null);
  const resolvedTab: AngleKey = activeTab ?? defaultAngle;

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Offer…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load offer. Try refreshing.
      </div>
    );
  }

  const offer = data as {
    productName?: string;
    godfatherAngle?: AngleContent | string;
    freeAngle?: AngleContent | string;
    dollarAngle?: AngleContent | string;
  };

  function parseAngle(raw: AngleContent | string | undefined): AngleContent {
    if (!raw) return {};
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
  }

  const angles: Record<AngleKey, AngleContent> = {
    godfather: parseAngle(offer.godfatherAngle),
    free:      parseAngle(offer.freeAngle),
    dollar:    parseAngle(offer.dollarAngle),
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
            Your Offer
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {offer.productName || "Your Product"} — 3 angles
          </p>
        </div>
      </div>

      {/* ── Angle tabs ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {ANGLE_TABS.map(t => (
          <TabPill
            key={t.key}
            label={t.label}
            active={resolvedTab === t.key}
            onClick={() => setActiveTab(t.key)}
          />
        ))}
      </div>

      {/* ── Active angle content ── */}
      <AngleTabContent content={angles[resolvedTab]} />

      {/* ── Download TXT button ── */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={() => toast.info("TXT export coming in Phase L")}
          style={{
            background: "#1A1624",
            color: "#F5F1EA",
            border: "none",
            borderRadius: "9999px",
            padding: "11px 28px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "0.01em",
          }}
        >
          ↓ Download TXT
        </button>
      </div>
    </div>
  );
}
