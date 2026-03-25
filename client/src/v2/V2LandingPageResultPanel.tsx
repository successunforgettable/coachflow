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
function LandingPageVisualRenderer({ angleData, theme, assets }: { angleData: AngleContent; theme: ThemeKey; assets?: CoachAssets }) {
  const c = angleData;
  const t = THEMES[theme];
  const heading = "'Playfair Display', Georgia, serif";
  const body = "'Inter', system-ui, sans-serif";

  // Parse complex fields safely
  const quiz = (() => { try { if (!c.quizSection) return null; if (typeof c.quizSection === "string") return JSON.parse(c.quizSection); return c.quizSection as QuizSection; } catch { return null; } })();
  const testimonials = (() => { try { if (!c.testimonials) return []; if (typeof c.testimonials === "string") return JSON.parse(c.testimonials as string); return Array.isArray(c.testimonials) ? c.testimonials : []; } catch { return []; } })();
  const outline = (() => { try { if (!c.consultationOutline) return []; if (typeof c.consultationOutline === "string") return JSON.parse(c.consultationOutline as string); return Array.isArray(c.consultationOutline) ? c.consultationOutline : []; } catch { return []; } })();

  function getHB(val: unknown): { heading: string; body: string[] } | null {
    if (!isValid(val)) return null;
    const text = extractText(val);
    const lines = text.split("\n").filter((l: string) => l.trim());
    if (!lines.length) return null;
    return { heading: lines[0], body: lines.slice(1) };
  }

  // Shared inline style builders — NEVER rely on inheritance
  const h2Style: React.CSSProperties = { fontFamily: heading, fontWeight: 700, fontStyle: "normal", fontSize: "32px", lineHeight: 1.2, color: t.text, margin: "0 0 16px" };
  const bodyStyle: React.CSSProperties = { fontFamily: body, fontWeight: 400, fontStyle: "normal", fontSize: "17px", lineHeight: 1.75, color: t.body, margin: "0 0 12px" };
  const sectionStyle: React.CSSProperties = { padding: "64px 0", borderBottom: `1px solid ${t.border}` };
  const ctaBtnStyle: React.CSSProperties = { fontFamily: body, background: t.cta, color: "#fff", border: "none", borderRadius: "9999px", padding: "16px 40px", fontSize: "18px", fontWeight: 600, cursor: "pointer", display: "block", margin: "32px auto 0" };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ background: t.bg, minHeight: "100vh" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px" }}>

          {/* 1. HERO */}
          {(() => { try { return (isValid(c.eyebrowHeadline) || isValid(c.mainHeadline)) ? (
            <section style={{ padding: "80px 0 64px", borderBottom: `1px solid ${t.border}`, textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "40px", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ flex: 1, minWidth: "280px" }}>
                  {isValid(c.eyebrowHeadline) && <p style={{ fontFamily: body, color: t.cta, fontSize: "13px", fontWeight: 700, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>{c.eyebrowHeadline}</p>}
                  {isValid(c.mainHeadline) && <h1 style={{ fontFamily: heading, fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, fontStyle: "normal", lineHeight: 1.1, color: t.text, margin: "0 0 16px" }}>{c.mainHeadline}</h1>}
                  {isValid(c.subheadline) && <p style={{ fontFamily: body, fontSize: "18px", fontWeight: 400, fontStyle: "normal", color: t.body, margin: "0 0 24px", lineHeight: 1.6, maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>{c.subheadline}</p>}
                  {isValid(c.primaryCta) && <button style={ctaBtnStyle}>{c.primaryCta}</button>}
                </div>
                {assets?.headshot && (
                  <div style={{ flexShrink: 0, maxWidth: "280px", width: "100%" }}>
                    <img src={assets.headshot} alt="Coach" style={{ width: "100%", borderRadius: "16px", objectFit: "cover", maxHeight: "360px" }} />
                  </div>
                )}
              </div>
            </section>
          ) : null; } catch { return null; } })()}

          {/* Social proof photos */}
          {assets?.socialProof && assets.socialProof.length > 0 && (
            <section style={{ padding: "24px 0", overflowX: "auto" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                {assets.socialProof.map((url, i) => <img key={i} src={url} alt="" style={{ height: "100px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />)}
              </div>
            </section>
          )}

          {/* 2. AS SEEN IN */}
          {(() => { try { return isValid(c.asSeenIn) && Array.isArray(c.asSeenIn) ? (
            <section style={{ ...sectionStyle, padding: "32px 0", textAlign: "center" }}>
              <p style={{ fontFamily: body, color: t.muted, fontSize: "12px", fontWeight: 600, fontStyle: "normal", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 20px" }}>As Seen In</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px" }}>
                {c.asSeenIn.map((logo, i) => <span key={i} style={{ fontFamily: body, color: t.muted, fontWeight: 600, fontStyle: "normal", fontSize: "16px" }}>{String(logo)}</span>)}
              </div>
            </section>
          ) : null; } catch { return null; } })()}

          {/* 3. PROBLEM AGITATION */}
          {(() => { try { const hb = getHB(c.problemAgitation); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* 4. SOLUTION INTRO */}
          {(() => { try { const hb = getHB(c.solutionIntro); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: theme === "dark" ? "rgba(59,130,246,0.06)" : "rgba(29,78,216,0.04)", borderRadius: "12px", padding: "48px 32px", margin: "0 -8px" }}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* 5. WHY OLD METHODS FAIL */}
          {(() => { try { const hb = getHB(c.whyOldFail); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, color: t.red }}>{hb.heading}</h2>
              {hb.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <span style={{ fontFamily: body, color: t.red, fontSize: "18px", fontWeight: 700, fontStyle: "normal", flexShrink: 0, lineHeight: 1.75 }}>✕</span>
                  <p style={bodyStyle}>{p}</p>
                </div>
              ))}
            </section>
          ); } catch { return null; } })()}

          {/* 6. UNIQUE MECHANISM */}
          {(() => { try { const hb = getHB(c.uniqueMechanism); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: t.surface, borderRadius: "12px", padding: "48px 32px", margin: "0 -8px" }}>
              <h2 style={{ ...h2Style, color: t.accent }}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* 7. TESTIMONIALS */}
          {testimonials.length > 0 && (() => { try { return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, textAlign: "center" }}>What Our Clients Say</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "24px" }}>
                {testimonials.map((tm: TestimonialItem, i: number) => (
                  <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {tm.headline && <h3 style={{ fontFamily: heading, color: t.accent, fontSize: "18px", fontWeight: 700, fontStyle: "normal", margin: 0 }}>{tm.headline}</h3>}
                    {tm.quote && <p style={{ fontFamily: body, color: t.body, fontStyle: "italic", fontSize: "16px", fontWeight: 400, lineHeight: 1.65, margin: 0 }}>"{tm.quote}"</p>}
                    <div style={{ marginTop: "auto" }}>
                      <p style={{ fontFamily: body, fontWeight: 600, fontStyle: "normal", fontSize: "14px", margin: "0 0 2px", color: t.text }}>{tm.name ?? ""}</p>
                      <p style={{ fontFamily: body, fontSize: "13px", fontWeight: 400, fontStyle: "normal", color: t.muted, margin: 0 }}>{tm.location ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ); } catch { return null; } })()}

          {/* 8. INSIDER ADVANTAGES */}
          {(() => { try { const hb = getHB(c.insiderAdvantages); if (!hb) return null; return (
            <section style={sectionStyle}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{ fontFamily: body, color: t.accent, fontSize: "17px", fontWeight: 700, fontStyle: "normal", flexShrink: 0 }}>{i + 1}.</span>
                  <p style={bodyStyle}>{p}</p>
                </div>
              ))}
            </section>
          ); } catch { return null; } })()}

          {/* 9. SHOCKING STAT */}
          {(() => { try { if (!isValid(c.shockingStat)) return null;
            const statText = extractText(c.shockingStat);
            const bigNumber = statText.match(/\d+[%x]/)?.[0] || statText.match(/\d+/)?.[0] || "";
            return (
              <section style={{ ...sectionStyle, textAlign: "center", padding: "80px 0" }}>
                {bigNumber && <div style={{ fontFamily: heading, fontSize: "clamp(3rem, 8vw, 6rem)", fontWeight: 900, fontStyle: "normal", color: t.stat, margin: "0 0 16px", lineHeight: 1 }}>{bigNumber}</div>}
                <p style={{ fontFamily: body, fontSize: "17px", fontWeight: 400, fontStyle: "normal", color: t.body, maxWidth: "560px", margin: "0 auto", lineHeight: 1.75 }}>{statText}</p>
              </section>
            );
          } catch { return null; } })()}

          {/* 10. QUIZ */}
          {quiz && isValid(quiz.question) && (() => { try { return (
            <section style={{ ...sectionStyle, background: t.surface, borderRadius: "12px", padding: "48px 32px", margin: "0 -8px" }}>
              <h2 style={h2Style}>{quiz.question}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
                {(quiz.options ?? []).map((opt: string, i: number) => (
                  <div key={i} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "14px 16px", cursor: "pointer" }}>
                    <span style={{ fontFamily: body, fontWeight: 600, fontStyle: "normal", fontSize: "16px", color: t.text, marginRight: "12px" }}>{String.fromCharCode(65 + i)}.</span>
                    <span style={{ fontFamily: body, fontWeight: 400, fontStyle: "normal", fontSize: "16px", color: t.body }}>{opt}</span>
                  </div>
                ))}
              </div>
              {isValid(quiz.answer) && (
                <div style={{ background: theme === "dark" ? "rgba(59,130,246,0.1)" : "rgba(29,78,216,0.06)", border: `1px solid ${t.accent}`, borderRadius: "8px", padding: "14px 16px" }}>
                  <p style={{ fontFamily: body, color: t.accent, fontWeight: 600, fontStyle: "normal", fontSize: "15px", margin: 0 }}>Answer: {quiz.answer}</p>
                </div>
              )}
            </section>
          ); } catch { return null; } })()}

          {/* 11. SCARCITY / URGENCY */}
          {(() => { try { const hb = getHB(c.scarcityUrgency); if (!hb) return null; return (
            <section style={{ ...sectionStyle, border: `2px solid ${t.red}`, borderRadius: "12px", padding: "32px", margin: "64px -8px 0" }}>
              <h2 style={{ fontFamily: heading, fontWeight: 700, fontStyle: "normal", fontSize: "24px", color: t.red, margin: "0 0 12px" }}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

          {/* 12. CONSULTATION OUTLINE */}
          {outline.length > 0 && (() => { try { return (
            <section style={sectionStyle}>
              <h2 style={{ ...h2Style, textAlign: "center" }}>What You'll Get</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
                {outline.map((item: ConsultationItem, i: number) => (
                  <div key={i} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "20px 24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: "32px", height: "32px", background: t.accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: body, fontWeight: 700, fontStyle: "normal", fontSize: "14px", color: "#fff" }}>{i + 1}</span>
                    </div>
                    <div>
                      <h3 style={{ fontFamily: heading, fontSize: "18px", fontWeight: 700, fontStyle: "normal", marginBottom: "4px", color: t.text, margin: "0 0 4px" }}>{item.title ?? ""}</h3>
                      <p style={{ fontFamily: body, color: t.body, margin: 0, lineHeight: 1.65, fontSize: "15px", fontWeight: 400, fontStyle: "normal" }}>{item.description ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ); } catch { return null; } })()}

          {/* 13. FINAL CTA */}
          {isValid(c.primaryCta) && (
            <section style={{ textAlign: "center", padding: "80px 0 64px" }}>
              <h2 style={{ fontFamily: heading, fontWeight: 900, fontStyle: "normal", fontSize: "36px", color: t.text, margin: "0 0 24px" }}>Ready to Get Started?</h2>
              <button style={ctaBtnStyle}>{c.primaryCta}</button>
            </section>
          )}

          {/* Time-saving benefit — rendered if exists */}
          {(() => { try { const hb = getHB(c.timeSavingBenefit); if (!hb) return null; return (
            <section style={{ ...sectionStyle, background: t.surface, borderRadius: "12px", padding: "48px 32px", margin: "0 -8px" }}>
              <h2 style={h2Style}>{hb.heading}</h2>
              {hb.body.map((p, i) => <p key={i} style={bodyStyle}>{p}</p>)}
            </section>
          ); } catch { return null; } })()}

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
              onClick={() => setViewMode("preview")}
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
          {console.log("MODAL OPENING - styleMode:", styleMode, "previewTheme:", previewTheme)}
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
    </div>
  );
}
