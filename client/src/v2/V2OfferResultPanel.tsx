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
import UpgradePrompt from "./components/UpgradePrompt";
import ExportButtons from "./components/ExportButtons";
import { formatWhatsAppTxt, formatHeadlinesTxt, formatAdCopyTxt, formatOfferTxt, formatMechanismsTxt, formatHvcoTxt, formatIcpTxt, formatLandingPageTxt } from "./lib/exportUtils";

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

// ─── Inline regen panel ──────────────────────────────────────────────────────
function OfferRegenPanel({
  offerId,
  angle,
  sectionKey,
  onSuccess,
  onClose,
}: {
  offerId: number;
  angle: AngleKey;
  sectionKey: string;
  onSuccess: (value: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.offers.regenerateSection.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({
        id: offerId,
        angle,
        sectionKey: sectionKey as any,
        promptOverride: prompt.trim() || undefined,
      });
      onSuccess(result.value);
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

// ─── Editable section card ────────────────────────────────────────────────────
function SectionCard({
  label,
  sectionKey,
  initialValue,
  offerId,
  angle,
  isFreeTier,
}: {
  label: string;
  sectionKey: string;
  initialValue: string;
  offerId: number;
  angle: AngleKey;
  isFreeTier?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy to clipboard"
        >
          {copied ? "✓" : "⎘"}
        </button>
        <button
          onClick={isFreeTier ? () => setShowUpgradeModal(true) : () => setRegenOpen(p => !p)}
          style={{
            ...iconBtn,
            ...(isFreeTier
              ? { opacity: 0.4, cursor: "not-allowed" }
              : { background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }),
          }}
          title={isFreeTier ? "Upgrade to Pro to regenerate" : "Regenerate"}
        >
          ↺
        </button>
      </div>
      {regenOpen && !isFreeTier && (
        <OfferRegenPanel
          offerId={offerId}
          angle={angle}
          sectionKey={sectionKey}
          onSuccess={(v) => { setValue(v); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {showUpgradeModal && <UpgradePrompt variant="modal" featureName="Per-Item Regeneration" onClose={() => setShowUpgradeModal(false)} />}
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
function AngleTabContent({ content, offerId, angle, isFreeTier }: { content: AngleContent; offerId: number; angle: AngleKey; isFreeTier?: boolean }) {
  return (
    <div>
      {SECTION_DEFS.map(s => (
        <SectionCard
          key={s.key}
          label={s.label}
          sectionKey={s.key as string}
          initialValue={content[s.key] ?? ""}
          offerId={offerId}
          angle={angle}
          isFreeTier={isFreeTier}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2OfferResultPanel({
  offerId,
  isFreeTier,
}: {
  offerId: number;
  isFreeTier?: boolean;
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
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
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
      <AngleTabContent key={resolvedTab} content={angles[resolvedTab]} offerId={offerId} angle={resolvedTab} isFreeTier={isFreeTier} />

      {/* ── Download TXT button ── */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        {isFreeTier ? (
          <button
            onClick={() => setExportUpgradeOpen(true)}
            style={{
              background: "var(--v2-primary-btn)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "11px 28px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            Export (Pro)
          </button>
        ) : (
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
        )}
      </div>
      {exportUpgradeOpen && <UpgradePrompt variant="modal" featureName="Export & Download" onClose={() => setExportUpgradeOpen(false)} />}
    </div>
  );
}
