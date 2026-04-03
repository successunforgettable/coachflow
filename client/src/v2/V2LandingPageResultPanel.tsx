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
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";
import ExportButtons from "./components/ExportButtons";
import { formatWhatsAppTxt, formatHeadlinesTxt, formatAdCopyTxt, formatOfferTxt, formatMechanismsTxt, formatHvcoTxt, formatIcpTxt, formatLandingPageTxt } from "./lib/exportUtils";
import LandingPageVisualTemplate from "./components/LandingPageVisualTemplate";

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
    // Headline + content pattern (problemAgitation, solutionIntro, insiderAdvantages, etc.)
    if (typeof obj.headline === "string" && typeof obj.content === "string") {
      return `${obj.headline}\n\n${obj.content}`;
    }
    // Quiz section
    if (obj.question) return `Q: ${obj.question}\nOptions: ${Array.isArray(obj.options) ? obj.options.join(", ") : ""}\nAnswer: ${obj.answer ?? ""}`;
    // Generic object with content key
    if (typeof obj.content === "string") return obj.content;
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

// ─── Inline regen panel ──────────────────────────────────────────────────────
function LpRegenPanel({
  landingPageId,
  angle,
  sectionKey,
  onSuccess,
  onClose,
}: {
  landingPageId: number;
  angle: AngleKey;
  sectionKey: string;
  onSuccess: (newAngle: AngleContent) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.landingPages.regenerateSection.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({
        landingPageId,
        angle,
        sectionKey,
        userPrompt: prompt.trim() || undefined,
      });
      onSuccess(result as AngleContent);
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
  landingPageId,
  angle,
  onAngleUpdate,
  isFreeTier,
}: {
  label: string;
  sectionKey: keyof AngleContent;
  initialValue: unknown;
  landingPageId: number;
  angle: AngleKey;
  onAngleUpdate: (newAngle: AngleContent) => void;
  isFreeTier?: boolean;
}) {
  const textValue = serializeValue(initialValue);
  const [value, setValue] = useState(textValue);
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
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >
          {copied ? "✓" : "⎘"}
        </button>
        {isFreeTier ? (
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
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <LpRegenPanel
          landingPageId={landingPageId}
          angle={angle}
          sectionKey={sectionKey as string}
          onSuccess={(newAngle) => {
            setValue(serializeValue(newAngle[sectionKey]));
            onAngleUpdate(newAngle);
            setRegenOpen(false);
          }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {showUpgradeModal && <UpgradePrompt variant="modal" featureName="Per-Item Regeneration" onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}

// ─── Visual preview helpers ──────────────────────────────────────────────────
function isValid(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0 && !val.includes("[Generation incomplete");
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val as Record<string, unknown>).length > 0;
  return true;
}

function extractText(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.headline === "string" && typeof obj.content === "string") return `${obj.headline}\n${obj.content}`;
    if (typeof obj.content === "string") return obj.content;
  }
  return String(val ?? "");
}

function splitHeadingBody(val: unknown): { heading: string; body: string[] } {
  const text = extractText(val);
  const lines = text.split("\n").filter(l => l.trim());
  return { heading: lines[0] ?? "", body: lines.slice(1) };
}

// ─── Theme tokens ────────────────────────────────────────────────────────────
type ThemeKey = "dark" | "light";
const THEMES = {
  dark: { bg: "#0F172A", surface: "#1E293B", surfaceAlt: "#1E293B", border: "#334155", text: "#F8FAFC", body: "#CBD5E1", muted: "#64748B", accent: "#3B82F6", cta: "#FF5B1D", red: "#EF4444", stat: "#3B82F6" },
  light: { bg: "#FFFFFF", surface: "#F9FAFB", surfaceAlt: "#F9FAFB", border: "#E5E7EB", text: "#111827", body: "#374151", muted: "#6B7280", accent: "#1D4ED8", cta: "#FF5B1D", red: "#DC2626", stat: "#1D4ED8" },
} as const;

// ─── Visual renderer — complete rebuild with inline styles on every text element ───
function LandingPageVisualRenderer({ angleData }: { angleData: AngleContent; theme?: ThemeKey; assets?: CoachAssets }) {
  const c = angleData;

  const quiz = (() => { if (!c.quizSection) return null; if (typeof c.quizSection === "string") { try { return JSON.parse(c.quizSection); } catch { return null; } } return c.quizSection as QuizSection; })();
  const testimonials = (() => { if (!c.testimonials) return []; if (typeof c.testimonials === "string") { try { return JSON.parse(c.testimonials as string); } catch { return []; } } return Array.isArray(c.testimonials) ? c.testimonials : []; })();
  const outline = (() => { if (!c.consultationOutline) return []; if (typeof c.consultationOutline === "string") { try { return JSON.parse(c.consultationOutline as string); } catch { return []; } } return Array.isArray(c.consultationOutline) ? c.consultationOutline : []; })();

  // Font constant — applied to EVERY text element to override global Fraunces/serif CSS rules
  const F = "Inter, system-ui, sans-serif";

  return (
    <div style={{ fontFamily: F, background: "#1a1a1a", color: "#fff", borderRadius: "16px", overflow: "hidden" }}>
      <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: "64px" }}>

        {/* 1. Hero */}
        {(isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) && (
          <section style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
            {isValid(c.eyebrowHeadline) && <p style={{ fontFamily: F, color: "#ff3366", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{c.eyebrowHeadline}</p>}
            {isValid(c.mainHeadline) && <h1 style={{ fontFamily: F, fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, lineHeight: 1.15, margin: 0, fontStyle: "normal" }}>{c.mainHeadline}</h1>}
            {isValid(c.subheadline) && <p style={{ fontFamily: F, fontSize: "18px", color: "#d1d5db", maxWidth: "48rem", margin: 0 }}>{c.subheadline}</p>}
            {isValid(c.primaryCta) && <button style={{ fontFamily: F, background: "#8B5CF6", color: "#fff", border: "none", borderRadius: "8px", padding: "14px 32px", fontSize: "18px", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}>{c.primaryCta}</button>}
          </section>
        )}

        {/* 2. As Seen In */}
        {isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) && (
          <section style={{ borderTop: "1px solid #374151", borderBottom: "1px solid #374151", padding: "32px 0" }}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>As Seen In</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
              {c.asSeenIn.map((logo, i) => <span key={i} style={{ fontFamily: F, color: "#9ca3af", fontWeight: 600, fontSize: "16px", fontStyle: "normal" }}>{String(logo)}</span>)}
            </div>
          </section>
        )}

        {/* 3. Quiz */}
        {quiz && isValid(quiz.question) && (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "24px", fontWeight: 700, fontStyle: "normal", marginBottom: "20px" }}>{quiz.question}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {(quiz.options ?? []).map((opt: string, i: number) => (
                <div key={i} style={{ background: "#2a2a2a", border: "1px solid #374151", borderRadius: "8px", padding: "14px 16px" }}>
                  <span style={{ fontWeight: 600, marginRight: "10px" }}>{String.fromCharCode(65 + i)}.</span>{opt}
                </div>
              ))}
            </div>
            {isValid(quiz.answer) && (
              <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid #8B5CF6", borderRadius: "8px", padding: "14px 16px" }}>
                <p style={{ fontFamily: F, color: "#8B5CF6", fontWeight: 600, margin: 0, fontStyle: "normal" }}>Answer: {quiz.answer}</p>
              </div>
            )}
          </section>
        )}

        {/* 4. Problem Agitation */}
        {isValid(c.problemAgitation) && (() => { try { const { heading, body } = splitHeadingBody(c.problemAgitation); return (
          <section>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", textAlign: "center", marginBottom: "24px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 5. Solution Introduction */}
        {isValid(c.solutionIntro) && (() => { try { const { heading, body } = splitHeadingBody(c.solutionIntro); return (
          <section style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.2), rgba(131,24,67,0.2))", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 6. Why Old Methods Fail */}
        {isValid(c.whyOldFail) && (() => { try { const { heading, body } = splitHeadingBody(c.whyOldFail); return (
          <section>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", textAlign: "center", color: "#ff3366", marginBottom: "24px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 7. Unique Mechanism */}
        {isValid(c.uniqueMechanism) && (() => { try { const { heading, body } = splitHeadingBody(c.uniqueMechanism); return (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", color: "#8B5CF6", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 8. Testimonials */}
        {testimonials.length > 0 && (
          <section>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", textAlign: "center", marginBottom: "32px" }}>What Our Clients Say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {testimonials.map((t: TestimonialItem, i: number) => (
                <div key={i} style={{ background: "#222222", border: "1px solid #374151", borderRadius: "12px", padding: "24px" }}>
                  {t.headline && <h3 style={{ fontFamily: F, color: "#8B5CF6", fontSize: "18px", fontWeight: 700, fontStyle: "normal", marginBottom: "12px" }}>{t.headline}</h3>}
                  {t.quote && <p style={{ fontFamily: F, color: "#d1d5db", fontStyle: "italic", marginBottom: "12px", lineHeight: 1.6 }}>"{t.quote}"</p>}
                  <p style={{ fontFamily: F, fontWeight: 600, margin: "0 0 2px", fontSize: "14px", fontStyle: "normal" }}>{t.name ?? ""}</p>
                  <p style={{ fontFamily: F, color: "#9ca3af", fontSize: "13px", margin: 0, fontStyle: "normal" }}>{t.location ?? ""}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Insider Advantages */}
        {isValid(c.insiderAdvantages) && (() => { try { const { heading, body } = splitHeadingBody(c.insiderAdvantages); return (
          <section style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.2), rgba(30,58,138,0.2))", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 10. Scarcity / Urgency */}
        {isValid(c.scarcityUrgency) && (() => { try { const { heading, body } = splitHeadingBody(c.scarcityUrgency); return (
          <section style={{ border: "2px solid #ff3366", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", color: "#ff3366", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 11. Shocking Stat */}
        {isValid(c.shockingStat) && (() => { try {
          const statText = extractText(c.shockingStat);
          const bigNumber = statText.match(/\d+%/)?.[0] || "";
          return (
            <section style={{ textAlign: "center", padding: "32px 0" }}>
              {bigNumber && <div style={{ fontFamily: F, fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 700, color: "#ff3366", marginBottom: "12px", fontStyle: "normal" }}>{bigNumber}</div>}
              <p style={{ fontFamily: F, fontSize: "20px", color: "#d1d5db", maxWidth: "40rem", margin: "0 auto", fontStyle: "normal" }}>{statText}</p>
            </section>
          );
        } catch { return null; } })()}

        {/* 12. Time-Saving Benefit */}
        {isValid(c.timeSavingBenefit) && (() => { try { const { heading, body } = splitHeadingBody(c.timeSavingBenefit); return (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ fontFamily: F, color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px", fontStyle: "normal" }}>{p}</p>)}
          </section>
        ); } catch { return null; } })()}

        {/* 13. Consultation Outline */}
        {outline.length > 0 && (
          <section>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", textAlign: "center", marginBottom: "32px" }}>What You'll Get in Your FREE Consultation</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {outline.map((item: ConsultationItem, i: number) => (
                <div key={i} style={{ background: "#222222", border: "1px solid #374151", borderRadius: "12px", padding: "20px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: "32px", height: "32px", background: "#8B5CF6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>{i + 1}</div>
                  <div>
                    <h3 style={{ fontFamily: F, fontSize: "18px", fontWeight: 700, fontStyle: "normal", marginBottom: "6px" }}>{item.title ?? ""}</h3>
                    <p style={{ fontFamily: F, color: "#d1d5db", margin: 0, lineHeight: 1.6, fontStyle: "normal" }}>{item.description ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA */}
        {isValid(c.primaryCta) && (
          <section style={{ textAlign: "center", padding: "32px 0" }}>
            <h2 style={{ fontFamily: F, fontSize: "32px", fontWeight: 700, fontStyle: "normal", marginBottom: "20px" }}>Ready to Get Started?</h2>
            <button style={{ fontFamily: F, background: "#8B5CF6", color: "#fff", border: "none", borderRadius: "8px", padding: "16px 48px", fontSize: "20px", fontWeight: 600, cursor: "pointer", fontStyle: "normal" }}>{c.primaryCta}</button>
          </section>
        )}
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
function AngleTabContent({ content, landingPageId, angle, onAngleUpdate, isFreeTier }: {
  content: AngleContent;
  landingPageId: number;
  angle: AngleKey;
  onAngleUpdate: (newAngle: AngleContent) => void;
  isFreeTier?: boolean;
}) {
  return (
    <div>
      {SECTION_DEFS.map(s => (
        <SectionCard
          key={s.key}
          label={s.label}
          sectionKey={s.key}
          initialValue={content[s.key]}
          landingPageId={landingPageId}
          angle={angle}
          onAngleUpdate={onAngleUpdate}
          isFreeTier={isFreeTier}
        />
      ))}
    </div>
  );
}

// ─── Asset upload helpers ────────────────────────────────────────────────────
interface CoachAssets {
  headshot: string | null;
  logo: string | null;
  socialProof: string[];
}

function UploadSlot({
  label,
  imageUrl,
  onUpload,
  placeholder,
  size = 100,
}: {
  label: string;
  imageUrl: string | null;
  onUpload: (url: string) => void;
  placeholder: string;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/upload-asset", { method: "POST", body: fd, credentials: "include" });
      if (!resp.ok) throw new Error((await resp.json()).error || "Upload failed");
      const { url } = await resp.json();
      onUpload(url);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          width: size,
          height: size,
          borderRadius: "12px",
          border: "2px dashed rgba(26,22,36,0.20)",
          background: imageUrl ? "none" : "rgba(26,22,36,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: uploading ? "wait" : "pointer",
          overflow: "hidden",
          transition: "border-color 0.15s",
          position: "relative",
        }}
      >
        {uploading && <span style={{ fontSize: "12px", color: "#888" }}>…</span>}
        {!uploading && imageUrl && (
          <img src={imageUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!uploading && !imageUrl && (
          <span style={{ fontSize: "24px", color: "rgba(26,22,36,0.25)" }}>{placeholder}</span>
        )}
      </div>
      <span style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600, color: "#777", textAlign: "center" }}>{label}</span>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

function AssetUploadPanel({
  assets,
  onUpdate,
}: {
  assets: CoachAssets;
  onUpdate: (assets: CoachAssets) => void;
}) {
  const saveAsset = trpc.user.saveCoachAsset.useMutation();

  function handleHeadshot(url: string) {
    saveAsset.mutate({ assetType: "headshot", url });
    onUpdate({ ...assets, headshot: url });
  }
  function handleLogo(url: string) {
    saveAsset.mutate({ assetType: "logo", url });
    onUpdate({ ...assets, logo: url });
  }
  function handleSocialProof(url: string) {
    if (assets.socialProof.length >= 6) { toast.error("Max 6 social proof photos"); return; }
    saveAsset.mutate({ assetType: "social_proof", url });
    onUpdate({ ...assets, socialProof: [...assets.socialProof, url] });
  }

  return (
    <div style={{
      background: "#fff",
      borderRadius: "16px",
      border: "1px solid rgba(26,22,36,0.10)",
      padding: "20px 24px",
      marginBottom: "16px",
    }}>
      <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", fontWeight: 700, color: "#1A1624", margin: "0 0 4px" }}>
        Upload Your Assets for Visual Preview
      </p>
      <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#888", margin: "0 0 16px" }}>
        These appear in the visual landing page preview. Coach photo is required.
      </p>
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <UploadSlot label="Coach Photo *" imageUrl={assets.headshot} onUpload={handleHeadshot} placeholder="👤" size={110} />
        <UploadSlot label="Logo (optional)" imageUrl={assets.logo} onUpload={handleLogo} placeholder="🏷" size={90} />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", fontWeight: 600, color: "#777" }}>Social Proof (up to 6)</span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {assets.socialProof.map((url, i) => (
              <div key={i} style={{ width: "60px", height: "60px", borderRadius: "8px", overflow: "hidden" }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
            {assets.socialProof.length < 6 && (
              <UploadSlot label="" imageUrl={null} onUpload={handleSocialProof} placeholder="+" size={60} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2LandingPageResultPanel({
  landingPageId,
  isFreeTier,
  onAngleChange,
}: {
  landingPageId: number;
  isFreeTier?: boolean;
  onAngleChange?: (angle: string) => void;
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
  // Notify parent of angle changes for campaign kit selection
  useEffect(() => { onAngleChange?.(resolvedTab); }, [resolvedTab, onAngleChange]);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [previewTheme, setPreviewTheme] = useState<ThemeKey>("light");
  const [styleMode, setStyleMode] = useState<"text" | "visual">("text");
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [coachAssets, setCoachAssets] = useState<CoachAssets>({ headshot: null, logo: null, socialProof: [] });

  // Load coach profile for authority section
  const { data: coachProfile } = trpc.user.getCoachProfile.useQuery();

  // Load saved assets on mount
  const { data: savedAssets } = trpc.user.getCoachAssets.useQuery();
  useEffect(() => {
    if (!savedAssets) return;
    const headshot = savedAssets.find(a => a.assetType === "headshot")?.url ?? null;
    const logo = savedAssets.find(a => a.assetType === "logo")?.url ?? null;
    const socialProof = savedAssets.filter(a => a.assetType === "social_proof").map(a => a.url);
    setCoachAssets({ headshot, logo, socialProof });
  }, [savedAssets]);

  function parseAngle(raw: AngleContent | string | undefined): AngleContent {
    if (!raw) return {};
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
  }

  const lp = data as {
    productName?: string;
    originalAngle?: AngleContent | string;
    godfatherAngle?: AngleContent | string;
    freeAngle?: AngleContent | string;
    dollarAngle?: AngleContent | string;
  } | undefined;

  const [angles, setAngles] = useState<Record<AngleKey, AngleContent>>({
    original: {}, godfather: {}, free: {}, dollar: {},
  });

  // Sync angles state when data first loads
  const [anglesInitialized, setAnglesInitialized] = useState(false);
  if (data && lp && !anglesInitialized) {
    setAngles({
      original:  parseAngle(lp.originalAngle),
      godfather: parseAngle(lp.godfatherAngle),
      free:      parseAngle(lp.freeAngle),
      dollar:    parseAngle(lp.dollarAngle),
    });
    setAnglesInitialized(true);
  }

  function handleAngleUpdate(angleKey: AngleKey, newAngle: AngleContent) {
    setAngles(prev => ({ ...prev, [angleKey]: newAngle }));
  }

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

      {/* ── Style toggle / Visual Style lock ── */}
      {isFreeTier ? (
        <>
          {/* Locked Visual Style card for trial users */}
          <div style={{
            background: "#fff",
            borderRadius: "var(--v2-border-radius-card)",
            padding: "24px",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "12px",
          }}>
            <span style={{ fontSize: "28px" }}>🔒</span>
            <h4 style={{
              fontFamily: "var(--v2-font-heading)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "18px",
              color: "var(--v2-text-color)",
              margin: 0,
            }}>
              Visual Styles (Pro)
            </h4>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "var(--v2-text-color)",
              opacity: 0.6,
              margin: 0,
            }}>
              Upgrade to Pro to unlock visual styles.
            </p>
            <a
              href="/pricing?utm_source=app&utm_medium=quota_gate&utm_campaign=visual-styles"
              style={{
                display: "inline-block",
                background: "var(--v2-primary-btn)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--v2-border-radius-pill)",
                padding: "10px 28px",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 700,
                fontSize: "14px",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Upgrade to Pro
            </a>
          </div>
          {/* Text preview button for trial */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              onClick={() => { setStyleMode("text"); setViewMode("preview"); }}
              style={{
                background: "#1A1624", color: "#F5F1EA", border: "none", borderRadius: "9999px",
                padding: "9px 22px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "13px",
                cursor: "pointer", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              Open Preview
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Style toggle for Pro/Agency */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "rgba(26,22,36,0.07)", borderRadius: "9999px", padding: "4px", width: "fit-content" }}>
            <button
              onClick={() => setStyleMode("text")}
              style={{
                borderRadius: "9999px", padding: "8px 18px", fontFamily: "var(--v2-font-body)", fontWeight: 600, fontSize: "13px", border: "none", cursor: "pointer",
                background: styleMode === "text" ? "#fff" : "transparent",
                color: styleMode === "text" ? "#1A1624" : "rgba(26,22,36,0.50)",
                boxShadow: styleMode === "text" ? "0 1px 6px rgba(26,22,36,0.10)" : "none",
                transition: "all 0.18s",
              }}
            >
              📝 Text Style
            </button>
            <button
              onClick={() => setStyleMode("visual")}
              style={{
                borderRadius: "9999px", padding: "8px 18px", fontFamily: "var(--v2-font-body)", fontWeight: 600, fontSize: "13px", border: "none", cursor: "pointer",
                background: styleMode === "visual" ? "#fff" : "transparent",
                color: styleMode === "visual" ? "#1A1624" : "rgba(26,22,36,0.50)",
                boxShadow: styleMode === "visual" ? "0 1px 6px rgba(26,22,36,0.10)" : "none",
                transition: "all 0.18s",
              }}
            >
              🖼 Visual Style
            </button>
          </div>

          {/* Asset upload panel (Visual Style) */}
          {styleMode === "visual" && (
            <>
              <AssetUploadPanel assets={coachAssets} onUpdate={setCoachAssets} />
              {coachProfile?.coachBackground && coachProfile.coachBackground.trim().length > 0 && coachProfile.coachBackground.trim().length < 80 && (
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#FF5B1D", margin: "0 0 12px" }}>
                  Tip: Add your results and credentials for a stronger bio (aim for 80+ characters)
                </p>
              )}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button
                  onClick={() => {
                    if (!coachAssets.headshot) { toast.error("Upload a coach photo first"); return; }
                    setStyleMode("visual");
                    setViewMode("preview");
                  }}
                  style={{
                    background: coachAssets.headshot ? "#FF5B1D" : "rgba(26,22,36,0.15)",
                    color: coachAssets.headshot ? "#fff" : "#999",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "10px 24px",
                    fontFamily: "var(--v2-font-body)",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: coachAssets.headshot ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  🖼 Preview Visual Page
                </button>
              </div>
            </>
          )}

          {/* Open Preview (Text Style) */}
          {styleMode === "text" && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={() => { setStyleMode("text"); setViewMode("preview"); }}
                style={{
                  background: "#1A1624", color: "#F5F1EA", border: "none", borderRadius: "9999px",
                  padding: "9px 22px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "13px",
                  cursor: "pointer", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: "6px",
                }}
              >
                Open Preview
              </button>
            </div>
          )}
        </>
      )}

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

      {/* ── Edit content (Text Style only) ── */}
      {styleMode === "text" && <AngleTabContent
        key={resolvedTab}
        content={angles[resolvedTab]}
        landingPageId={landingPageId}
        angle={resolvedTab}
        onAngleUpdate={(newAngle) => handleAngleUpdate(resolvedTab, newAngle)}
        isFreeTier={isFreeTier}
      />}

      {/* ── Full-screen preview modal ── */}
      {viewMode === "preview" && (
        <div className="lp-preview-reset" style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999,
          overflowY: "auto",
          background: THEMES[previewTheme].bg,
        }}>
          {/* Modal top bar — angle tabs + theme + close */}
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 10000,
            background: previewTheme === "dark" ? "rgba(11,17,32,0.92)" : "rgba(250,250,248,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${THEMES[previewTheme].border}`,
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}>
            {/* Logo + Angle tabs */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              {coachAssets.logo && <img src={coachAssets.logo} alt="Logo" style={{ height: "40px", objectFit: "contain", flexShrink: 0 }} />}
              {ANGLE_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    background: resolvedTab === tab.key ? (previewTheme === "dark" ? "#F1F5F9" : "#1A1624") : "transparent",
                    color: resolvedTab === tab.key ? (previewTheme === "dark" ? "#0B1120" : "#F5F1EA") : THEMES[previewTheme].textMuted,
                    border: `1px solid ${resolvedTab === tab.key ? "transparent" : THEMES[previewTheme].border}`,
                    borderRadius: "9999px",
                    padding: "6px 16px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Theme + close */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => setPreviewTheme(previewTheme === "dark" ? "light" : "dark")}
                style={{
                  background: "rgba(128,128,128,0.15)",
                  color: THEMES[previewTheme].textMuted,
                  border: "none",
                  borderRadius: "9999px",
                  padding: "6px 14px",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {previewTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button
                onClick={() => setViewMode("edit")}
                style={{
                  background: "rgba(128,128,128,0.2)",
                  color: THEMES[previewTheme].text,
                  border: "none",
                  borderRadius: "9999px",
                  padding: "6px 16px",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ✕ Close Preview
              </button>
            </div>
          </div>
          {/* Renderer content — strictly separated by styleMode */}
          {styleMode === "text" && (
            <LandingPageVisualRenderer angleData={angles[resolvedTab]} theme={previewTheme} assets={coachAssets} />
          )}
          {styleMode === "visual" && (
            <LandingPageVisualTemplate
              angleData={angles[resolvedTab]}
              headshot={coachAssets.headshot}
              logo={coachAssets.logo}
              socialProof={coachAssets.socialProof}
              coachName={coachProfile?.coachName || undefined}
              coachBackground={coachProfile?.coachBackground || undefined}
              serviceDescription={(data as any)?.productDescription || undefined}
              primaryColor="#FE4500"
              offerAngle={resolvedTab === "original" ? undefined : resolvedTab}
            />
          )}
        </div>
      )}

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
      <ExportButtons content={formatLandingPageTxt(data, "original")} serviceName="Landing_Page" nodeName="Landing_Page" showPdf={true} isFreeTier={false} />
    </div>
  );
}
