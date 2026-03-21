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

// ─── Theme tokens ────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#0B1120", surface: "#131B2E", surfaceAlt: "#1A2540", border: "#1E3050",
    text: "#F1F5F9", textMuted: "#94A3B8", textSecondary: "#CBD5E1",
    accent: "#F97316", accentHover: "#FB923C", trust: "#0EA5E9",
    danger: "#EF4444", gradient1: "rgba(14,165,233,0.08)", gradient2: "rgba(249,115,22,0.06)",
  },
  light: {
    bg: "#FAFAF8", surface: "#FFFFFF", surfaceAlt: "#F5F3EF", border: "#E8E4DC",
    text: "#1A1A1A", textMuted: "#6B7280", textSecondary: "#4B5563",
    accent: "#F97316", accentHover: "#EA580C", trust: "#0369A1",
    danger: "#DC2626", gradient1: "rgba(14,165,233,0.05)", gradient2: "rgba(249,115,22,0.04)",
  },
} as const;

type ThemeKey = "dark" | "light";

const GOOGLE_FONTS_CSS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Montserrat:wght@300;400;500;600;700&display=swap');`;

// ─── Visual renderer ────────────────────────────────────────────────────────
function LandingPageVisualRenderer({ angleData, theme }: { angleData: AngleContent; theme: ThemeKey }) {
  const c = angleData;
  const t = THEMES[theme];
  const hd = "'Cormorant', Georgia, serif"; // display heading
  const bd = "'Montserrat', system-ui, sans-serif"; // body

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

  // Reusable section heading
  const H2 = ({ children, center, color }: { children: React.ReactNode; center?: boolean; color?: string }) => (
    <h2 style={{ fontFamily: hd, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", color: color ?? t.text, textAlign: center ? "center" : "left", margin: "0 0 24px" }}>{children}</h2>
  );
  // Reusable body paragraph
  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontFamily: bd, fontSize: "16px", lineHeight: 1.75, color: t.textSecondary, margin: "0 0 16px", textAlign: "left" }}>{children}</p>
  );
  // Card wrapper
  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "36px 32px", ...style }}>{children}</div>
  );

  return (
    <>
      <style>{GOOGLE_FONTS_CSS}</style>
      <div style={{ background: t.bg, color: t.text, borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "64px 28px", display: "flex", flexDirection: "column", gap: "72px" }}>

          {/* 1. Hero */}
          {(isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) && (
            <section style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
              {isValid(c.eyebrowHeadline) && (
                <p style={{ fontFamily: bd, color: t.accent, fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>{c.eyebrowHeadline}</p>
              )}
              {isValid(c.mainHeadline) && (
                <h1 style={{ fontFamily: hd, fontSize: "clamp(32px, 5.5vw, 56px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", color: t.text, margin: 0, maxWidth: "48rem" }}>{c.mainHeadline}</h1>
              )}
              {isValid(c.subheadline) && (
                <p style={{ fontFamily: bd, fontSize: "18px", lineHeight: 1.65, color: t.textMuted, maxWidth: "40rem", margin: 0, fontWeight: 300 }}>{c.subheadline}</p>
              )}
              {isValid(c.primaryCta) && (
                <button style={{ fontFamily: bd, background: t.accent, color: "#fff", border: "none", borderRadius: "8px", padding: "16px 40px", fontSize: "16px", fontWeight: 600, cursor: "pointer", marginTop: "12px", letterSpacing: "0.02em", transition: "background 200ms" }}>{c.primaryCta}</button>
              )}
            </section>
          )}

          {/* 2. As Seen In */}
          {isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) && (
            <section style={{ borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: "28px 0" }}>
              <p style={{ fontFamily: bd, textAlign: "center", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "20px", fontWeight: 500 }}>As Seen In</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "36px" }}>
                {c.asSeenIn.map((logo, i) => <span key={i} style={{ fontFamily: hd, color: t.textMuted, fontWeight: 600, fontSize: "18px", fontStyle: "italic" }}>{String(logo)}</span>)}
              </div>
            </section>
          )}

          {/* 3. Quiz */}
          {quiz && isValid(quiz.question) && (
            <Card>
              <H2>{quiz.question}</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {(quiz.options ?? []).map((opt: string, i: number) => (
                  <div key={i} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "14px 18px", fontFamily: bd, fontSize: "15px", color: t.textSecondary, cursor: "pointer", transition: "border-color 200ms" }}>
                    <span style={{ fontWeight: 600, marginRight: "10px", color: t.trust }}>{String.fromCharCode(65 + i)}.</span>{opt}
                  </div>
                ))}
              </div>
              {isValid(quiz.answer) && (
                <div style={{ background: `${t.trust}11`, border: `1px solid ${t.trust}`, borderRadius: "10px", padding: "16px 18px" }}>
                  <p style={{ fontFamily: bd, color: t.trust, fontWeight: 600, fontSize: "15px", margin: 0, lineHeight: 1.6 }}>Answer: {quiz.answer}</p>
                </div>
              )}
            </Card>
          )}

          {/* 4. Problem Agitation */}
          {isValid(c.problemAgitation) && (() => { const { heading, body } = splitHeadingBody(c.problemAgitation); return (
            <section>
              <H2 center>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </section>
          ); })()}

          {/* 5. Solution Introduction */}
          {isValid(c.solutionIntro) && (() => { const { heading, body } = splitHeadingBody(c.solutionIntro); return (
            <Card style={{ background: `linear-gradient(135deg, ${t.gradient1}, ${t.gradient2})`, border: `1px solid ${t.trust}22` }}>
              <H2 color={t.trust}>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </Card>
          ); })()}

          {/* 6. Why Old Methods Fail */}
          {isValid(c.whyOldFail) && (() => { const { heading, body } = splitHeadingBody(c.whyOldFail); return (
            <section>
              <H2 center color={t.danger}>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </section>
          ); })()}

          {/* 7. Unique Mechanism */}
          {isValid(c.uniqueMechanism) && (() => { const { heading, body } = splitHeadingBody(c.uniqueMechanism); return (
            <Card>
              <H2 color={t.trust}>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </Card>
          ); })()}

          {/* 8. Testimonials */}
          {testimonials.length > 0 && (
            <section>
              <H2 center>What Our Clients Say</H2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
                {testimonials.map((tm: TestimonialItem, i: number) => (
                  <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "28px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {tm.headline && <p style={{ fontFamily: hd, color: t.trust, fontSize: "20px", fontWeight: 700, margin: 0 }}>{tm.headline}</p>}
                    {tm.quote && <p style={{ fontFamily: bd, color: t.textSecondary, fontStyle: "italic", fontSize: "15px", lineHeight: 1.65, margin: 0 }}>"{tm.quote}"</p>}
                    <div style={{ marginTop: "auto" }}>
                      <p style={{ fontFamily: bd, fontWeight: 600, fontSize: "14px", margin: "0 0 2px", color: t.text }}>{tm.name ?? ""}</p>
                      <p style={{ fontFamily: bd, fontSize: "13px", color: t.textMuted, margin: 0 }}>{tm.location ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 9. Insider Advantages */}
          {isValid(c.insiderAdvantages) && (() => { const { heading, body } = splitHeadingBody(c.insiderAdvantages); return (
            <Card style={{ background: `linear-gradient(135deg, ${t.gradient2}, ${t.gradient1})`, border: `1px solid ${t.trust}22` }}>
              <H2>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </Card>
          ); })()}

          {/* 10. Scarcity / Urgency */}
          {isValid(c.scarcityUrgency) && (() => { const { heading, body } = splitHeadingBody(c.scarcityUrgency); return (
            <section style={{ border: `2px solid ${t.accent}`, borderRadius: "16px", padding: "36px 32px" }}>
              <H2 color={t.accent}>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </section>
          ); })()}

          {/* 11. Shocking Stat */}
          {isValid(c.shockingStat) && (() => {
            const statText = extractText(c.shockingStat);
            const bigNumber = statText.match(/\d+%/)?.[0] || "";
            return (
              <section style={{ textAlign: "center", padding: "40px 0" }}>
                {bigNumber && <div style={{ fontFamily: hd, fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 700, color: t.accent, lineHeight: 1, marginBottom: "16px", letterSpacing: "-0.04em" }}>{bigNumber}</div>}
                <p style={{ fontFamily: bd, fontSize: "17px", color: t.textMuted, maxWidth: "36rem", margin: "0 auto", lineHeight: 1.7, fontWeight: 300 }}>{statText}</p>
              </section>
            );
          })()}

          {/* 12. Time-Saving Benefit */}
          {isValid(c.timeSavingBenefit) && (() => { const { heading, body } = splitHeadingBody(c.timeSavingBenefit); return (
            <Card>
              <H2>{heading}</H2>
              {body.map((p, i) => <P key={i}>{p}</P>)}
            </Card>
          ); })()}

          {/* 13. Consultation Outline */}
          {outline.length > 0 && (
            <section>
              <H2 center>What You'll Get</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {outline.map((item: ConsultationItem, i: number) => (
                  <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "22px 24px", display: "flex", gap: "18px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "36px", height: "36px", background: t.accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: bd, fontWeight: 700, fontSize: "14px", color: "#fff" }}>{i + 1}</div>
                    <div>
                      <h3 style={{ fontFamily: hd, fontSize: "20px", fontWeight: 700, marginBottom: "6px", color: t.text }}>{item.title ?? ""}</h3>
                      <p style={{ fontFamily: bd, color: t.textSecondary, margin: 0, lineHeight: 1.65, fontSize: "15px" }}>{item.description ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Final CTA */}
          {isValid(c.primaryCta) && (
            <section style={{ textAlign: "center", padding: "48px 0 16px" }}>
              <h2 style={{ fontFamily: hd, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", color: t.text, marginBottom: "24px" }}>Ready to Transform Your Results?</h2>
              <button style={{ fontFamily: bd, background: t.accent, color: "#fff", border: "none", borderRadius: "8px", padding: "18px 56px", fontSize: "17px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em", transition: "background 200ms" }}>{c.primaryCta}</button>
            </section>
          )}
        </div>
      </div>
    </>
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

      {/* ── Edit / Preview toggle + theme switcher ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <TabPill label="Edit" active={viewMode === "edit"} onClick={() => setViewMode("edit")} />
        <TabPill label="Preview" active={viewMode === "preview"} onClick={() => setViewMode("preview")} />
        {viewMode === "preview" && (
          <>
            <span style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#999", marginLeft: "8px" }}>Theme:</span>
            <TabPill label="Dark" active={previewTheme === "dark"} onClick={() => setPreviewTheme("dark")} />
            <TabPill label="Light" active={previewTheme === "light"} onClick={() => setPreviewTheme("light")} />
          </>
        )}
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
      {viewMode === "edit" ? (
        <AngleTabContent
          key={resolvedTab}
          content={angles[resolvedTab]}
          landingPageId={landingPageId}
          angle={resolvedTab}
          onAngleUpdate={(newAngle) => handleAngleUpdate(resolvedTab, newAngle)}
        />
      ) : (
        <LandingPageVisualRenderer angleData={angles[resolvedTab]} theme={previewTheme} />
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
