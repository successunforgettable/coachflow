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
}: {
  label: string;
  sectionKey: keyof AngleContent;
  initialValue: unknown;
  landingPageId: number;
  angle: AngleKey;
  onAngleUpdate: (newAngle: AngleContent) => void;
}) {
  const textValue = serializeValue(initialValue);
  const [value, setValue] = useState(textValue);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

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
        <button
          onClick={() => setRegenOpen(p => !p)}
          style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
          title="Regenerate"
        >
          ↺
        </button>
      </div>
      {regenOpen && (
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

// ─── Theme tokens (V1 colours exactly) ───────────────────────────────────────
type ThemeKey = "dark" | "light";
const THEMES = {
  dark: { bg: "#1a1a1a", surface: "#222222", surfaceAlt: "#2a2a2a", border: "#374151", text: "#ffffff", body: "#d1d5db", muted: "#9ca3af", purple: "#8B5CF6", red: "#ff3366", purpleGradFrom: "rgba(88,28,135,0.2)", purpleGradTo: "rgba(131,24,67,0.2)", greenGradFrom: "rgba(6,78,59,0.2)", blueGradTo: "rgba(30,58,138,0.2)" },
  light: { bg: "#FFFFFF", surface: "#F9FAFB", surfaceAlt: "#F3F4F6", border: "#E5E7EB", text: "#111827", body: "#4B5563", muted: "#6B7280", purple: "#7C3AED", red: "#DC2626", purpleGradFrom: "rgba(139,92,246,0.06)", purpleGradTo: "rgba(236,72,153,0.04)", greenGradFrom: "rgba(16,185,129,0.06)", blueGradTo: "rgba(59,130,246,0.04)" },
} as const;

// ─── Visual renderer (extracted from V1 LandingPageDetail.tsx) ───────────────
function LandingPageVisualRenderer({ angleData, theme }: { angleData: AngleContent; theme: ThemeKey }) {
  const c = angleData;
  const t = THEMES[theme];
  const font = "Inter, system-ui, sans-serif";

  // Parse complex fields safely
  const quiz = (() => {
    if (!c.quizSection) return null;
    if (typeof c.quizSection === "string") { try { return JSON.parse(c.quizSection); } catch { return null; } }
    return c.quizSection as QuizSection;
  })();
  const testimonials = (() => {
    if (!c.testimonials) return [];
    if (typeof c.testimonials === "string") { try { return JSON.parse(c.testimonials as string); } catch { return []; } }
    return Array.isArray(c.testimonials) ? c.testimonials : [];
  })();
  const outline = (() => {
    if (!c.consultationOutline) return [];
    if (typeof c.consultationOutline === "string") { try { return JSON.parse(c.consultationOutline as string); } catch { return []; } }
    return Array.isArray(c.consultationOutline) ? c.consultationOutline : [];
  })();

  // V1-style heading/body split — handles both string and {headline, content} objects
  function getHeadingBody(val: unknown): { heading: string; body: string[] } | null {
    if (!isValid(val)) return null;
    const text = extractText(val);
    const lines = text.split("\n").filter((l: string) => l.trim());
    if (!lines.length) return null;
    return { heading: lines[0], body: lines.slice(1) };
  }

  // Styles matching V1 exactly
  const bodyTextStyle: React.CSSProperties = { fontFamily: font, fontSize: "18px", lineHeight: 1.7, color: t.body, fontWeight: 400, fontStyle: "normal", textAlign: "left" };
  const sectionGap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };

  return (
    <div style={{ fontFamily: font, background: t.bg, color: t.text, minHeight: "100vh" }}>
      <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: "64px" }}>

        {/* 1. Hero — eyebrow + headline + subheadline + CTA */}
        {(isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) && (
          <section style={{ textAlign: "center", ...sectionGap, alignItems: "center" }}>
            {isValid(c.eyebrowHeadline) && <p style={{ fontFamily: font, color: t.red, fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{c.eyebrowHeadline}</p>}
            {isValid(c.mainHeadline) && <h1 style={{ fontFamily: font, fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, lineHeight: 1.1, margin: 0 }}>{c.mainHeadline}</h1>}
            {isValid(c.subheadline) && <p style={{ fontFamily: font, fontSize: "20px", color: t.body, maxWidth: "48rem", margin: 0, fontWeight: 400 }}>{c.subheadline}</p>}
            {isValid(c.primaryCta) && <button style={{ fontFamily: font, background: t.purple, color: "#fff", border: "none", borderRadius: "8px", padding: "14px 32px", fontSize: "18px", fontWeight: 600, cursor: "pointer" }}>{c.primaryCta}</button>}
          </section>
        )}

        {/* 2. As Seen In */}
        {isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) && (
          <section style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "32px 0" }}>
            <p style={{ fontFamily: font, textAlign: "center", color: t.muted, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "24px" }}>As Seen In</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
              {c.asSeenIn.map((logo, i) => <span key={i} style={{ fontFamily: font, color: t.muted, fontWeight: 600, fontSize: "18px" }}>{String(logo)}</span>)}
            </div>
          </section>
        )}

        {/* 3. Quiz Section */}
        {quiz && isValid(quiz.question) && (
          <section style={{ background: t.surface, borderRadius: "16px", padding: "32px 48px" }}>
            <h2 style={{ fontFamily: font, fontSize: "28px", fontWeight: 700, marginBottom: "20px" }}>{quiz.question}</h2>
            <div style={{ ...sectionGap, gap: "12px", marginBottom: "20px" }}>
              {(quiz.options ?? []).map((opt: string, i: number) => (
                <div key={i} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "14px 16px", fontFamily: font, fontSize: "16px", color: t.body, cursor: "pointer" }}>
                  <span style={{ fontWeight: 600, marginRight: "12px" }}>{String.fromCharCode(65 + i)}.</span>{opt}
                </div>
              ))}
            </div>
            {isValid(quiz.answer) && (
              <div style={{ background: theme === "dark" ? "rgba(139,92,246,0.1)" : "rgba(124,58,237,0.06)", border: `1px solid ${t.purple}`, borderRadius: "8px", padding: "14px 16px" }}>
                <p style={{ fontFamily: font, color: t.purple, fontWeight: 600, margin: 0 }}>Answer: {quiz.answer}</p>
              </div>
            )}
          </section>
        )}

        {/* 4. Problem Agitation */}
        {(() => { const hb = getHeadingBody(c.problemAgitation); return hb && (
          <section style={sectionGap}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 5. Solution Introduction */}
        {(() => { const hb = getHeadingBody(c.solutionIntro); return hb && (
          <section style={{ background: `linear-gradient(135deg, ${t.purpleGradFrom}, ${t.purpleGradTo})`, borderRadius: "16px", padding: "32px 48px", ...sectionGap }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700 }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 6. Why Old Methods Fail */}
        {(() => { const hb = getHeadingBody(c.whyOldFail); return hb && (
          <section style={sectionGap}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, textAlign: "center", color: t.red, marginBottom: "8px" }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 7. Unique Mechanism */}
        {(() => { const hb = getHeadingBody(c.uniqueMechanism); return hb && (
          <section style={{ background: t.surface, borderRadius: "16px", padding: "32px 48px", ...sectionGap }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, color: t.purple }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 8. Testimonials */}
        {testimonials.length > 0 && (
          <section>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>What Our Clients Say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {testimonials.map((tm: TestimonialItem, i: number) => (
                <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {tm.headline && <h3 style={{ fontFamily: font, color: t.purple, fontSize: "20px", fontWeight: 700, margin: 0 }}>{tm.headline}</h3>}
                  {tm.quote && <p style={{ fontFamily: font, color: t.body, fontStyle: "italic", fontSize: "16px", lineHeight: 1.65, margin: 0 }}>"{tm.quote}"</p>}
                  <div style={{ marginTop: "auto" }}>
                    <p style={{ fontFamily: font, fontWeight: 600, fontSize: "14px", margin: "0 0 2px", color: t.text }}>{tm.name ?? ""}</p>
                    <p style={{ fontFamily: font, fontSize: "14px", color: t.muted, margin: 0 }}>{tm.location ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Insider Advantages */}
        {(() => { const hb = getHeadingBody(c.insiderAdvantages); return hb && (
          <section style={{ background: `linear-gradient(135deg, ${t.greenGradFrom}, ${t.blueGradTo})`, borderRadius: "16px", padding: "32px 48px", ...sectionGap }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700 }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 10. Scarcity / Urgency */}
        {(() => { const hb = getHeadingBody(c.scarcityUrgency); return hb && (
          <section style={{ border: `2px solid ${t.red}`, borderRadius: "16px", padding: "32px 48px", ...sectionGap }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, color: t.red }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 11. Shocking Statistic */}
        {isValid(c.shockingStat) && (() => {
          const statText = extractText(c.shockingStat);
          const bigNumber = statText.match(/\d+%/)?.[0] || "";
          return (
            <section style={{ textAlign: "center", padding: "32px 0" }}>
              {bigNumber && <div style={{ fontFamily: font, fontSize: "clamp(48px, 8vw, 72px)", fontWeight: 700, color: t.red, marginBottom: "12px" }}>{bigNumber}</div>}
              <p style={{ fontFamily: font, fontSize: "20px", color: t.body, maxWidth: "40rem", margin: "0 auto", lineHeight: 1.7, fontWeight: 400 }}>{statText}</p>
            </section>
          );
        })()}

        {/* 12. Time-Saving Benefit */}
        {(() => { const hb = getHeadingBody(c.timeSavingBenefit); return hb && (
          <section style={{ background: t.surface, borderRadius: "16px", padding: "32px 48px", ...sectionGap }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700 }}>{hb.heading}</h2>
            {hb.body.map((p, i) => <p key={i} style={bodyTextStyle}>{p}</p>)}
          </section>
        ); })()}

        {/* 13. Consultation Outline */}
        {outline.length > 0 && (
          <section>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>What You'll Get in Your FREE Consultation</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {outline.map((item: ConsultationItem, i: number) => (
                <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "20px 24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: "32px", height: "32px", background: t.purple, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, fontWeight: 700, fontSize: "14px", color: "#fff" }}>{i + 1}</div>
                  <div>
                    <h3 style={{ fontFamily: font, fontSize: "20px", fontWeight: 700, marginBottom: "6px", color: t.text }}>{item.title ?? ""}</h3>
                    <p style={{ fontFamily: font, color: t.body, margin: 0, lineHeight: 1.65, fontSize: "16px", fontWeight: 400 }}>{item.description ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA */}
        {isValid(c.primaryCta) && (
          <section style={{ textAlign: "center", padding: "32px 0" }}>
            <h2 style={{ fontFamily: font, fontSize: "36px", fontWeight: 700, marginBottom: "24px" }}>Ready to Get Started?</h2>
            <button style={{ fontFamily: font, background: t.purple, color: "#fff", border: "none", borderRadius: "8px", padding: "16px 48px", fontSize: "20px", fontWeight: 600, cursor: "pointer" }}>{c.primaryCta}</button>
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
function AngleTabContent({ content, landingPageId, angle, onAngleUpdate }: {
  content: AngleContent;
  landingPageId: number;
  angle: AngleKey;
  onAngleUpdate: (newAngle: AngleContent) => void;
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
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2LandingPageResultPanel({
  landingPageId,
}: {
  landingPageId: number;
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
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [previewTheme, setPreviewTheme] = useState<ThemeKey>("dark");

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

      {/* ── Open Preview button ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
        <button
          onClick={() => setViewMode("preview")}
          style={{
            background: "#1A1624",
            color: "#F5F1EA",
            border: "none",
            borderRadius: "9999px",
            padding: "9px 22px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "0.01em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Open Preview
        </button>
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

      {/* ── Edit content ── */}
      <AngleTabContent
        key={resolvedTab}
        content={angles[resolvedTab]}
        landingPageId={landingPageId}
        angle={resolvedTab}
        onAngleUpdate={(newAngle) => handleAngleUpdate(resolvedTab, newAngle)}
      />

      {/* ── Full-screen preview modal ── */}
      {viewMode === "preview" && (
        <div style={{
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
            {/* Angle tabs */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
          {/* Renderer content */}
          <LandingPageVisualRenderer angleData={angles[resolvedTab]} theme={previewTheme} />
        </div>
      )}

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
