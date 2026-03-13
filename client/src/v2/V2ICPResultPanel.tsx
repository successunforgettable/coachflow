/**
 * V2ICPResultPanel — Node 2 Results Panel
 *
 * Displays the generated ICP as 17 accordion sections.
 * Demographics section renders the JSON object as a labelled list.
 * Download PDF button shows Phase L toast.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";

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
    ageRange: "Age Range",
    occupation: "Occupation",
    incomeLevel: "Income Level",
    location: "Location",
    education: "Education",
    familyStatus: "Family Status",
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

// ─── Accordion section ────────────────────────────────────────────────────────
function AccordionSection({
  label,
  sectionKey,
  content,
  defaultOpen,
}: {
  label: string;
  sectionKey: SectionKey;
  content: unknown;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const textContent =
    sectionKey === "demographics"
      ? (() => {
          try {
            const obj: Record<string, string> = typeof content === "string" ? JSON.parse(content as string) : (content as Record<string, string>);
            return Object.entries(obj)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n");
          } catch {
            return String(content ?? "");
          }
        })()
      : String(content ?? "");

  function handleCopy() {
    navigator.clipboard.writeText(textContent).catch(() => {});
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
          {sectionKey === "demographics" ? (
            <DemographicsContent raw={content} />
          ) : (
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "#333",
              lineHeight: 1.65,
              margin: "0 0 12px",
              whiteSpace: "pre-wrap",
            }}>
              {textContent || "Not specified"}
            </p>
          )}
          {/* Copy button */}
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
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2ICPResultPanel({
  icpId,
  onContinue,
}: {
  icpId: number;
  onContinue: () => void;
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
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", paddingRight: "180px" }}>
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
