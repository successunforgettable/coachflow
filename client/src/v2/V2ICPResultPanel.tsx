/**
 * V2ICPResultPanel — Node 2 Results Panel
 *
 * Displays the generated ICP as 17 accordion sections.
 * Demographics section renders the JSON object as a labelled list (read-only).
 * All other 16 sections support click-to-edit and per-section AI regeneration.
 * Download PDF button shows Phase L toast.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";

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

// ─── Section definitions ──────────────────────────────────────────────────────
const SECTIONS = [
  { key: "introduction",           label: "Introduction" },
  { key: "fears",                  label: "Fears" },
  { key: "hopesDreams",            label: "Hopes & Dreams" },
  { key: "demographics",           label: "Demographics" },
  { key: "psychographics",         label: "Psychographics" },
  { key: "pains",                  label: "Pains" },
  { key: "frustrations",           label: "Frustrations" },
  { key: "goals",                  label: "Goals" },
  { key: "values",                 label: "Values" },
  { key: "objections",             label: "Objections" },
  { key: "buyingTriggers",         label: "Buying Triggers" },
  { key: "mediaConsumption",       label: "Media Consumption" },
  { key: "influencers",            label: "Influencers" },
  { key: "communicationStyle",     label: "Communication Style" },
  { key: "decisionMaking",         label: "Decision Making" },
  { key: "successMetrics",         label: "Success Metrics" },
  { key: "implementationBarriers", label: "Implementation Barriers" },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];

// ─── Demographics renderer ────────────────────────────────────────────────────
function DemographicsContent({ raw }: { raw: unknown }) {
  if (!raw) return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555" }}>Not specified</p>;
  let obj: Record<string, string> = {};
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, string>);
  } catch {
    return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555" }}>{String(raw)}</p>;
  }
  const DEMO_LABELS: Record<string, string> = {
    age_range: "Age Range",
    gender: "Gender",
    income_level: "Income Level",
    education: "Education",
    occupation: "Occupation",
    location: "Location",
    family_status: "Family Status",
  };
  const entries = Object.entries(obj).filter(([, v]) => v);
  if (!entries.length) return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555" }}>Not specified</p>;
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
      {entries.map(([k, v]) => (
        <>
          <dt key={`dt-${k}`} style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 700, color: "#FF5B1D", whiteSpace: "nowrap" }}>
            {DEMO_LABELS[k] ?? k}
          </dt>
          <dd key={`dd-${k}`} style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#1A1624", margin: 0 }}>
            {String(v)}
          </dd>
        </>
      ))}
    </dl>
  );
}

// ─── Inline regen panel ──────────────────────────────────────────────────────
function IcpRegenPanel({
  icpId,
  sectionKey,
  onSuccess,
  onClose,
}: {
  icpId: number;
  sectionKey: string;
  onSuccess: (value: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.icps.regenerateSection.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({
        id: icpId,
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

// ─── Accordion section ────────────────────────────────────────────────────────
function AccordionSection({
  label,
  sectionKey,
  content,
  defaultOpen,
  icpId,
  isFreeTier,
}: {
  label: string;
  sectionKey: SectionKey;
  content: unknown;
  defaultOpen: boolean;
  icpId: number;
  isFreeTier?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isDemographics = sectionKey === "demographics";

  const initialText = isDemographics
    ? (() => {
        try {
          const obj: Record<string, string> = typeof content === "string" ? JSON.parse(content as string) : (content as Record<string, string>);
          return Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
        } catch { return String(content ?? ""); }
      })()
    : String(content ?? "");

  const [value, setValue] = useState(initialText);

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
      marginBottom: "8px",
      overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: "var(--v2-font-body)",
          fontWeight: 700,
          fontSize: "14px",
          color: "#1A1624",
          letterSpacing: "0.01em",
        }}>
          {label}
        </span>
        <span style={{ fontSize: "12px", color: "#999", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {/* Body */}
      {open && (
        <div style={{ padding: "0 18px 16px" }}>
          {isDemographics ? (
            <DemographicsContent raw={content} />
          ) : editing ? (
            <textarea
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              onBlur={() => setEditing(false)}
              style={{
                width: "100%",
                minHeight: "120px",
                fontFamily: "var(--v2-font-body)",
                fontSize: "14px",
                color: "#1A1624",
                lineHeight: 1.65,
                border: "1px solid rgba(139,92,246,0.40)",
                borderRadius: "8px",
                padding: "8px 10px",
                resize: "vertical",
                outline: "none",
                background: "#FAFAFA",
                boxSizing: "border-box",
                margin: "0 0 12px",
              }}
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "14px",
                color: "#333",
                lineHeight: 1.65,
                margin: "0 0 12px",
                whiteSpace: "pre-wrap",
                cursor: "text",
              }}
              title="Click to edit"
            >
              {value || <span style={{ color: "#aaa" }}>—</span>}
            </p>
          )}
          {/* Controls row */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleCopy}
              style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
              title="Copy to clipboard"
            >
              {copied ? "✓" : "⎘"}
            </button>
            {!isDemographics && (
              isFreeTier ? (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }}
                  title="Upgrade to Pro to regenerate"
                >
                  ↺
                </button>
              ) : (
                <button
                  onClick={() => setRegenOpen(p => !p)}
                  style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
                  title="Regenerate"
                >
                  ↺
                </button>
              )
            )}
          </div>
          {regenOpen && !isDemographics && !isFreeTier && (
            <IcpRegenPanel
              icpId={icpId}
              sectionKey={sectionKey}
              onSuccess={(v) => { setValue(v); setRegenOpen(false); }}
              onClose={() => setRegenOpen(false)}
            />
          )}
          {showUpgradeModal && <UpgradePrompt variant="modal" featureName="Per-Item Regeneration" onClose={() => setShowUpgradeModal(false)} />}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2ICPResultPanel({
  icpId,
  isFreeTier,
}: {
  icpId: number;
  isFreeTier?: boolean;
}) {
  const { data, isLoading, isError } = trpc.icps.get.useQuery(
    { id: icpId },
    { enabled: !!icpId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Dream Buyer Profile…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load ICP. Try refreshing.
      </div>
    );
  }

  const icp = data as Record<string, unknown>;

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
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
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
            Your Dream Buyer Profile
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {(icp.name as string) || "Ideal Customer Profile"} — 17 sections
          </p>
        </div>
      </div>

      {/* ── Accordion sections ── */}
      {SECTIONS.map((s, i) => (
        <AccordionSection
          key={s.key}
          label={s.label}
          sectionKey={s.key}
          content={icp[s.key]}
          defaultOpen={i < 3}
          icpId={icpId}
          isFreeTier={isFreeTier}
        />
      ))}

      {/* ── Download PDF button ── */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={() => toast.info("PDF export coming in Phase L")}
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
          ↓ Download PDF
        </button>
      </div>
    </div>
  );
}
