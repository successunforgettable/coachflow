/**
 * V2LandingPageResultPanel — Node 8 Results Panel
 *
 * 4 angle tabs: Original / Godfather / Free / Dollar.
 * Pre-selects activeAngle from the data.
 * Each tab shows 12 labelled sections with copy + inline edit (local state only).
 * FAQ section renders question/answer pairs.
 * Regenerate Section button shows Phase L toast.
 * Download TXT button shows Phase L toast.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
type AngleKey = "original" | "godfather" | "free" | "dollar";

interface FaqItem {
  question: string;
  answer: string;
}

interface TestimonialItem {
  name?: string;
  quote?: string;
  headline?: string;
  location?: string;
}

interface ConsultationItem {
  title?: string;
  description?: string;
}

interface QuizSection {
  question?: string;
  options?: string[];
  answer?: string;
}

// Matches LandingPageContent from drizzle/schema.ts exactly
interface AngleContent {
  eyebrowHeadline?: string;
  mainHeadline?: string;
  subheadline?: string;
  primaryCta?: string;
  asSeenIn?: string[];
  quizSection?: QuizSection | string;
  problemAgitation?: string;
  solutionIntro?: string;
  whyOldFail?: string;
  uniqueMechanism?: string;
  testimonials?: TestimonialItem[];
  insiderAdvantages?: string;
  scarcityUrgency?: string;
  shockingStat?: string;
  timeSavingBenefit?: string;
  consultationOutline?: ConsultationItem[] | string;
  [key: string]: unknown;
}

const ANGLE_TABS: { key: AngleKey; label: string }[] = [
  { key: "original",  label: "Original" },
  { key: "godfather", label: "Godfather" },
  { key: "free",      label: "Free" },
  { key: "dollar",    label: "Dollar" },
];

const SECTION_DEFS: { key: keyof AngleContent; label: string }[] = [
  { key: "eyebrowHeadline",    label: "Eyebrow Headline" },
  { key: "mainHeadline",       label: "Main Headline" },
  { key: "subheadline",        label: "Subheadline" },
  { key: "shockingStat",       label: "Shocking Stat" },
  { key: "problemAgitation",   label: "Problem Agitation" },
  { key: "solutionIntro",      label: "Solution Intro" },
  { key: "uniqueMechanism",    label: "Unique Mechanism" },
  { key: "insiderAdvantages",  label: "Insider Advantages" },
  { key: "testimonials",       label: "Testimonials" },
  { key: "timeSavingBenefit",  label: "Time-Saving Benefit" },
  { key: "primaryCta",         label: "Primary CTA" },
  { key: "scarcityUrgency",    label: "Scarcity / Urgency" },
  { key: "asSeenIn",           label: "As Seen In" },
  { key: "consultationOutline",label: "Consultation Outline" },
  { key: "quizSection",        label: "Quiz Section" },
  { key: "whyOldFail",         label: "Why Old Methods Fail" },
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

// ─── FAQ renderer ─────────────────────────────────────────────────────────────
function FaqContent({ raw }: { raw: unknown }) {
  if (!raw) return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555" }}>Not specified</p>;
  let items: FaqItem[] = [];
  try {
    items = typeof raw === "string" ? JSON.parse(raw) : (raw as FaqItem[]);
  } catch {
    return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555", whiteSpace: "pre-wrap" }}>{String(raw)}</p>;
  }
  if (!Array.isArray(items) || !items.length) {
    return <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555" }}>No FAQs</p>;
  }
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", fontWeight: 700, color: "#1A1624", margin: "0 0 4px" }}>
            Q: {item.question}
          </p>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#444", margin: 0, lineHeight: 1.6 }}>
            A: {item.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Serialize complex values to readable text ───────────────────────────────
function serializeValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map((item, i) => {
      if (typeof item === "string") return `${i + 1}. ${item}`;
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        // Testimonial
        if (obj.quote) return `${obj.name ?? ""}: "${obj.quote}" — ${obj.location ?? ""}`;
        // Consultation outline
        if (obj.title) return `${obj.title}: ${obj.description ?? ""}`;
        return JSON.stringify(item);
      }
      return String(item);
    }).join("\n\n");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Quiz section
    if (obj.question) return `Q: ${obj.question}\nOptions: ${Array.isArray(obj.options) ? obj.options.join(", ") : ""}\nAnswer: ${obj.answer ?? ""}`;
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

// ─── Editable section card ────────────────────────────────────────────────────
function SectionCard({
  label,
  sectionKey,
  initialValue,
}: {
  label: string;
  sectionKey: keyof AngleContent;
  initialValue: unknown;
}) {
  const textValue = serializeValue(initialValue);
  const [value, setValue] = useState(textValue);
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
        margin: "0 0 8px",
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

      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={handleCopy}
          style={{
            ...iconBtn,
            background: copied ? "rgba(88,204,2,0.12)" : undefined,
            borderColor: copied ? "rgba(88,204,2,0.40)" : undefined,
          }}
          title="Copy"
        >
          {copied ? "✓" : "⎘"}
        </button>
        <button
          onClick={() => toast.info("Individual section regeneration coming in Phase L")}
          style={{
            background: "rgba(26,22,36,0.06)",
            border: "none",
            borderRadius: "9999px",
            padding: "6px 14px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 600,
            fontSize: "12px",
            color: "#555",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ↻ Regenerate
        </button>
      </div>
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
          sectionKey={s.key}
          initialValue={content[s.key]}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2LandingPageResultPanel({
  landingPageId,
  onContinue,
}: {
  landingPageId: number;
  onContinue: () => void;
}) {
  const { data, isLoading, isError } = trpc.landingPages.get.useQuery(
    { id: landingPageId },
    { enabled: !!landingPageId, staleTime: 60_000 }
  );

  const defaultAngle: AngleKey = (() => {
    const a = (data as { activeAngle?: string } | undefined)?.activeAngle;
    if (a === "godfather" || a === "free" || a === "dollar") return a;
    return "original";
  })();

  const [activeTab, setActiveTab] = useState<AngleKey | null>(null);
  const resolvedTab: AngleKey = activeTab ?? defaultAngle;

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Landing Page…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load landing page. Try refreshing.
      </div>
    );
  }

  const lp = data as {
    productName?: string;
    originalAngle?: AngleContent | string;
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
    original:  parseAngle(lp.originalAngle),
    godfather: parseAngle(lp.godfatherAngle),
    free:      parseAngle(lp.freeAngle),
    dollar:    parseAngle(lp.dollarAngle),
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
            Your Landing Page
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {lp.productName || "Your Product"} — 4 angles × 16 sections
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
