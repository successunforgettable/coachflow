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

// ─── Visual preview renderer (ported from V1 LandingPageDetail) ──────────────
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

function LandingPageVisualRenderer({ angleData }: { angleData: AngleContent }) {
  const c = angleData;
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

  const s: React.CSSProperties = { fontFamily: "Inter, system-ui, sans-serif" };

  return (
    <div style={{ ...s, background: "#1a1a1a", color: "#fff", borderRadius: "16px", overflow: "hidden" }}>
      <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: "64px" }}>

        {/* 1. Hero */}
        {(isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) && (
          <section style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
            {isValid(c.eyebrowHeadline) && <p style={{ color: "#ff3366", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{c.eyebrowHeadline}</p>}
            {isValid(c.mainHeadline) && <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, lineHeight: 1.15, margin: 0 }}>{c.mainHeadline}</h1>}
            {isValid(c.subheadline) && <p style={{ fontSize: "18px", color: "#d1d5db", maxWidth: "48rem", margin: 0 }}>{c.subheadline}</p>}
            {isValid(c.primaryCta) && <button style={{ background: "#8B5CF6", color: "#fff", border: "none", borderRadius: "8px", padding: "14px 32px", fontSize: "18px", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}>{c.primaryCta}</button>}
          </section>
        )}

        {/* 2. As Seen In */}
        {isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) && (
          <section style={{ borderTop: "1px solid #374151", borderBottom: "1px solid #374151", padding: "32px 0" }}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>As Seen In</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
              {c.asSeenIn.map((logo, i) => <span key={i} style={{ color: "#9ca3af", fontWeight: 600, fontSize: "16px" }}>{String(logo)}</span>)}
            </div>
          </section>
        )}

        {/* 3. Quiz */}
        {quiz && isValid(quiz.question) && (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "20px" }}>{quiz.question}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {(quiz.options ?? []).map((opt: string, i: number) => (
                <div key={i} style={{ background: "#2a2a2a", border: "1px solid #374151", borderRadius: "8px", padding: "14px 16px" }}>
                  <span style={{ fontWeight: 600, marginRight: "10px" }}>{String.fromCharCode(65 + i)}.</span>{opt}
                </div>
              ))}
            </div>
            {isValid(quiz.answer) && (
              <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid #8B5CF6", borderRadius: "8px", padding: "14px 16px" }}>
                <p style={{ color: "#8B5CF6", fontWeight: 600, margin: 0 }}>Answer: {quiz.answer}</p>
              </div>
            )}
          </section>
        )}

        {/* 4. Problem Agitation */}
        {isValid(c.problemAgitation) && (() => { const { heading, body } = splitHeadingBody(c.problemAgitation); return (
          <section>
            <h2 style={{ fontSize: "32px", fontWeight: 700, textAlign: "center", marginBottom: "24px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 5. Solution Introduction */}
        {isValid(c.solutionIntro) && (() => { const { heading, body } = splitHeadingBody(c.solutionIntro); return (
          <section style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.2), rgba(131,24,67,0.2))", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 6. Why Old Methods Fail */}
        {isValid(c.whyOldFail) && (() => { const { heading, body } = splitHeadingBody(c.whyOldFail); return (
          <section>
            <h2 style={{ fontSize: "32px", fontWeight: 700, textAlign: "center", color: "#ff3366", marginBottom: "24px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 7. Unique Mechanism */}
        {isValid(c.uniqueMechanism) && (() => { const { heading, body } = splitHeadingBody(c.uniqueMechanism); return (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, color: "#8B5CF6", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 8. Testimonials */}
        {testimonials.length > 0 && (
          <section>
            <h2 style={{ fontSize: "32px", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>What Our Clients Say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {testimonials.map((t: TestimonialItem, i: number) => (
                <div key={i} style={{ background: "#222222", border: "1px solid #374151", borderRadius: "12px", padding: "24px" }}>
                  {t.headline && <h3 style={{ color: "#8B5CF6", fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>{t.headline}</h3>}
                  {t.quote && <p style={{ color: "#d1d5db", fontStyle: "italic", marginBottom: "12px", lineHeight: 1.6 }}>"{t.quote}"</p>}
                  <p style={{ fontWeight: 600, margin: "0 0 2px", fontSize: "14px" }}>{t.name ?? ""}</p>
                  <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>{t.location ?? ""}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Insider Advantages */}
        {isValid(c.insiderAdvantages) && (() => { const { heading, body } = splitHeadingBody(c.insiderAdvantages); return (
          <section style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.2), rgba(30,58,138,0.2))", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 10. Scarcity / Urgency */}
        {isValid(c.scarcityUrgency) && (() => { const { heading, body } = splitHeadingBody(c.scarcityUrgency); return (
          <section style={{ border: "2px solid #ff3366", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, color: "#ff3366", marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 11. Shocking Stat */}
        {isValid(c.shockingStat) && (
          <section style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 700, color: "#ff3366", marginBottom: "12px" }}>
              {(c.shockingStat as string).match(/\d+%/)?.[0] || ""}
            </div>
            <p style={{ fontSize: "20px", color: "#d1d5db", maxWidth: "40rem", margin: "0 auto" }}>{c.shockingStat}</p>
          </section>
        )}

        {/* 12. Time-Saving Benefit */}
        {isValid(c.timeSavingBenefit) && (() => { const { heading, body } = splitHeadingBody(c.timeSavingBenefit); return (
          <section style={{ background: "#222222", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px" }}>{heading}</h2>
            {body.map((p, i) => <p key={i} style={{ color: "#d1d5db", fontSize: "18px", lineHeight: 1.7, margin: "0 0 16px" }}>{p}</p>)}
          </section>
        ); })()}

        {/* 13. Consultation Outline */}
        {outline.length > 0 && (
          <section>
            <h2 style={{ fontSize: "32px", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>What You'll Get in Your FREE Consultation</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {outline.map((item: ConsultationItem, i: number) => (
                <div key={i} style={{ background: "#222222", border: "1px solid #374151", borderRadius: "12px", padding: "20px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: "32px", height: "32px", background: "#8B5CF6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>{i + 1}</div>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>{item.title ?? ""}</h3>
                    <p style={{ color: "#d1d5db", margin: 0, lineHeight: 1.6 }}>{item.description ?? ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA */}
        {isValid(c.primaryCta) && (
          <section style={{ textAlign: "center", padding: "32px 0" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "20px" }}>Ready to Get Started?</h2>
            <button style={{ background: "#8B5CF6", color: "#fff", border: "none", borderRadius: "8px", padding: "16px 48px", fontSize: "20px", fontWeight: 600, cursor: "pointer" }}>{c.primaryCta}</button>
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

      {/* ── Edit / Preview toggle ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <TabPill label="Edit" active={viewMode === "edit"} onClick={() => setViewMode("edit")} />
        <TabPill label="Preview" active={viewMode === "preview"} onClick={() => setViewMode("preview")} />
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
        <LandingPageVisualRenderer angleData={angles[resolvedTab]} />
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
