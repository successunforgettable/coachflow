/**
 * V2GeneratorWizard — Sprint 4 + Error States (Sprint 6)
 *
 * Progressive disclosure component for V2 dashboard.
 * Shown when a user clicks an Active node on the path.
 *
 * Sprint 4 additions:
 * - ZappyMascot with loading / cheering / concerned states
 * - CSS animated progress ring during generation
 * - react-confetti on 100/100 Meta compliance
 * - Compliance violation list on sub-100 score
 * - MANDATORY: console.log('ZAP V2 Payload Check:', payload) before every API call
 *
 * Sprint 6 additions (error states):
 * - Scenario 1: API timeout (30s) → "timeout" status → ConcernedState
 * - Scenario 2: Mid-generation failure → "error" status → ConcernedState + Generate Again
 * - Scenario 3: Network loss during generation → "offline" status → ConcernedState + Try Again
 * - Demo params: ?demo=timeout | ?demo=error | ?demo=offline (in addition to existing ones)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import Confetti from "react-confetti";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { openSnapshotApplyTab } from "./lib/ghlSnapshot";
import { WorkflowStatusPill } from "./components/WorkflowStatusPill";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import { type WizardStep, STEP_LABELS, getNextStep } from "./v2-constants";
import V2HeadlinesResultPanel from "./V2HeadlinesResultPanel";
import V2AdCopyResultPanel from "./V2AdCopyResultPanel";
import V2ICPResultPanel from "./V2ICPResultPanel";
import V2OfferResultPanel from "./V2OfferResultPanel";
import V2UniqueMethodResultPanel from "./V2UniqueMethodResultPanel";
import V2FreeOptInResultPanel from "./V2FreeOptInResultPanel";
import V2LandingPageResultPanel from "./V2LandingPageResultPanel";
import V2EmailSequenceResultPanel from "./V2EmailSequenceResultPanel";
import V2WhatsAppResultPanel from "./V2WhatsAppResultPanel";

export type { WizardStep };

// ─── Step → milestone id mapping (used by skip feature) ──────────────────────
const STEP_TO_MILESTONE: Record<string, string> = {
  service:        "service",
  icp:            "icp",
  offer:          "offer",
  uniqueMethod:   "heroMechanism",
  freeOptIn:      "hvco",
  headlines:      "headlines",
  adCopy:         "adCopy",
  landingPage:    "landingPage",
  emailSequence:      "emailSequence",
  whatsappSequence:   "whatsappSequence",
};

// ─── Campaign ZIP download helper ────────────────────────────────────────────
function triggerZipDownload(base64: string, filename: string) {
  const blob = new Blob(
    [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
    { type: "application/zip" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Pro-gated steps (Nodes 6–11) ────────────────────────────────────────────
const PRO_GATED_STEPS: WizardStep[] = [
  "headlines",
  "adCopy",
  "landingPage",
  "emailSequence",
  "whatsappSequence",
  "pushToMeta",
];

const UTM_PATHS: Partial<Record<WizardStep, string>> = {
  headlines:        "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node6",
  adCopy:           "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node7",
  landingPage:      "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node8",
  emailSequence:    "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node9",
  whatsappSequence: "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node10",
  pushToMeta:       "/pricing?utm_source=v2_wizard&utm_medium=lock&utm_campaign=node11",
};

const LOCKED_COPY: Record<WizardStep, string> = {
  campaignType: "",
  service: "",
  icp: "",
  offer: "",
  uniqueMethod: "",
  freeOptIn: "",
  headlines:        "Your ICP is ready. Let Zappy write 25 headlines targeting exactly who you just profiled.",
  adCopy:           "Your offer and method are defined. Let Zappy turn them into Meta-compliant ad copy.",
  landingPage:      "Your ads are ready to drive traffic. Now build the page they land on.",
  emailSequence:    "Your ads are running. Now nurture the leads automatically.",
  whatsappSequence: "Close faster with a WhatsApp sequence built from your ICP.",
  pushToMeta:       "Your entire campaign is built. One click pushes everything live.",
};

// ─── Locked upgrade state component ──────────────────────────────────────────
function LockedUpgradeState({ step, navigate }: { step: WizardStep; navigate: (path: string) => void }) {
  const copy = LOCKED_COPY[step];
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "8px 0 4px",
    }}>
      <ZappyMascot state="waiting" size={90} />
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "16px",
        color: "var(--v2-text-color)",
        lineHeight: 1.55,
        margin: "20px 0 24px",
        maxWidth: "340px",
      }}>
        {copy}
      </p>
      <button
        onClick={() => navigate(UTM_PATHS[step] ?? "/pricing")}
        style={{
          display: "inline-block",
          background: "var(--v2-primary-btn)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--v2-border-radius-pill)",
          padding: "14px 32px",
          fontSize: "16px",
          fontFamily: "var(--v2-font-body)",
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.01em",
          transition: "opacity 0.18s ease",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}

// ─── Advanced field definitions per step ─────────────────────────────────────
interface AdvancedField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  sourceNote?: string;
}

const ADVANCED_FIELDS: Record<WizardStep, AdvancedField[]> = {
  campaignType: [],
  service: [],
  icp: [
    { key: "name", label: "ICP Name / Label", type: "text", placeholder: "e.g. Mid-Career Professional", sourceNote: "Auto-generated from your service avatar" },
  ],
  offer: [
    // Order matters: fieldValues default = options[0]. "premium" first so the
    // dropdown's preselected value matches both the sourceNote and today's
    // server-side default — users who don't touch Advanced see no change.
    { key: "offerType", label: "Offer Type", type: "select", options: ["premium", "standard", "vip"], sourceNote: "Defaults to 'premium'" },
  ],
  // ── Hidden until wired post-launch ──
  // The accordion toggle is gated on `advancedFields.length > 0` (see render
  // site below), so empty arrays here mean the "Advanced: Edit AI Inputs"
  // toggle disappears for these nodes. UI fields previously offered here
  // (mechanismName, applicationMethod, headlineStyle, quantity, platform,
  // adFormat, pageStyle, sequenceType, emailCount, sequenceLength, tone) were
  // collected client-side but silently dropped before reaching any LLM prompt
  // — see the audit registered in today's session. Path A (full wiring of
  // these 6 nodes) is queued post-launch; for now we hide rather than ship
  // cosmetic toggles that don't change generation output.
  uniqueMethod: [
    // Path B wire (commit 3 of Unique Method sprint).
    // application is free-text; trims+coerces empty to undefined at the
    // runGeneration read site so the server's [INSERT_APPLICATION_METHOD]
    // fallback (commit 75eecf3) fires when blank — surfaced via the
    // PlaceholderBanner installed in d5313c1.
    // descriptor options[0] = "System" matches the server's pre-commit-2
    // hardcoded default; users who don't touch Advanced see structurally
    // identical output to today's pre-commit-3 generations.
    { key: "application", label: "Application Method", type: "text", placeholder: "e.g. 6-week group coaching cohort", sourceNote: "How users apply your method. Defaults to a generic placeholder if left blank." },
    { key: "descriptor", label: "Method Type", type: "select", options: ["System", "Framework", "Method", "Strategy"], sourceNote: "What you call your method. Defaults to System." },
  ],
  freeOptIn: [
    { key: "hvcoTopic", label: "Lead Magnet Topic Override", type: "text", placeholder: "Leave blank to use AI suggestion", sourceNote: "AI generates this from your service profile" },
  ],
  headlines: [
    // Headlines wire commit 2/2 — Path B vocabulary + Choice 1 sentinel.
    // Server contract (commit 1, e572f7a): headlineStyle is z.enum of 5 keys
    // story/eyebrow/question/authority/urgency, optional. undefined → all
    // 5 formulas; specific key → 1 formula only.
    // UI: options[0] is the "All styles" sentinel that fieldValues defaults
    // to. The runGeneration branch maps friendly labels → server keys via a
    // local lookup table; "All styles..." is intentionally absent from the
    // lookup so it falls through to undefined, preserving today's all-5-
    // formulas default.
    {
      key: "headlineStyle",
      label: "Headline Style",
      type: "select",
      options: [
        "All styles (mix all 5 formulas)",
        "Story-driven (How a [Person] discovered [Result])",
        "Authority eyebrow (Three-part with credibility tag)",
        "Question-based (Hidden obstacles, mistakes)",
        "Expert-led (Authority + debunked old methods)",
        "Urgent timeframe (Action + result + days/months)",
      ],
      sourceNote: "Pick one formula or generate all 5. Defaults to all 5 styles.",
    },
  ],
  adCopy: [],
  landingPage: [
    // Commit 7: expose all 5 server enum values
    // (landingPages.ts:253). options[0] = "Sales Page" → maps to
    // "sales_page", identical to the previous default at the server schema
    // (landingPages.ts:259, .default("sales_page")).
    {
      key: "pageType",
      label: "Page Type",
      type: "select",
      options: [
        "Sales Page",
        "Webinar Registration",
        "Discovery Call Booking",
        "Lead Magnet Download",
        "Event Registration",
      ],
      sourceNote: "Pick the page structure. Defaults to Sales Page.",
    },
  ],
  emailSequence: [
    // Path B (friendly labels) — same shape as headlines's headlineStyle and
    // uniqueMethod's descriptor. Commit 7 expands the surface to all 10
    // server-side enum values (welcome / engagement / sales / nurture /
    // launch / re-engagement / discovery_call_confirmation /
    // discovery_call_reminder / event_logistics / replay_for_no_shows).
    // Friendly labels are also the option values; the runGeneration branch
    // below maps each label to its server key via SEQUENCE_TYPE_LABEL_TO_KEY.
    // options[0] = "Welcome (...)" → maps to "welcome" → users who don't
    // touch Advanced get identical output to today's hardcoded welcome path.
    {
      key: "sequenceType",
      label: "Sequence Type",
      type: "select",
      options: [
        "Welcome (3 emails over 5 days)",
        "Engagement",
        "Sales (cart-open sequence)",
        "Nurture (7 emails over 21 days)",
        "Launch (9 emails around cart-open window)",
        "Re-engagement (4 emails over 14 days)",
        "Discovery Call Confirmation",
        "Discovery Call Reminder",
        "Event Logistics",
        "Replay (for event no-shows)",
      ],
      sourceNote: "Pick the type of sequence you want. Defaults to Welcome.",
    },
  ],
  whatsappSequence: [
    // Commit 7: expose all 6 server enum values
    // (whatsappSequences.ts:711). options[0] = "Engagement" → maps to
    // "engagement", identical to the previous hardcoded value at runGeneration.
    {
      key: "sequenceType",
      label: "Sequence Type",
      type: "select",
      options: [
        "Engagement",
        "Sales (cart-open sequence)",
        "Nurture",
        "Discovery Call Confirmation",
        "Discovery Call Reminder",
        "Event Logistics",
      ],
      sourceNote: "Pick the type of sequence you want. Defaults to Engagement.",
    },
    // sequenceLength options stored as strings (HTML <select> constraint);
    // converted to numeric literal at the runGeneration read site below to
    // match the server's z.union([z.literal(3), z.literal(5), z.literal(7)])
    // schema. Order matters: fieldValues defaults to options[0] = "3", which
    // matches the server's default — users who don't touch Advanced get
    // identical output to today.
    { key: "sequenceLength", label: "Number of Messages", type: "select", options: ["3", "5", "7"], sourceNote: "Number of messages. Defaults to 3 — industry standard for WhatsApp event reminders." },
    { key: "tone", label: "Tone", type: "select", options: ["conversational", "professional", "urgent"], sourceNote: "Voice and energy of the messages. Defaults to conversational." },
  ],
  // pushToMeta also hidden — Platform select doesn't reach generation
  // (this step shows instructions, no mutation runs). Same fake-knob
  // trust-erosion pattern as the 6 above; hiding closes the audit cleanly.
  pushToMeta: [],
};

// ─── Shared card style ────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "40px 36px",
  maxWidth: "560px",
  margin: "0 auto",
  width: "100%",
};

// ─── Shared button styles ─────────────────────────────────────────────────────
const primaryBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "var(--v2-primary-btn)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--v2-border-radius-pill)",
  padding: "18px 32px",
  fontSize: "18px",
  fontFamily: "var(--v2-font-body)",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.01em",
  transition: "opacity 0.18s ease, transform 0.12s ease",
  marginBottom: "20px",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "transparent",
  color: "#777",
  border: "1px solid rgba(26,22,36,0.15)",
  borderRadius: "var(--v2-border-radius-pill)",
  padding: "12px 24px",
  fontSize: "14px",
  fontFamily: "var(--v2-font-body)",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "16px",
  marginBottom: "8px",
};

// ─── Advanced field renderer ──────────────────────────────────────────────────
function AdvancedFieldInput({
  field,
  value,
  onChange,
}: {
  field: AdvancedField;
  value: string;
  onChange: (val: string) => void;
}) {
  const inputBase: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--v2-font-body)",
    fontSize: "14px",
    color: "var(--v2-text-color)",
    background: "#F9F7F4",
    border: "1px solid rgba(26,22,36,0.12)",
    borderRadius: "12px",
    padding: "10px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={{
        display: "block",
        fontFamily: "var(--v2-font-body)",
        fontWeight: 600,
        fontSize: "13px",
        color: "var(--v2-text-color)",
        marginBottom: "6px",
      }}>
        {field.label}
      </label>
      {field.sourceNote && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "11px",
          color: "#888",
          marginBottom: "6px",
          marginTop: 0,
        }}>
          ✦ Auto-filled: {field.sourceNote}
        </p>
      )}
      {field.type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputBase}>
          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} style={{ ...inputBase, resize: "vertical" }} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={inputBase} />
      )}
    </div>
  );
}

// ─── Waiting State: Zappy pointing at watch — queued before loading ────────────
function WaitingState() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "24px",
      padding: "8px 0 16px",
    }}>
      <ZappyMascot state="waiting" size={100} />
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "15px",
        fontWeight: 600,
        color: "var(--v2-text-color)",
        textAlign: "center",
        margin: 0,
        lineHeight: 1.5,
      }}>
        Queuing your request…
      </p>
    </div>
  );
}

// ─── Loading State: Zappy + progress ring ────────────────────────────────────
const LOADING_MESSAGES = [
  "Zappy is analysing your inputs…",
  "Building your assets from your AI Profile…",
  "Applying Meta compliance checks…",
  "Almost there — finalising your content now…",
];

function LoadingState({ step: _step, progressLabel }: { step?: string; progressLabel?: string | null }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  // Track previous progressLabel to trigger fade animation on change
  const [labelVisible, setLabelVisible] = useState(true);
  const prevLabelRef = useRef(progressLabel);

  // Cycle messages every 20 seconds with fade (only when no real progress label)
  useEffect(() => {
    if (progressLabel) return; // real progress takes over
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
        setVisible(true);
      }, 400);
    }, 20_000);
    return () => clearInterval(interval);
  }, [progressLabel]);

  // Fade animation when progressLabel changes
  useEffect(() => {
    if (progressLabel !== prevLabelRef.current) {
      setLabelVisible(false);
      const t = setTimeout(() => {
        prevLabelRef.current = progressLabel;
        setLabelVisible(true);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [progressLabel]);

  // Elapsed timer — updates every second
  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const displayMessage = progressLabel ?? LOADING_MESSAGES[msgIndex];

  return (
    <>
      <style>{`
        @keyframes v2-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes v2-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        padding: "8px 0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <ZappyMascot state="loading" size={100} />
          {/* CSS progress ring */}
          <div style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            border: "4px solid #F5F1EA",
            borderTopColor: "#FF5B1D",
            animation: "v2-spin 1s linear infinite",
            flexShrink: 0,
          }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--v2-text-color)",
            margin: "0 0 8px",
            lineHeight: 1.5,
            opacity: progressLabel ? (labelVisible ? 1 : 0) : (visible ? 1 : 0),
            transform: (progressLabel ? labelVisible : visible) ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}>
            {displayMessage}
          </p>
          {/* Angle step dots — only shown when real progress data is available */}
          {progressLabel && (() => {
            // Parse "Generating angle X of 4" or "Finalising" from the label
            const match = progressLabel.match(/(\d+) of (\d+)/);
            const total = match ? parseInt(match[2]) : 4;
            const completed = match ? parseInt(match[1]) - 1 : total;
            return (
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "4px 0 8px" }}>
                {Array.from({ length: total }).map((_, i) => (
                  <div key={i} style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: i < completed ? "#58CC02" : i === completed ? "#FF5B1D" : "#E5E0D8",
                    transition: "background 0.4s ease",
                    flexShrink: 0,
                  }} />
                ))}
              </div>
            );
          })()}
          <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "13px",
              fontWeight: 400,
              color: "#999",
              margin: 0,
            }}>
              {elapsed}s
            </p>
        </div>
      </div>
    </>
  );
}

// ─── Success State: Zappy cheering + confetti ─────────────────────────────────
function SuccessState({ score, nextStepUrl, isLastStep }: {
  score: number;
  nextStepUrl?: string | null;
  isLastStep?: boolean;
}) {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {score === 100 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          colors={["#FF5B1D", "#FF5B1D", "#FF5B1D", "#8B5CF6", "#8B5CF6", "#8B5CF6", "#58CC02", "#FFD700", "#F5F1EA"]}
          style={{ position: "fixed", top: 0, left: 0, zIndex: 9999, pointerEvents: "none" }}
        />
      )}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        padding: "8px 0 16px",
      }}>
        <ZappyMascot state="cheering" size={110} />
        <div style={{
          background: "rgba(88,204,2,0.08)",
          border: "1px solid rgba(88,204,2,0.30)",
          borderRadius: "16px",
          padding: "16px 24px",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "22px",
            color: "#2E7D00",
            margin: "0 0 4px",
          }}>
            100/100 — Meta Compliant!
          </p>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "14px",
            color: "#2E7D00",
            margin: 0,
          }}>
            Your assets are ready.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px", width: "100%" }}>
            {isLastStep ? (
              <a
                href="/v2-dashboard"
                style={{
                  display: "block",
                  background: "#58CC02",
                  color: "#fff",
                  borderRadius: "var(--v2-border-radius-pill)",
                  padding: "12px 28px",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 700,
                  fontSize: "15px",
                  textDecoration: "none",
                  letterSpacing: "0.01em",
                  textAlign: "center",
                }}
              >
                🎉 Campaign Complete — View Dashboard
              </a>
            ) : nextStepUrl ? (
              <a
                href={nextStepUrl}
                style={{
                  display: "block",
                  background: "var(--v2-primary-btn)",
                  color: "#fff",
                  borderRadius: "var(--v2-border-radius-pill)",
                  padding: "12px 28px",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 700,
                  fontSize: "15px",
                  textDecoration: "none",
                  letterSpacing: "0.01em",
                  textAlign: "center",
                }}
              >
                Continue to Next Step →
              </a>
            ) : null}

          </div>
        </div>
      </div>
    </>
  );
}

// ─── Concerned State: Zappy concerned + violations ───────────────────────────
function ConcernedState({ score, violations }: { score: number; violations: string[] }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      padding: "8px 0 16px",
    }}>
      <ZappyMascot state="concerned" size={100} />
      <div style={{
        background: "rgba(255,91,29,0.06)",
        border: "1px solid rgba(255,91,29,0.20)",
        borderRadius: "16px",
        padding: "16px 20px",
        width: "100%",
      }}>
        <p style={{
          fontFamily: "var(--v2-font-heading)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "18px",
          color: "#C0390A",
          margin: "0 0 8px",
          textAlign: "center",
        }}>
          {score}/100 — Needs Review
        </p>
        {violations.length > 0 && (
          <ul style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#8B2500",
            marginTop: "12px",
            paddingLeft: "20px",
            lineHeight: 1.7,
          }}>
            {violations.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Node 11 GHL Status Card (own component to satisfy hooks rules) ──────────
function Node11GhlCard() {
  const ghlConn = trpc.ghl.getConnectionStatus.useQuery();
  const ghlOAuthUrl = trpc.ghl.getOAuthUrl.useQuery(undefined, { enabled: false });
  const ghlConnected = !!ghlConn.data?.connected;
  const workflowStatus = trpc.ghl.getWorkflowStatus.useQuery(undefined, {
    enabled: ghlConnected,
  });
  const snapshotInstalled = !!workflowStatus.data?.installed;
  const snapshotId = (ghlConn.data as { masterSnapshotId?: string | null } | undefined)?.masterSnapshotId ?? null;

  if (ghlConn.isLoading) return null;

  return (
    <div style={{
      marginTop: "16px",
      background: "#fff",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "20px 24px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "28px", marginBottom: "8px" }}>
        {ghlConnected ? "\uD83D\uDD17" : "\uD83D\uDD0C"}
      </div>
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "18px",
        color: "var(--v2-text-color)",
        margin: "0 0 6px",
      }}>
        {ghlConnected ? "GoHighLevel Status" : "Connect GoHighLevel"}
      </p>

      {!ghlConnected ? (
        <>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "0 0 16px",
            lineHeight: 1.5,
          }}>
            Connect your GHL sub-account to push campaigns directly — one click deploys your entire kit as live workflows.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await ghlOAuthUrl.refetch();
                const url = (res.data as { url?: string } | undefined)?.url;
                if (!url) { toast.error("Couldn't get GHL OAuth URL"); return; }
                window.open(url, "_blank", "width=600,height=700,left=200,top=100");
              } catch {
                toast.error("Couldn't open GHL connect flow");
              }
            }}
            style={{
              background: "var(--v2-primary-btn, #FF5B1D)",
              color: "#fff",
              border: "none",
              borderRadius: "9999px",
              padding: "12px 28px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >Connect GHL</button>
        </>
      ) : (
        <>
          <div style={{ margin: "0 0 12px", display: "flex", justifyContent: "center" }}>
            {workflowStatus.isLoading ? (
              <span style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "12px",
                color: "#999",
              }}>Checking workflows…</span>
            ) : workflowStatus.data ? (
              <WorkflowStatusPill count={workflowStatus.data.count} total={workflowStatus.data.total} />
            ) : null}
          </div>

          {snapshotInstalled ? (
            <a
              href="/v2-dashboard"
              style={{
                display: "inline-block",
                background: "#1A1624",
                color: "#fff",
                border: "none",
                borderRadius: "9999px",
                padding: "12px 28px",
                fontFamily: "var(--v2-font-body)",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                letterSpacing: "0.01em",
                textDecoration: "none",
              }}
            >Push to GHL →</a>
          ) : snapshotId ? (
            <>
              <p style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "13px",
                color: "#777",
                margin: "0 0 12px",
                lineHeight: 1.5,
              }}>
                Apply ZAP's Master Snapshot to your sub-account — it takes 30 seconds, then every push auto-renders live workflows.
              </p>
              <button
                onClick={() => openSnapshotApplyTab(snapshotId)}
                style={{
                  background: "var(--v2-primary-btn, #FF5B1D)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "12px 28px",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
              >Apply ZAP Master Snapshot →</button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── Error Banner: shared layout for timeout / error / offline ────────────────
function ErrorBanner({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "20px",
      padding: "8px 0 16px",
    }}>
      <ZappyMascot state="concerned" size={100} />
      <div style={{
        background: "rgba(255,91,29,0.06)",
        border: "1px solid rgba(255,91,29,0.20)",
        borderRadius: "16px",
        padding: "20px 24px",
        width: "100%",
        textAlign: "center",
      }}>
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "15px",
          fontWeight: 600,
          color: "#8B2500",
          margin: "0 0 16px",
          lineHeight: 1.6,
        }}>
          {message}
        </p>
        <button
          onClick={onRetry}
          style={{
            ...primaryBtnStyle,
            marginBottom: 0,
            fontSize: "15px",
            padding: "14px 32px",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

// ─── V2 Service Step — collects 7 service fields, saves via API ────────────────
function V2ServiceStep({ onBack, onComplete }: { onBack?: () => void; onComplete: () => void }) {
  const utils = trpc.useUtils();
  const { data: existingServices, isLoading: servicesLoading } = trpc.services.list.useQuery();
  const createService = trpc.services.create.useMutation();
  const updateService = trpc.services.update.useMutation();

  // sessionStorage pre-fill
  const [preFillName, setPreFillName] = useState<string | null>(null);
  // Core fields
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  // 5 additional fields
  const [targetCustomer, setTargetCustomer] = useState("");
  const [mainBenefit, setMainBenefit] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [hvcoTopic, setHvcoTopic] = useState("");
  const [uniqueMechanism, setUniqueMechanism] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [zapExpanding, setZapExpanding] = useState(false);
  const [zapWrote, setZapWrote] = useState(false);
  const expandProfile = trpc.services.expandProfile.useMutation();

  // sessionStorage pre-fill (runs once on mount)
  useEffect(() => {
    const stored = sessionStorage.getItem("zap_service_prefill");
    if (stored) {
      setPreFillName(stored);
      setServiceName(stored);
      sessionStorage.removeItem("zap_service_prefill");
    }
  }, []);

  // Pre-populate all 7 fields from existing DB data on mount
  useEffect(() => {
    if (existingServices && existingServices.length > 0) {
      const svc = existingServices[0];
      // Only pre-fill name if no sessionStorage value was set
      if (!preFillName) setServiceName(svc.name || "");
      setServiceDescription(svc.description || "");
      const isPlaceholderVal = (v: string | null | undefined) =>
        !v?.trim() || v.trim().toLowerCase() === 'to be defined';
      setTargetCustomer(!isPlaceholderVal(svc.targetCustomer) ? (svc.targetCustomer ?? "") : "");
      setMainBenefit(!isPlaceholderVal(svc.mainBenefit) ? (svc.mainBenefit ?? "") : "");
      setPainPoints(svc.painPoints || "");
      setHvcoTopic(svc.hvcoTopic || "");
      setUniqueMechanism(svc.uniqueMechanismSuggestion || "");
    }
  }, [existingServices]); // intentionally omit preFillName to avoid overwriting on re-render

  // Quality indicator: count filled fields out of 7
  const filledCount = [
    serviceName.trim(),
    serviceDescription.trim(),
    targetCustomer.trim(),
    mainBenefit.trim(),
    painPoints.trim(),
    hvcoTopic.trim(),
    uniqueMechanism.trim(),
  ].filter(Boolean).length;

  const qualityLabel = filledCount >= 6 ? "Strong" : filledCount >= 3 ? "Good" : "Basic";
  const qualityColor = filledCount >= 6 ? "#16a34a" : filledCount >= 3 ? "#d97706" : "#FF5B1D";
  const qualityBg = filledCount >= 6 ? "rgba(22,163,74,0.10)" : filledCount >= 3 ? "rgba(217,119,6,0.10)" : "rgba(255,91,29,0.10)";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--v2-font-body)",
    fontSize: "15px",
    color: "var(--v2-text-color)",
    background: "#F9F7F4",
    border: "1px solid rgba(26,22,36,0.15)",
    borderRadius: "12px",
    padding: "14px 16px",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--v2-font-body)",
    fontWeight: 700,
    fontSize: "14px",
    color: "var(--v2-text-color)",
    marginBottom: "8px",
  };

  const optionalTag = <span style={{ fontWeight: 400, color: "rgba(26,22,36,0.45)" }}>(optional)</span>;

  function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    (e.target as HTMLElement).style.borderColor = "#FF5B1D";
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    (e.target as HTMLElement).style.borderColor = "rgba(26,22,36,0.15)";
  }

  async function handleZapExpand() {
    const existing = existingServices && existingServices.length > 0 ? existingServices[0] : null;
    if (!existing) {
      // Need to save the service first so expandProfile has a serviceId
      setSaving(true);
      setSaveError("");
      try {
        await createService.mutateAsync({
          name: serviceName.trim(),
          description: serviceName.trim(),
          category: "coaching",
          targetCustomer: "To be defined",
          mainBenefit: "To be defined",
        });
        await utils.services.list.invalidate();
      } catch {
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    // Re-fetch to get the saved service id
    const refreshed = await utils.services.list.fetch();
    const svc = refreshed?.[0];
    if (!svc) return;
    setZapExpanding(true);
    try {
      const result = await expandProfile.mutateAsync({ serviceId: svc.id });
      const exp = result.expanded as Record<string, string>;
      // Only fill empty fields — never overwrite user-typed content
      // description: use exp.description (generated) or fall back to svc.description
      if (!serviceDescription.trim()) {
        const descVal = exp.description || svc.description || "";
        if (descVal && descVal !== svc.name) setServiceDescription(descVal);
      }
      // targetCustomer: use exp.targetCustomer (generated) or svc value if not placeholder
      const isPlaceholder = (v: string | undefined | null) =>
        !v?.trim() || v.trim().toLowerCase() === 'to be defined';
      if (isPlaceholder(targetCustomer)) {
        const tcVal = exp.targetCustomer || (!isPlaceholder(svc.targetCustomer) ? svc.targetCustomer : "") || "";
        if (tcVal) setTargetCustomer(tcVal);
      }
      // mainBenefit: use exp.mainBenefit (generated) or svc value if not placeholder
      if (isPlaceholder(mainBenefit)) {
        const mbVal = exp.mainBenefit || (!isPlaceholder(svc.mainBenefit) ? svc.mainBenefit : "") || "";
        if (mbVal) setMainBenefit(mbVal);
      }
      if (!painPoints.trim() && exp.painPoints) setPainPoints(exp.painPoints);
      if (!hvcoTopic.trim() && exp.hvcoTopic) setHvcoTopic(exp.hvcoTopic);
      if (!uniqueMechanism.trim() && exp.uniqueMechanismSuggestion) setUniqueMechanism(exp.uniqueMechanismSuggestion);
      setZapWrote(true);
    } catch {
      // silently fail — user can still fill manually
    } finally {
      setZapExpanding(false);
    }
  }

  async function handleSave() {
    if (!serviceName.trim()) {
      setSaveError("Please enter your service name.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const existing = existingServices && existingServices.length > 0 ? existingServices[0] : null;
      const payload = {
        name: serviceName.trim(),
        description: serviceDescription.trim() || serviceName.trim(),
        ...(targetCustomer.trim() ? { targetCustomer: targetCustomer.trim() } : {}),
        ...(mainBenefit.trim() ? { mainBenefit: mainBenefit.trim() } : {}),
        ...(painPoints.trim() ? { painPoints: painPoints.trim() } : {}),
        ...(hvcoTopic.trim() ? { hvcoTopic: hvcoTopic.trim() } : {}),
        ...(uniqueMechanism.trim() ? { uniqueMechanismSuggestion: uniqueMechanism.trim() } : {}),
      };
      if (existing) {
        await updateService.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createService.mutateAsync({
          ...payload,
          category: "coaching",
          targetCustomer: targetCustomer.trim() || "To be defined",
          mainBenefit: mainBenefit.trim() || "To be defined",
        });
      }
      utils.services.list.invalidate();
      utils.progress.getProgress.invalidate();
      onComplete();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <V2Layout>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "48px 16px 64px",
      }}>
        {/* Back link */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              alignSelf: "flex-start",
              marginBottom: "24px",
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "#777",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← Back to Campaign Path
          </button>
        )}

        <div style={cardStyle}>
          {/* sessionStorage pre-fill banner */}
          {preFillName && (
            <div style={{
              background: "rgba(255,91,29,0.08)",
              border: "1px solid rgba(255,91,29,0.30)",
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "24px",
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "#C0390A",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}>
              <span style={{ fontSize: "18px", lineHeight: 1 }}>⚡</span>
              <span>You typed <strong>&ldquo;{preFillName}&rdquo;</strong> — let&apos;s build it! We&apos;ve pre-filled your programme name below.</span>
            </div>
          )}

          <h1 style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "clamp(22px, 5vw, 30px)",
            color: "var(--v2-text-color)",
            lineHeight: 1.2,
            marginBottom: "8px",
            marginTop: 0,
            textAlign: "center",
          }}>
            What&apos;s your service called?
          </h1>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "15px",
            color: "rgba(26,22,36,0.55)",
            textAlign: "center",
            marginBottom: "32px",
            marginTop: 0,
            lineHeight: 1.5,
          }}>
            This powers every asset Zappy writes for you.
          </p>

          {servicesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "3px solid #F5F1EA",
                borderTopColor: "#FF5B1D",
                animation: "v2-spin 1s linear infinite",
              }} />
            </div>
          ) : (
            <>
              {/* ── Core fields ── */}
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={e => { setServiceName(e.target.value); setZapWrote(false); }}
                  placeholder="e.g. Meta Ads Mastery for Coaches"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                {/* Expand with AI button — visible once name has 3+ chars */}
                {serviceName.trim().length >= 3 && (
                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                    {zapExpanding ? (
                      <>
                        <div style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: "2px solid rgba(255,91,29,0.25)",
                          borderTopColor: "#FF5B1D",
                          animation: "v2-spin 1s linear infinite",
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontFamily: "var(--v2-font-body)",
                          fontSize: "13px",
                          color: "rgba(26,22,36,0.55)",
                          fontStyle: "italic",
                        }}>Zappy is writing your profile...</span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleZapExpand}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 14px",
                          borderRadius: "999px",
                          background: "#FF5B1D",
                          color: "#fff",
                          fontFamily: "var(--v2-font-body)",
                          fontSize: "13px",
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          transition: "opacity 0.15s ease",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                      >
                        Let Zappy fill this in →
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "28px" }}>
                <label style={labelStyle}>What do you help people with? {optionalTag}</label>
                <textarea
                  value={serviceDescription}
                  onChange={e => setServiceDescription(e.target.value)}
                  placeholder="e.g. I help coaches fill their programmes with Meta ads without wasting money on the wrong audiences"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* ── Section label for optional fields ── */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
              }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(26,22,36,0.10)" }} />
                <span style={{
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#FF5B1D",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}>
                  The more you add, the better your campaign output.
                </span>
                <div style={{ flex: 1, height: "1px", background: "rgba(26,22,36,0.10)" }} />
              </div>

              {/* ── 5 optional fields ── */}
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Who is your ideal customer? {optionalTag}</label>
                <input
                  type="text"
                  value={targetCustomer}
                  onChange={e => setTargetCustomer(e.target.value)}
                  placeholder="e.g. Female coaches aged 35-50 who want to grow their online business"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>What is the biggest result you deliver? {optionalTag}</label>
                <input
                  type="text"
                  value={mainBenefit}
                  onChange={e => setMainBenefit(e.target.value)}
                  placeholder="e.g. A fully booked coaching practice in 90 days"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>What pain or frustration does your customer feel right now? {optionalTag}</label>
                <textarea
                  value={painPoints}
                  onChange={e => setPainPoints(e.target.value)}
                  placeholder="e.g. Struggling to get consistent leads, wasting money on ads that don't convert"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>What would you offer as a free lead magnet? {optionalTag}</label>
                <input
                  type="text"
                  value={hvcoTopic}
                  onChange={e => setHvcoTopic(e.target.value)}
                  placeholder="e.g. Free guide: 5 Meta ad mistakes coaches make"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              <div style={{ marginBottom: "28px" }}>
                <label style={labelStyle}>What makes your method different from everyone else? {optionalTag}</label>
                <textarea
                  value={uniqueMechanism}
                  onChange={e => setUniqueMechanism(e.target.value)}
                  placeholder="e.g. The Heart-Mind Activation System — a neuroscience-backed coaching framework"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* ── Zappy wrote notice ── */}
              {zapWrote && (
                <div style={{
                  marginBottom: "16px",
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "13px",
                  color: "rgba(26,22,36,0.45)",
                  fontStyle: "italic",
                  textAlign: "center",
                }}>
                  Zappy wrote this — edit anything before saving.
                </div>
              )}

              {/* ── Campaign quality indicator ── */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: qualityBg,
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "20px",
                transition: "background 0.3s ease",
              }}>
                <span style={{
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--v2-text-color)",
                }}>
                  Campaign quality
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    display: "flex",
                    gap: "4px",
                  }}>
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i} style={{
                        width: "18px",
                        height: "6px",
                        borderRadius: "3px",
                        background: i <= filledCount ? qualityColor : "rgba(26,22,36,0.12)",
                        transition: "background 0.2s ease",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontFamily: "var(--v2-font-body)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: qualityColor,
                    background: qualityBg,
                    border: `1px solid ${qualityColor}`,
                    borderRadius: "999px",
                    padding: "2px 10px",
                    transition: "all 0.3s ease",
                  }}>
                    {qualityLabel}
                  </span>
                </div>
              </div>

              {saveError && (
                <div style={{
                  background: "rgba(255,91,29,0.08)",
                  border: "1px solid rgba(255,91,29,0.25)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "14px",
                  color: "#C0390A",
                  textAlign: "center",
                }}>
                  {saveError}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !serviceName.trim()}
                style={{
                  ...primaryBtnStyle,
                  opacity: saving || !serviceName.trim() ? 0.6 : 1,
                  cursor: saving || !serviceName.trim() ? "not-allowed" : "pointer",
                }}
                onMouseEnter={e => { if (!saving && serviceName.trim()) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                onMouseLeave={e => { if (!saving && serviceName.trim()) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {saving ? "Saving…" : "Save & Continue →"}
              </button>
            </>
          )}
        </div>

        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "12px",
          color: "#999",
          textAlign: "center",
          marginTop: "20px",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}>
          You can add more details to your service profile later. This gets you started.
        </p>

        <a
          href="/v2-dashboard"
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "12px",
            color: "rgba(26,22,36,0.38)",
            textDecoration: "none",
            marginTop: "10px",
            display: "inline-block",
            borderBottom: "1px solid rgba(26,22,36,0.15)",
            paddingBottom: "1px",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(26,22,36,0.65)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(26,22,36,0.38)")}
        >
          ← Back to Campaign Path
        </a>
      </div>
    </V2Layout>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface V2GeneratorWizardProps {
  step: WizardStep;
  serviceId?: number;
  onBack?: () => void;
}

export default function V2GeneratorWizard({ step, serviceId, onBack }: V2GeneratorWizardProps) {
  const [, navigate] = useLocation();
  // ── Subscription tier check (reuses existing auth — no new logic) ──
  const { user: authUser } = useAuth();
  const isFreeTier = !authUser || (authUser.role !== "superuser" && authUser.role !== "admin" && authUser.subscriptionTier !== "pro" && authUser.subscriptionTier !== "agency");

  // NOTE: All hooks MUST be called unconditionally before any early returns
  // to comply with React's Rules of Hooks.

  const stepLabel = step !== "service" ? STEP_LABELS[step] : "";
  const advancedFields = step !== "service" ? ADVANCED_FIELDS[step] : [];

  // ── Accordion state ──
  const [accordionOpen, setAccordionOpen] = useState(false);

  // ── Advanced field overrides ──
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const fields = step !== "service" ? ADVANCED_FIELDS[step] : [];
    const defaults: Record<string, string> = {};
    fields.forEach(f => { defaults[f.key] = f.options ? f.options[0] : ""; });
    return defaults;
  });

  // ── UI state ──
  type WizardStatus =
    | "idle"
    | "waiting"
    | "loading"
    | "success"
    | "concerned"
    | "missing_data"
    | "timeout"    // Scenario 1: 30s no response
    | "error"      // Scenario 2: mid-generation failure
    | "offline";   // Scenario 3: network lost during generation

  const [status, setStatus] = useState<WizardStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [complianceScore, setComplianceScore] = useState(100);
  const [complianceViolations, setComplianceViolations] = useState<string[]>([]);
  // Real-time progress label from background job (e.g. "Generating angle 1 of 4…")
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  // R1a: set IDs captured from pollJob result — used to render result panels after generation
  const [latestHeadlineSetId, setLatestHeadlineSetId] = useState<string | null>(null);
  const [latestAdSetId, setLatestAdSetId] = useState<string | null>(null);
  // R1b: set IDs for nodes 2, 3, 4, 5, 8, 9, 10
  const [latestIcpId, setLatestIcpId] = useState<number | null>(null);
  const [latestOfferId, setLatestOfferId] = useState<number | null>(null);
  const [latestMechanismSetId, setLatestMechanismSetId] = useState<string | null>(null);
  const [latestMechWarning, setLatestMechWarning] = useState<string | undefined>(undefined);
  const [latestHvcoSetId, setLatestHvcoSetId] = useState<string | null>(null);
  const [latestLandingPageId, setLatestLandingPageId] = useState<number | null>(null);
  const [latestEmailSequenceId, setLatestEmailSequenceId] = useState<number | null>(null);
  const [latestWhatsappSequenceId, setLatestWhatsappSequenceId] = useState<number | null>(null);
  // ── ICP name input (only for ICP step) ──
  const [icpName, setIcpName] = useState("");
  // ── Campaign ZIP download state (Node 11) ──
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipDownloadError, setZipDownloadError] = useState<string | null>(null);
  // ── tRPC utils for cache invalidation ──
  const utils = trpc.useUtils();
  // ── Skip node mutation + query ──
  const skipMutation = trpc.nodeSkips.skip.useMutation();
  const { data: skippedNodes } = trpc.nodeSkips.getSkippedNodes.useQuery(
    { serviceId: serviceId ?? 0 },
    { enabled: !!serviceId }
  );
  // ── Real mutations (all use generateAsync + polling pattern) ──
  const generateIcpAsync = trpc.icps.generateAsync.useMutation();
  const generateOfferAsync = trpc.offers.generateAsync.useMutation();
  const generateHeroMechanismAsync = trpc.heroMechanisms.generateAsync.useMutation();
  const generateHvcoAsync = trpc.hvco.generateAsync.useMutation();
  const generateHeadlinesAsync = trpc.headlines.generateAsync.useMutation();
  const generateAdCopyAsync = trpc.adCopy.generateAsync.useMutation();
  const generateLandingPageAsync = trpc.landingPages.generateAsync.useMutation();
  const generateEmailSequenceAsync = trpc.emailSequences.generateAsync.useMutation();
  const generateWhatsappSequenceAsync = trpc.whatsappSequences.generateAsync.useMutation();
  // ── Commit 7: campaignKits.updateSelection mutation (used by Step 0 picker) ──
  // The campaignKits.getByUser QUERY is co-located with the other tRPC list
  // queries below (after isDemoMissing is declared). Server-side mutation is
  // updateSelection (campaignKits.ts:140) — accepts campaignType nullable
  // optional per the commit-7 comment at L152-154.
  const updateKitMutation = trpc.campaignKits.updateSelection.useMutation();
  // Polling interval ref for background jobs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timeout ref (cleared on success/error) ──
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stored payload ref for retry ──
  const lastPayloadRef = useRef<Record<string, unknown> | null>(null);

  // ── Demo mode params ──
  const demoMode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("demo")
    : null;
  // ?progress=2 → shows "Generating angle 2 of 4…" in LoadingState for screenshot demos
  const demoProgressAngle = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("progress")
    : null;
  const isDemoMissing   = demoMode === "missing";
  const isDemoSuccess   = demoMode === "success";
  const isDemoConcerned = demoMode === "concerned";
  const isDemoLoading   = demoMode === "loading";
  const isDemoTimeout   = demoMode === "timeout";
  const isDemoError     = demoMode === "error";
  const isDemoOffline   = demoMode === "offline";

  // Debug/QA override mirroring ?demo= and ?progress= — lets QA load any existing result set by URL without a fresh generate run. Keep this indefinitely; it doubles as an admin debug path.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    // Maps each WizardStep to the URL param name it reads and the setter
    // that applies it. Skipped steps ("service", "pushToMeta") intentionally
    // have no entry — no result-panel guard state to rehydrate.
    const paramNames: Record<string, string> = {
      icp:              "icpId",
      offer:            "offerId",
      uniqueMethod:     "mechanismSetId",
      freeOptIn:        "hvcoSetId",
      headlines:        "headlineSetId",
      adCopy:           "adSetId",
      landingPage:      "landingPageId",
      emailSequence:    "emailSequenceId",
      whatsappSequence: "whatsappSequenceId",
    };
    const applyOverride: Record<string, (raw: string) => boolean> = {
      icp:              (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n)) return false; setLatestIcpId(n); return true; },
      offer:            (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n)) return false; setLatestOfferId(n); return true; },
      uniqueMethod:     (v) => { setLatestMechanismSetId(v); return true; },
      freeOptIn:        (v) => { setLatestHvcoSetId(v); return true; },
      headlines:        (v) => { setLatestHeadlineSetId(v); return true; },
      adCopy:           (v) => { setLatestAdSetId(v); return true; },
      landingPage:      (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n)) return false; setLatestLandingPageId(n); return true; },
      emailSequence:    (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n)) return false; setLatestEmailSequenceId(n); return true; },
      whatsappSequence: (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n)) return false; setLatestWhatsappSequenceId(n); return true; },
    };
    const paramKey = paramNames[step];
    if (!paramKey) return;
    const raw = params.get(paramKey);
    if (!raw) return;
    if (applyOverride[step]?.(raw)) setStatus("success");
  }, [step]);

  // ── Fetch service (real data, not mock) ──
  const { data: serviceData } = trpc.services.list.useQuery(undefined, {
    enabled: !isDemoMissing,
  });

  // ── Fetch ICPs (real data, not mock) ──
  const { data: icpData } = trpc.icps.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );

  // ── Fetch latest sets/items per node for DB-fallback hydration on remount ──
  // Mounting the wizard with `latestX` initialized to `null` produces an empty
  // result panel even when the user has previously-generated content sitting
  // in the DB. These queries surface the most-recent row per node (list
  // procedures already sort by createdAt DESC) so the hydration effects below
  // can populate `latestX` from the DB on mount. The job-completion handlers
  // remain the source of truth for fresh generates — the `if (!latestX)` guard
  // in each effect prevents the DB read from clobbering a just-completed ID.
  const { data: offersList } = trpc.offers.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );
  const { data: mechanismsList } = trpc.heroMechanisms.list.useQuery(undefined, {
    enabled: !isDemoMissing,
  });
  const { data: hvcoList } = trpc.hvco.list.useQuery(undefined, {
    enabled: !isDemoMissing,
  });
  const { data: headlinesList } = trpc.headlines.list.useQuery(undefined, {
    enabled: !isDemoMissing,
  });
  const { data: adCopyList } = trpc.adCopy.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );
  const { data: landingPagesList } = trpc.landingPages.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );
  const { data: emailSeqList } = trpc.emailSequences.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );
  const { data: whatsappSeqList } = trpc.whatsappSequences.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );
  // ── Commit 7: campaign kit query for campaignType cascade ──
  // Drives Step 0 picker, landingPage pageType cascade, and adCopy CTA
  // derivation (per locked spec Q-A/Q-D/Q-C).
  const { data: campaignKitsList } = trpc.campaignKits.getByUser.useQuery(
    undefined,
    { enabled: !isDemoMissing }
  );

  // ── Resolve the active service ──
  const activeService = isDemoMissing ? undefined : (
    serviceId ? serviceData?.find(s => s.id === serviceId) : serviceData?.[0]
  );

  // ── Resolve the active ICP (Commit 7.1 hotfix) ──
  // Prefer the ICP that has a kit attached, falling back to the first ICP
  // unconditionally. Pre-7.1 the wizard hardcoded `icpData?.[0]`, which on
  // multi-ICP accounts surfaces the newest ICP — but a user's kit is often
  // attached to an older ICP. That mismatch caused activeKit to resolve as
  // undefined for multi-ICP users (Step 0 empty-state, hidden dashboard
  // sidebar), even though they had a valid kit. The "first ICP with a kit"
  // default keeps single-ICP users unchanged and aligns multi-ICP users to
  // the kit they're actually working on.
  const activeIcp = isDemoMissing ? undefined : (() => {
    if (!icpData) return undefined;
    const firstKit = campaignKitsList?.[0];
    if (firstKit) {
      const matching = icpData.find((i: { id: number }) => i.id === firstKit.icpId);
      if (matching) return matching;
    }
    return icpData[0];
  })();

  // ── Resolve the active campaign kit (Commit 7) ──
  // With the 7.1 activeIcp fix, this lookup matches reliably for
  // multi-ICP-with-kit accounts. Cascade in landingPage / adCopy dispatchers
  // tolerates undefined and falls back to historical defaults.
  const activeKit = activeIcp && campaignKitsList
    ? campaignKitsList.find((k: { icpId: number; id: number; campaignType: string | null }) => k.icpId === activeIcp.id)
    : undefined;

  // ── Demo state triggers (for screenshots) ──
  useEffect(() => {
    if (isDemoLoading) {
      setStatus("loading");
      // If ?progress=N is set, show the angle progress label in the loading state
      if (demoProgressAngle) {
        const n = parseInt(demoProgressAngle, 10);
        if (!isNaN(n) && n >= 1 && n <= 4) {
          setProgressLabel(`Generating angle ${n} of 4…`);
        }
      }
    } else if (isDemoSuccess) {
      setComplianceScore(100);
      setStatus("success");
    } else if (isDemoConcerned) {
      setComplianceScore(72);
      setComplianceViolations([
        "Avoid superlative claims ('best', 'guaranteed') without substantiation",
        "Remove direct call-to-action in first sentence of body copy",
        "Headline contains prohibited financial promise language",
      ]);
      setStatus("concerned");
    } else if (isDemoTimeout) {
      setStatus("timeout");
    } else if (isDemoError) {
      setStatus("error");
    } else if (isDemoOffline) {
      setStatus("offline");
    }
  }, [isDemoLoading, isDemoSuccess, isDemoConcerned, isDemoTimeout, isDemoError, isDemoOffline, demoProgressAngle]);

  // ── DB-fallback hydration: populate `latestX` from the most recent DB row
  // when the component mounts with no in-memory state, and flip `status` to
  // "success" so the result-panel render gate matches. Mirrors the URL-override
  // path at L1386 (`if (applyOverride[step]?.(raw)) setStatus("success")`):
  // both flip status only after a successful ID hydration.
  //
  // Two guards protect against unintended side effects:
  //   (a) `if (!latestX)` — never overwrite a value just set by the
  //       job-completion handler. The list query's cache may briefly hold a
  //       stale `[0]` while a fresh generation finishes flushing; without this
  //       guard, a write here would clobber the just-completed ID. After
  //       invalidation the list refetches and `[0]` becomes the new generation,
  //       but by then `latestX` is non-null and the guard short-circuits.
  //   (b) `if (status === "loading") return` — never hijack an in-flight
  //       generate. If the user clicks Generate while a list query is still
  //       resolving, the generate handler sets status="loading" first; this
  //       guard ensures hydration cannot then flip status back to "success"
  //       with a stale ID before the new generation completes.
  //
  // Pressure-test on "false-success on partially-loaded data": flipping status
  // to "success" semantically means "an ID is rendered into a result panel."
  // The panel's own query loads full content from that ID — if that fails,
  // existing per-panel error handling surfaces it (same path used after a
  // fresh generate). Status="success" without a real DB row is impossible
  // because we only flip after `data?.[0]?.id` is truthy, which requires the
  // list query (Drizzle SELECT) to have returned at least one row.
  useEffect(() => {
    if (status === "loading") return;
    if (!latestIcpId && icpData?.[0]?.id) {
      setLatestIcpId(icpData[0].id);
      setStatus("success");
    }
  }, [icpData, latestIcpId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestOfferId && offersList?.[0]?.id) {
      setLatestOfferId(offersList[0].id);
      setStatus("success");
    }
  }, [offersList, latestOfferId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestMechanismSetId && mechanismsList?.[0]?.mechanismSetId) {
      setLatestMechanismSetId(mechanismsList[0].mechanismSetId);
      setStatus("success");
    }
  }, [mechanismsList, latestMechanismSetId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestHvcoSetId && hvcoList?.[0]?.hvcoSetId) {
      setLatestHvcoSetId(hvcoList[0].hvcoSetId);
      setStatus("success");
    }
  }, [hvcoList, latestHvcoSetId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestHeadlineSetId && headlinesList?.[0]?.headlineSetId) {
      setLatestHeadlineSetId(headlinesList[0].headlineSetId);
      setStatus("success");
    }
  }, [headlinesList, latestHeadlineSetId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestAdSetId && adCopyList?.[0]?.adSetId) {
      setLatestAdSetId(adCopyList[0].adSetId);
      setStatus("success");
    }
  }, [adCopyList, latestAdSetId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestLandingPageId && landingPagesList?.[0]?.id) {
      setLatestLandingPageId(landingPagesList[0].id);
      setStatus("success");
    }
  }, [landingPagesList, latestLandingPageId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestEmailSequenceId && emailSeqList?.[0]?.id) {
      setLatestEmailSequenceId(emailSeqList[0].id);
      setStatus("success");
    }
  }, [emailSeqList, latestEmailSequenceId, status]);
  useEffect(() => {
    if (status === "loading") return;
    if (!latestWhatsappSequenceId && whatsappSeqList?.[0]?.id) {
      setLatestWhatsappSequenceId(whatsappSeqList[0].id);
      setStatus("success");
    }
  }, [whatsappSeqList, latestWhatsappSequenceId, status]);

  // ── Commit 7.2 (Bug 1): seed pageType field from cascade ──
  // The dispatcher cascade fires at GENERATION time (Item 5) — pageType is
  // correctly set on the LLM call. But the Advanced dropdown UI showed
  // "Sales Page" preselected (options[0] static default), which read as
  // "cascade not firing" to users. This effect overwrites the field default
  // with the cascaded label whenever the user lands on the landingPage step
  // with a campaignType set on the kit. User can still override in the
  // dropdown — their choice persists until they leave the step or change
  // campaignType.
  useEffect(() => {
    if (step !== "landingPage") return;
    if (!activeKit?.campaignType) return;
    const CAMPAIGN_TO_PAGE_TYPE_LABEL: Record<string, string> = {
      webinar: "Webinar Registration",
      discovery_call: "Discovery Call Booking",
      lead_magnet: "Lead Magnet Download",
      in_person_event: "Event Registration",
      course_launch: "Sales Page",
      product_launch: "Sales Page",
      challenge: "Sales Page",
    };
    const cascadeLabel = CAMPAIGN_TO_PAGE_TYPE_LABEL[activeKit.campaignType];
    if (!cascadeLabel) return;
    setFieldValues(prev => ({ ...prev, pageType: cascadeLabel }));
  }, [step, activeKit?.campaignType]);

  // ── Network loss listener (only active during generation) ──
  useEffect(() => {
    if (status !== "loading" && status !== "waiting") return;

    function handleOffline() {
      clearTimeout(timeoutRef.current ?? undefined);
      setStatus("offline");
    }

    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [status]);

  // ── Cleanup timeout and poll interval on unmount ──
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current ?? undefined);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Clear mechanism generation warning on step change ──
  // latestMechWarning is only relevant while on the uniqueMethod step. Clearing it on
  // step change prevents stale warnings appearing if the user navigates away and returns.
  useEffect(() => {
    if (latestMechWarning !== undefined) setLatestMechWarning(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Core generation logic — real tRPC mutations for all 11 steps ──
  const runGeneration = useCallback(async (payload: Record<string, unknown>) => {
    lastPayloadRef.current = payload;
    setStatus("waiting");
    await new Promise(r => setTimeout(r, 800));
    setStatus("loading");
    // 300-second timeout — background jobs poll for up to 300s
    timeoutRef.current = setTimeout(() => setStatus("timeout"), 310_000);
    try {
      const svcId = payload.serviceId as number;
      const svc = activeService;

      // Reset progress label at the start of each generation
      setProgressLabel(null);
      // ── Shared polling helper ──
      // onProgress: optional callback fired whenever the job's progress label changes
      type JobResult = { headlineSetId?: string; adSetId?: string; icpId?: number; offerId?: number; mechanismSetId?: string; hvcoSetId?: string; id?: number; generationWarning?: string; [key: string]: unknown };
      const pollJob = (jobId: string, onProgress?: (label: string) => void) => new Promise<JobResult>((resolve, reject) => {
        const pollStart = Date.now();
        const MAX_POLL_MS = 300_000;
        let lastLabel: string | undefined;
        pollIntervalRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/jobs/${jobId}`);
            const data = await res.json() as { status: string; result: JobResult | null; error?: string; progress?: { step: number; total: number; label: string } | null };
            // Fire progress callback when label changes
            if (onProgress && data.progress?.label && data.progress.label !== lastLabel) {
              lastLabel = data.progress.label;
              onProgress(data.progress.label);
            }
            if (data.status === "complete") {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              // API already JSON.parses result — use directly
              const parsed: JobResult = (data.result && typeof data.result === 'object') ? data.result : {};
              console.log('[ZAP R1a] pollJob complete — result payload:', parsed);
              resolve(parsed);
            } else if (data.status === "failed") {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              reject(new Error(data.error || "Background job failed"));
            } else if (Date.now() - pollStart > MAX_POLL_MS) {
              clearInterval(pollIntervalRef.current!);
              pollIntervalRef.current = null;
              reject(new Error("Generation timed out after 300 seconds"));
            }
          } catch (pollErr) {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            reject(pollErr);
          }
        }, 5_000);
      });
      if (step === "icp") {
        // Precedence: advanced override → inline icpName input → service-derived auto-gen.
        // If user opens Advanced and supplies a name, it wins; otherwise existing path.
        const advName = (payload.advancedOverrides as Record<string, string> | undefined)?.name?.trim();
        const { jobId } = await generateIcpAsync.mutateAsync({
          serviceId: svcId,
          name: advName || (payload.icpName as string) || (svc?.avatarName ? `${svc.avatarName} Profile` : "My Ideal Customer"),
        });
        const icpResult = await pollJob(jobId);
        if (typeof icpResult.icpId === 'number') setLatestIcpId(icpResult.icpId);
      } else if (step === "offer") {
        // Path C: read user-selected offerType from Advanced accordion.
        // Schema enum is ["standard","premium","vip"]; UI select offers same 3.
        // If user hasn't touched Advanced, fieldValues default ("premium")
        // matches the previous hardcode → behavior identical to today.
        const advOfferType = (payload.advancedOverrides as Record<string, string> | undefined)?.offerType as
          | "standard"
          | "premium"
          | "vip"
          | undefined;
        const { jobId } = await generateOfferAsync.mutateAsync({
          serviceId: svcId,
          offerType: advOfferType ?? "premium",
        });
        const offerResult = await pollJob(jobId);
        if (typeof offerResult.offerId === 'number') setLatestOfferId(offerResult.offerId);
      } else if (step === "uniqueMethod") {
        // Path B wire: read user-supplied application + descriptor from Advanced.
        // application: empty/whitespace → undefined → server falls back to
        //   [INSERT_APPLICATION_METHOD] placeholder (commit 75eecf3), surfaced
        //   via PlaceholderBanner.
        // descriptor: defaults to "System" via fieldValues options[0]; matches
        //   the pre-commit-2 server hardcoded default → no-Advanced path produces
        //   structurally identical output to today's generations.
        const advApplication = (payload.advancedOverrides as Record<string, string> | undefined)?.application?.trim();
        const advDescriptor = (payload.advancedOverrides as Record<string, string> | undefined)?.descriptor as
          | "System"
          | "Framework"
          | "Method"
          | "Strategy"
          | undefined;
        const { jobId } = await generateHeroMechanismAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          pressingProblem: svc?.painPoints || "",
          whyProblem: svc?.whyProblemExists || "",
          whatTried: svc?.failedSolutions || "",
          whyExistingNotWork: svc?.failedSolutions || "",
          desiredOutcome: svc?.mainBenefit || "",
          credibility: svc?.pressFeatures || "",
          socialProof: svc?.socialProofStat || "",
          application: advApplication || undefined,
          descriptor: advDescriptor ?? "System",
        });
        const mechResult = await pollJob(jobId);
        if (typeof mechResult.mechanismSetId === 'string') setLatestMechanismSetId(mechResult.mechanismSetId);
        if (typeof mechResult.generationWarning === 'string' && mechResult.generationWarning) setLatestMechWarning(mechResult.generationWarning);
        else setLatestMechWarning(undefined);
      } else if (step === "freeOptIn") {
        // Path C: read user-supplied lead-magnet topic from Advanced accordion.
        // If user leaves it blank → existing svc fallback chain runs as before.
        const advHvcoTopic = (payload.advancedOverrides as Record<string, string> | undefined)?.hvcoTopic?.trim();
        const { jobId } = await generateHvcoAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          hvcoTopic: advHvcoTopic || svc?.hvcoTopic || svc?.mainBenefit || "",
        });
        const hvcoResult = await pollJob(jobId);
        if (typeof hvcoResult.hvcoSetId === 'string') setLatestHvcoSetId(hvcoResult.hvcoSetId);
      } else if (step === "headlines") {
        // Path B + Choice 1: UI shows friendly labels and an "All styles"
        // sentinel; map back to server keys here. The lookup table
        // INTENTIONALLY omits the "All styles..." label so it falls through
        // to undefined, which the server's commit-1 filter (e572f7a) treats
        // as "run all 5 formulas". Keys are byte-identical to the server's
        // FORMULA_PROMPTS keys at server/routers/headlines.ts:130-210.
        const HEADLINE_STYLE_LABEL_TO_KEY: Record<string, "story" | "eyebrow" | "question" | "authority" | "urgency"> = {
          "Story-driven (How a [Person] discovered [Result])": "story",
          "Authority eyebrow (Three-part with credibility tag)": "eyebrow",
          "Question-based (Hidden obstacles, mistakes)": "question",
          "Expert-led (Authority + debunked old methods)": "authority",
          "Urgent timeframe (Action + result + days/months)": "urgency",
        };
        const advLabel = (payload.advancedOverrides as Record<string, string> | undefined)?.headlineStyle;
        const headlineStyle = advLabel ? HEADLINE_STYLE_LABEL_TO_KEY[advLabel] : undefined;
        const { jobId } = await generateHeadlinesAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          pressingProblem: svc?.painPoints || "",
          desiredOutcome: svc?.mainBenefit || "",
          uniqueMechanism: svc?.uniqueMechanismSuggestion || "",
          headlineStyle,
        });
        const headlineResult = await pollJob(jobId);
        if (headlineResult.headlineSetId) {
          setLatestHeadlineSetId(headlineResult.headlineSetId);
        }
      } else if (step === "adCopy") {
        // Commit 7: derive CTA from activeKit?.campaignType per locked spec
        // Q-C. Falls back to "Book a Free Call" (the prior hardcoded value)
        // when no campaignType is set — preserves no-regression for kits
        // pre-dating Step 0. Operator can edit the generated ad copy text
        // post-generation; no Advanced field for inline override (kept tight
        // per spec).
        const CAMPAIGN_TO_CTA: Record<string, string> = {
          discovery_call: "Book a Free Call",
          webinar: "Save My Seat",
          challenge: "Join the Challenge",
          lead_magnet: "Download Now",
          course_launch: "Enroll Now",
          product_launch: "Get Instant Access",
          in_person_event: "Reserve My Spot",
        };
        const adCallToAction = activeKit?.campaignType
          ? (CAMPAIGN_TO_CTA[activeKit.campaignType] ?? "Book a Free Call")
          : "Book a Free Call";
        const { jobId } = await generateAdCopyAsync.mutateAsync({
          serviceId: svcId,
          adType: "lead_gen",
          adStyle: "conversational",
          adCallToAction,
          targetMarket: svc?.targetCustomer || "",
          productCategory: svc?.category || "coaching",
          specificProductName: svc?.name || "",
          pressingProblem: svc?.painPoints || "",
          desiredOutcome: svc?.mainBenefit || "",
        });
        const adCopyResult = await pollJob(jobId);
        if (adCopyResult.adSetId) {
          setLatestAdSetId(adCopyResult.adSetId);
        }
      } else if (step === "landingPage") {
        // Commit 7: read user-selected pageType from Advanced accordion.
        // Server enum default is "sales_page" (landingPages.ts:259); wizard
        // mirrors that as options[0] so users who don't touch Advanced get
        // identical output to today UNLESS Step 0 campaignType is set, in
        // which case the cascade default applies. Advanced override always
        // wins. Cascade map per locked spec Q-D.
        type LandingPageType =
          | "sales_page"
          | "webinar_registration"
          | "discovery_call_booking"
          | "lead_magnet_download"
          | "event_registration";
        const PAGE_TYPE_LABEL_TO_KEY: Record<string, LandingPageType> = {
          "Sales Page": "sales_page",
          "Webinar Registration": "webinar_registration",
          "Discovery Call Booking": "discovery_call_booking",
          "Lead Magnet Download": "lead_magnet_download",
          "Event Registration": "event_registration",
        };
        const CAMPAIGN_TO_PAGE_TYPE: Record<string, LandingPageType> = {
          webinar: "webinar_registration",
          discovery_call: "discovery_call_booking",
          lead_magnet: "lead_magnet_download",
          in_person_event: "event_registration",
          course_launch: "sales_page",
          product_launch: "sales_page",
          challenge: "sales_page",
        };
        const cascadeDefault: LandingPageType = activeKit?.campaignType
          ? (CAMPAIGN_TO_PAGE_TYPE[activeKit.campaignType] ?? "sales_page")
          : "sales_page";
        const advPageTypeLabel = (payload.advancedOverrides as Record<string, string> | undefined)?.pageType;
        const pageType: LandingPageType = advPageTypeLabel ? (PAGE_TYPE_LABEL_TO_KEY[advPageTypeLabel] ?? cascadeDefault) : cascadeDefault;
        const { jobId } = await generateLandingPageAsync.mutateAsync({
          serviceId: svcId,
          pageType,
        });
        // Pass onProgress so the LoadingState shows "Generating angle X of 4…" in real time
        const lpResult = await pollJob(jobId, (label) => setProgressLabel(label));
        if (typeof lpResult.id === 'number') setLatestLandingPageId(lpResult.id);
      } else if (step === "emailSequence") {
        // Path B: UI shows friendly labels; map back to server keys here.
        // Commit 7 expands to all 10 server enum values
        // (emailSequences.ts:804). No-regression: options[0] = "Welcome (3
        // emails over 5 days)" → resolves to "welcome", identical to the
        // previous hardcoded value. sequenceType is REQUIRED on the server
        // (z.enum, not .optional()), so the lookup falls back to "welcome"
        // defensively if anything is off — never undefined.
        type EmailSequenceKey =
          | "welcome"
          | "engagement"
          | "sales"
          | "nurture"
          | "launch"
          | "re-engagement"
          | "discovery_call_confirmation"
          | "discovery_call_reminder"
          | "event_logistics"
          | "replay_for_no_shows";
        const SEQUENCE_TYPE_LABEL_TO_KEY: Record<string, EmailSequenceKey> = {
          "Welcome (3 emails over 5 days)": "welcome",
          "Engagement": "engagement",
          "Sales (cart-open sequence)": "sales",
          "Nurture (7 emails over 21 days)": "nurture",
          "Launch (9 emails around cart-open window)": "launch",
          "Re-engagement (4 emails over 14 days)": "re-engagement",
          "Discovery Call Confirmation": "discovery_call_confirmation",
          "Discovery Call Reminder": "discovery_call_reminder",
          "Event Logistics": "event_logistics",
          "Replay (for event no-shows)": "replay_for_no_shows",
        };
        // Parallel name map — used in the persisted sequence name
        // ("${svc.name} — ${SEQUENCE_TYPE_NAME[sequenceType]}").
        const SEQUENCE_TYPE_NAME: Record<EmailSequenceKey, string> = {
          welcome: "Welcome Sequence",
          engagement: "Engagement Sequence",
          sales: "Sales Sequence",
          nurture: "Nurture Sequence",
          launch: "Launch Sequence",
          "re-engagement": "Re-engagement Sequence",
          discovery_call_confirmation: "Discovery Call Confirmation",
          discovery_call_reminder: "Discovery Call Reminder",
          event_logistics: "Event Logistics",
          replay_for_no_shows: "Replay Sequence",
        };
        const advLabel = (payload.advancedOverrides as Record<string, string> | undefined)?.sequenceType;
        const sequenceType: EmailSequenceKey = advLabel ? (SEQUENCE_TYPE_LABEL_TO_KEY[advLabel] ?? "welcome") : "welcome";
        const { jobId } = await generateEmailSequenceAsync.mutateAsync({
          serviceId: svcId,
          sequenceType,
          name: `${svc?.name || "My Service"} — ${SEQUENCE_TYPE_NAME[sequenceType]}`,
        });
        const emailResult = await pollJob(jobId);
        if (typeof emailResult.id === 'number') setLatestEmailSequenceId(emailResult.id);
      } else if (step === "whatsappSequence") {
        // Path C: read user-selected tone + sequenceLength + sequenceType from
        // Advanced accordion. Schema enums match UI options exactly. If user
        // hasn't touched Advanced, fieldValues defaults match the server schema
        // defaults (type=engagement, length=3, tone=conversational); behavior
        // identical to today's production.
        type WhatsappSequenceKey =
          | "engagement"
          | "sales"
          | "nurture"
          | "discovery_call_confirmation"
          | "discovery_call_reminder"
          | "event_logistics";
        const WA_SEQUENCE_TYPE_LABEL_TO_KEY: Record<string, WhatsappSequenceKey> = {
          "Engagement": "engagement",
          "Sales (cart-open sequence)": "sales",
          "Nurture": "nurture",
          "Discovery Call Confirmation": "discovery_call_confirmation",
          "Discovery Call Reminder": "discovery_call_reminder",
          "Event Logistics": "event_logistics",
        };
        const WA_SEQUENCE_TYPE_NAME: Record<WhatsappSequenceKey, string> = {
          engagement: "Engagement Sequence",
          sales: "Sales Sequence",
          nurture: "Nurture Sequence",
          discovery_call_confirmation: "Discovery Call Confirmation",
          discovery_call_reminder: "Discovery Call Reminder",
          event_logistics: "Event Logistics",
        };
        const advTypeLabel = (payload.advancedOverrides as Record<string, string> | undefined)?.sequenceType;
        const waSequenceType: WhatsappSequenceKey = advTypeLabel ? (WA_SEQUENCE_TYPE_LABEL_TO_KEY[advTypeLabel] ?? "engagement") : "engagement";
        const advTone = (payload.advancedOverrides as Record<string, string> | undefined)?.tone as
          | "conversational"
          | "professional"
          | "urgent"
          | undefined;
        const advLengthRaw = (payload.advancedOverrides as Record<string, string> | undefined)?.sequenceLength;
        const advLength: 3 | 5 | 7 = advLengthRaw === "5" ? 5 : advLengthRaw === "7" ? 7 : 3;
        const { jobId } = await generateWhatsappSequenceAsync.mutateAsync({
          serviceId: svcId,
          sequenceType: waSequenceType,
          name: `${svc?.name || "My Service"} — ${WA_SEQUENCE_TYPE_NAME[waSequenceType]}`,
          tone: advTone ?? "conversational",
          sequenceLength: advLength,
        });
        const waResult = await pollJob(jobId);
        if (typeof waResult.id === 'number') setLatestWhatsappSequenceId(waResult.id);
      } else if (step === "pushToMeta") {
        // No generation needed — just show instructions
      }
      clearTimeout(timeoutRef.current ?? undefined);
      setComplianceScore(100);
      setStatus("success");
      // Invalidate progress so nodes turn green
      utils.progress.getProgress.invalidate();
    } catch (err: unknown) {
      clearTimeout(timeoutRef.current ?? undefined);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("limit") || msg.includes("quota") || msg.includes("FORBIDDEN")) {
        setErrorMsg(msg);
        setStatus("missing_data");
      } else {
        setStatus("error");
      }
    }
  }, [step, activeService, activeKit, generateIcpAsync, generateOfferAsync, generateHeroMechanismAsync, generateHvcoAsync, generateHeadlinesAsync, generateAdCopyAsync, generateLandingPageAsync, generateEmailSequenceAsync, generateWhatsappSequenceAsync, utils, pollIntervalRef]);

  // ── Generate Now handler ──
  function handleGenerateNow() {
    // ── SAFETY CHECK: Service must exist ──
    if (!activeService) {
      setStatus("missing_data");
      setErrorMsg("Complete your Service profile first to unlock this generator.");
      return;
    }

    // ── SAFETY CHECK: ICP must exist (except for the ICP step itself) ──
    if (step !== "icp" && !activeIcp) {
      setStatus("missing_data");
      setErrorMsg("Complete your ICP first to unlock this generator.");
      return;
    }

    // ── Build payload from real saved data ──
    const payload: Record<string, unknown> = {
      step,
      stepLabel,
      serviceId: activeService.id,
      serviceName: activeService.name,
      serviceCategory: activeService.category,
      serviceDescription: activeService.description,
      targetCustomer: activeService.targetCustomer,
      mainBenefit: activeService.mainBenefit,
      painPoints: activeService.painPoints,
      uniqueMechanismSuggestion: activeService.uniqueMechanismSuggestion,
      avatarName: activeService.avatarName,
      avatarTitle: activeService.avatarTitle,
      hvcoTopic: activeService.hvcoTopic,
      riskReversal: activeService.riskReversal,
      failedSolutions: activeService.failedSolutions,
      hiddenReasons: activeService.hiddenReasons,
      falseBeliefsVsRealReasons: activeService.falseBeliefsVsRealReasons,
    };

    if (activeIcp) {
      payload.icpId = activeIcp.id;
      payload.icpName = activeIcp.name;
      payload.icpFears = activeIcp.fears;
      payload.icpGoals = activeIcp.goals;
      payload.icpObjections = activeIcp.objections;
      payload.icpBuyingTriggers = activeIcp.buyingTriggers;
      payload.icpPsychographics = activeIcp.psychographics;
      payload.icpPains = activeIcp.pains;
      payload.icpSuccessMetrics = activeIcp.successMetrics;
      payload.icpImplementationBarriers = activeIcp.implementationBarriers;
    }

    payload.advancedOverrides = { ...fieldValues };
    // Add ICP name from the inline input field
    if (step === "icp" && icpName.trim()) {
      payload.icpName = icpName.trim();
    }
    // ── MANDATORY SAFETY LOG — DO NOT REMOVE ──
    console.log("ZAP V2 Payload Check:", payload);
    runGeneration(payload);
  }

  // ── Retry handler: re-runs the exact same payload ──
  // Function declaration — hoisted, no linting issue with use-before-define.
  function handleRetry() {
    if (lastPayloadRef.current) {
      runGeneration(lastPayloadRef.current);
    } else {
      setStatus("idle");
    }
  }

  // ── Service step: render dedicated V2ServiceStep component ──
  // This early return is placed AFTER all hooks to comply with React's Rules of Hooks.
  if (step === "service") {
    return (
      <V2ServiceStep
        onBack={onBack}
        onComplete={() => navigate("/v2-dashboard/wizard/icp")}
      />
    );
  }

  // ── Commit 7: campaignType picker (Step 0) ──
  // Renders inline (mirrors service early-return pattern). Persists to
  // campaignKits.campaignType via updateSelection mutation. Cascade in
  // landingPage / adCopy dispatchers reads activeKit?.campaignType.
  // Empty state when activeKit is undefined (user must complete Service +
  // ICP first — kit auto-creates on ICP generate per V2Dashboard pattern).
  if (step === "campaignType") {
    type CampaignType =
      | "webinar"
      | "challenge"
      | "course_launch"
      | "product_launch"
      | "discovery_call"
      | "lead_magnet"
      | "in_person_event";
    const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
      webinar: "Webinar",
      challenge: "Challenge",
      course_launch: "Course Launch",
      product_launch: "Product Launch",
      discovery_call: "Discovery Call",
      lead_magnet: "Lead Magnet",
      in_person_event: "In-Person Event",
    };
    const currentValue = (activeKit?.campaignType ?? "") as CampaignType | "";
    const handleChange = async (next: CampaignType) => {
      if (!activeKit) return;
      try {
        await updateKitMutation.mutateAsync({ kitId: activeKit.id, campaignType: next });
        // Commit 7.2 (Bug 2): refetch() instead of invalidate() — invalidate
        // marks queries stale but doesn't immediately refetch; on a fast
        // navigation away (Step 0 → other wizard step → back to dashboard)
        // the dashboard's all-my-kits card could read the cached pre-update
        // value before observing the stale flag. refetch() forces an
        // immediate query update, eliminating the race.
        await utils.campaignKits.getByUser.refetch();
      } catch {
        // Surface failure via existing error UX path; non-blocking otherwise.
        setStatus("error");
      }
    };
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ alignSelf: "flex-start", marginBottom: "24px", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#777", background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", gap: "6px" }}
            >
              ← Back to Campaign Path
            </button>
          )}
          <div style={cardStyle}>
            <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 5vw, 30px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginBottom: "16px", marginTop: 0, textAlign: "center" }}>
              Pick Your Campaign Type
            </h1>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "15px", color: "#555", lineHeight: 1.55, margin: "0 0 28px", textAlign: "center" }}>
              This shapes downstream defaults: landing-page structure, ad CTA, and which sequence types we suggest.
            </p>
            {!activeKit ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <ZappyMascot state="waiting" size={90} />
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "15px", color: "#555", lineHeight: 1.55, margin: "20px 0 24px" }}>
                  Complete your Service profile and ICP first — your campaign kit will be ready to set the type.
                </p>
                <button onClick={() => navigate("/v2-dashboard/wizard/service")} style={primaryBtnStyle}>
                  Start with Service
                </button>
              </div>
            ) : (
              <>
                <select
                  value={currentValue}
                  onChange={(e) => {
                    const v = e.target.value as CampaignType | "";
                    if (v) void handleChange(v);
                  }}
                  disabled={updateKitMutation.isPending}
                  style={{ width: "100%", padding: "14px 16px", fontSize: "16px", fontFamily: "var(--v2-font-body)", border: "1px solid rgba(26,22,36,0.15)", borderRadius: "12px", background: "#fff", color: "var(--v2-text-color)", marginBottom: "12px", cursor: "pointer" }}
                >
                  <option value="" disabled>Select a campaign type…</option>
                  {(Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[]).map((key) => (
                    <option key={key} value={key}>{CAMPAIGN_TYPE_LABELS[key]}</option>
                  ))}
                </select>
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#777", lineHeight: 1.5, margin: "0 0 24px" }}>
                  You can change this later — cascade defaults reapply on the next generation.
                </p>
                <button
                  onClick={() => {
                    const next = getNextStep("campaignType");
                    if (next) navigate(`/v2-dashboard/wizard/${next}`);
                  }}
                  disabled={!currentValue || updateKitMutation.isPending}
                  style={{ ...primaryBtnStyle, opacity: !currentValue || updateKitMutation.isPending ? 0.55 : 1, cursor: !currentValue || updateKitMutation.isPending ? "not-allowed" : "pointer" }}
                >
                  Continue →
                </button>
              </>
            )}
          </div>
        </div>
      </V2Layout>
    );
  }

  // ── Determine which body to render ──
  const showGenerateButton = status === "idle" || status === "missing_data";
  const isErrorState = status === "timeout" || status === "error" || status === "offline";

  return (
    <V2Layout>
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "48px 16px 64px",
      }}>

        {/* ── Back link ── */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              alignSelf: "flex-start",
              marginBottom: "24px",
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "#777",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← Back to Campaign Path
          </button>
        )}

        {/* ── PRIMARY CARD ── */}
        <div style={cardStyle}>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "clamp(22px, 5vw, 30px)",
            color: "var(--v2-text-color)",
            lineHeight: 1.2,
            marginBottom: "32px",
            marginTop: 0,
            textAlign: "center",
          }}>
            Generate {stepLabel} using your AI Profile
          </h1>

          {/* ── WAITING STATE ── */}
          {status === "waiting" && <WaitingState />}

          {/* ── LOADING STATE ── */}
          {status === "loading" && <LoadingState step={step} progressLabel={progressLabel} />}

          {/* ── SUCCESS STATE ── */}
          {status === "success" && (
            <SuccessState
              score={complianceScore}
              nextStepUrl={(() => { const next = getNextStep(step); return next ? `/v2-dashboard/wizard/${next}` : null; })()}
              isLastStep={step === "pushToMeta"}
            />
          )}

          {/* ── NODE 11: Download Campaign Kit card ── */}
          {status === "success" && step === "pushToMeta" && activeService && (
            <div style={{
              marginTop: "16px",
              background: "#fff",
              border: "1px solid rgba(26,22,36,0.10)",
              borderRadius: "16px",
              padding: "20px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📦</div>
              <p style={{
                fontFamily: "var(--v2-font-heading)",
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "18px",
                color: "var(--v2-text-color)",
                margin: "0 0 6px",
              }}>
                Download Campaign Kit
              </p>
              <p style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "13px",
                color: "#777",
                margin: "0 0 16px",
                lineHeight: 1.5,
              }}>
                Get all your assets in one organised ZIP — ready to deploy manually.
              </p>
              <button
                onClick={async () => {
                  setZipDownloading(true);
                  setZipDownloadError(null);
                  try {
                    const result = await utils.campaignExport.generateCampaignZip.fetch({ serviceId: activeService.id });
                    triggerZipDownload(result.base64, result.filename);
                  } catch (err: any) {
                    setZipDownloadError(err?.message || "Download failed. Please try again.");
                  } finally {
                    setZipDownloading(false);
                  }
                }}
                disabled={zipDownloading}
                style={{
                  background: "#1A1624",
                  color: "#fff",
                  border: "none",
                  borderRadius: "9999px",
                  padding: "12px 28px",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: zipDownloading ? "not-allowed" : "pointer",
                  opacity: zipDownloading ? 0.7 : 1,
                  letterSpacing: "0.01em",
                }}
              >
                {zipDownloading ? "Generating ZIP..." : "Download ZIP"}
              </button>
              {zipDownloadError && (
                <p style={{
                  fontFamily: "var(--v2-font-body)",
                  fontSize: "12px",
                  color: "red",
                  marginTop: "8px",
                  margin: "8px 0 0",
                }}>
                  {zipDownloadError}
                </p>
              )}
            </div>
          )}
          {/* ── NODE 11: GHL Snapshot Status card ── */}
          {status === "success" && step === "pushToMeta" && <Node11GhlCard />}

          {/* ── R1a: NODE 6 HEADLINES RESULT PANEL ── */}
          {status === "success" && step === "headlines" && latestHeadlineSetId && activeService && (
            <V2HeadlinesResultPanel
              headlineSetId={latestHeadlineSetId}
              serviceId={activeService.id}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1a: NODE 7 AD COPY RESULT PANEL ── */}
          {status === "success" && step === "adCopy" && latestAdSetId && activeService && (
            <V2AdCopyResultPanel
              adSetId={latestAdSetId}
              serviceId={activeService.id}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 2 ICP RESULT PANEL ── */}
          {status === "success" && step === "icp" && latestIcpId && (
            <V2ICPResultPanel
              icpId={latestIcpId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 3 OFFER RESULT PANEL ── */}
          {status === "success" && step === "offer" && latestOfferId && (
            <V2OfferResultPanel
              offerId={latestOfferId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 4 UNIQUE METHOD RESULT PANEL ── */}
          {status === "success" && step === "uniqueMethod" && latestMechanismSetId && (
            <V2UniqueMethodResultPanel
              mechanismSetId={latestMechanismSetId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
              generationWarning={latestMechWarning}
              onRetry={() => {
                // Retry path analysis:
                // (1) lastPayloadRef holds the uniqueMethod inputs from runGeneration — still correct here.
                // (2) handleRetry() calls runGeneration(lastPayloadRef.current) which sets status
                //     "waiting"→"loading"→"success"; showGenerateButton (idle/missing_data) acts as
                //     fallback if lastPayloadRef is null (handleRetry falls back to setStatus("idle")).
                // (3) On successful retry, runGeneration sets setLatestMechWarning(undefined) via the
                //     else branch at the mechResult polling site — warning clears automatically.
                setLatestMechanismSetId(null);
                setLatestMechWarning(undefined);
                handleRetry(); // auto-re-runs generation; no second click required
              }}
            />
          )}
          {/* ── R1b: NODE 5 FREE OPT-IN RESULT PANEL ── */}
          {status === "success" && step === "freeOptIn" && latestHvcoSetId && (
            <V2FreeOptInResultPanel
              hvcoSetId={latestHvcoSetId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 8 LANDING PAGE RESULT PANEL ── */}
          {status === "success" && step === "landingPage" && latestLandingPageId && (
            <V2LandingPageResultPanel
              landingPageId={latestLandingPageId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 9 EMAIL SEQUENCE RESULT PANEL ── */}
          {status === "success" && step === "emailSequence" && latestEmailSequenceId && (
            <V2EmailSequenceResultPanel
              emailSequenceId={latestEmailSequenceId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}
          {/* ── R1b: NODE 10 WHATSAPP RESULT PANEL ── */}
          {status === "success" && step === "whatsappSequence" && latestWhatsappSequenceId && (
            <V2WhatsAppResultPanel
              whatsappSequenceId={latestWhatsappSequenceId}
              onContinue={() => {
                const next = getNextStep(step);
                if (next) navigate(`/v2-dashboard/wizard/${next}`);
              }}
            />
          )}

          {/* ── CONCERNED STATE (compliance violations) ── */}
          {status === "concerned" && (
            <ConcernedState score={complianceScore} violations={complianceViolations} />
          )}

          {/* ── SCENARIO 1: API TIMEOUT ── */}
          {status === "timeout" && (
            <ErrorBanner
              message="Zappy timed out waiting for the AI. Your internet is fine — the server just got busy. Try again."
              retryLabel="Try Again"
              onRetry={handleRetry}
            />
          )}

          {/* ── SCENARIO 2: MID-GENERATION FAILURE ── */}
          {status === "error" && (
            <ErrorBanner
              message="Something went wrong halfway through. Your inputs are saved — just hit Generate Again."
              retryLabel="Generate Again"
              onRetry={handleRetry}
            />
          )}

          {/* ── SCENARIO 3: NETWORK LOSS ── */}
          {status === "offline" && (
            <ErrorBanner
              message="Zappy lost the connection. Check your internet and try again."
              retryLabel="Try Again"
              onRetry={handleRetry}
            />
          )}

          {/* ── MISSING DATA MESSAGE ── */}
          {status === "missing_data" && (
            <div style={{
              background: "rgba(255,91,29,0.08)",
              border: "1px solid rgba(255,91,29,0.25)",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "24px",
              fontFamily: "var(--v2-font-body)",
              fontSize: "14px",
              color: "#C0390A",
              textAlign: "center",
            }}>
              {errorMsg}
            </div>
          )}

          {/* ── LOCKED UPGRADE STATE (Free tier on pro-gated nodes 6–11) ── */}
          {isFreeTier && PRO_GATED_STEPS.includes(step) ? (
            <LockedUpgradeState step={step} navigate={navigate} />
          ) : (
            <>
              {/* ── IDLE STATE: Zappy waiting ── */}
              {status === "idle" && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                  <ZappyMascot state="waiting" size={90} />
                </div>
              )}
              {/* ── ICP NAME INPUT (only shown for ICP step in idle state) ── */}
              {step === "icp" && showGenerateButton && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    fontFamily: "var(--v2-font-body)",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "var(--v2-text-color)",
                    marginBottom: "8px",
                  }}>
                    Name your Ideal Customer Profile
                  </label>
                  <input
                    type="text"
                    value={icpName}
                    onChange={e => setIcpName(e.target.value)}
                    placeholder="e.g. Ambitious Executive, Mid-Career Professional"
                    style={{
                      width: "100%",
                      fontFamily: "var(--v2-font-body)",
                      fontSize: "14px",
                      color: "var(--v2-text-color)",
                      background: "#F9F7F4",
                      border: "1px solid rgba(26,22,36,0.15)",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      outline: "none",
                      boxSizing: "border-box" as const,
                    }}
                  />
                </div>
              )}
              {/* ── GENERATE NOW button (only shown in idle / missing_data states) ── */}
              {showGenerateButton && (
                <button
                  onClick={handleGenerateNow}
                  style={primaryBtnStyle}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  Generate Now
                </button>
              )}
              {/* Skip link — only shown in pre-generation state (showGenerateButton), not after results */}
              {showGenerateButton && STEP_TO_MILESTONE[step] && step !== "pushToMeta" && !skippedNodes?.includes(STEP_TO_MILESTONE[step]) && (
                <button
                  disabled={skipMutation.isPending}
                  onClick={() => {
                    const milestoneId = STEP_TO_MILESTONE[step];
                    if (!milestoneId || !serviceId) return;
                    skipMutation.mutate(
                      { serviceId, nodeType: milestoneId },
                      {
                        onSuccess: () => {
                          utils.progress.getProgress.invalidate();
                          const stepOrder = ["service","icp","offer","uniqueMethod","freeOptIn","headlines","adCopy","landingPage","emailSequence","whatsappSequence","pushToMeta"];
                          const currentIdx = stepOrder.indexOf(step);
                          if (currentIdx >= 0 && currentIdx < stepOrder.length - 1) {
                            navigate(`/v2-dashboard/wizard/${stepOrder[currentIdx + 1]}`);
                          }
                        },
                      }
                    );
                  }}
                  style={{
                    display: "block", textAlign: "center" as const, marginTop: 12, fontSize: 13,
                    color: skipMutation.isPending ? "#ccc" : "#999",
                    cursor: skipMutation.isPending ? "not-allowed" : "pointer",
                    pointerEvents: skipMutation.isPending ? "none" : "auto",
                    textDecoration: "underline", fontFamily: "Instrument Sans, sans-serif",
                    background: "none", border: "none", width: "100%", padding: 0,
                  }}
                >
                  {skipMutation.isPending ? "Skipping…" : "Skip this node — I already have this"}
                </button>
              )}
              {showGenerateButton && STEP_TO_MILESTONE[step] && step !== "pushToMeta" && skippedNodes?.includes(STEP_TO_MILESTONE[step]) && (
                <p style={{ display: "block", textAlign: "center" as const, marginTop: 12, fontSize: 13, color: "#FF5B1D", fontFamily: "Instrument Sans, sans-serif", margin: "12px 0 0" }}>
                  This node was skipped — generate now to add content.
                </p>
              )}
            </>
          )}

          {/* ── Try Again / Generate Again button after concerned/success ── */}
          {(status === "success" || status === "concerned") && (
            <button
              onClick={() => { setStatus("idle"); }}
              style={secondaryBtnStyle}
            >
              ↺ Generate Again
            </button>
          )}

          {/* ── Back to idle after error states (secondary option) ── */}
          {isErrorState && (
            <button
              onClick={() => setStatus("idle")}
              style={{ ...secondaryBtnStyle, marginTop: "8px" }}
            >
              ← Back
            </button>
          )}

          {/* ── ADVANCED TOGGLE — only renders when this step has wired fields ──
              Empty arrays in ADVANCED_FIELDS (uniqueMethod / headlines / adCopy /
              landingPage / emailSequence / whatsappSequence) intentionally
              suppress the toggle until Path A wires them end-to-end. ── */}
          {advancedFields.length > 0 && (
          <div style={{ textAlign: "center", marginTop: showGenerateButton ? "0" : "8px" }}>
            <button
              onClick={() => setAccordionOpen(prev => !prev)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--v2-font-body)",
                fontSize: "12px",
                color: "#777777",
                padding: "4px 8px",
                letterSpacing: "0.02em",
                textDecoration: "underline",
                textDecorationColor: "rgba(119,119,119,0.4)",
              }}
            >
              {accordionOpen ? "▲ Hide Advanced Inputs" : "Advanced: Edit AI Inputs"}
            </button>
          </div>
          )}

          {/* ── ACCORDION (CSS max-height transition, NOT display:none) ── */}
          {advancedFields.length > 0 && (
          <div style={{
            maxHeight: accordionOpen ? "800px" : "0px",
            overflow: "hidden",
            transition: "max-height 0.35s ease",
          }}>
            <div style={{
              paddingTop: "24px",
              borderTop: "1px solid rgba(26,22,36,0.08)",
              marginTop: "20px",
            }}>
              <p style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: "12px",
                color: "#888",
                marginTop: 0,
                marginBottom: "20px",
                lineHeight: 1.5,
              }}>
                These fields are pre-filled from your AI Profile. Override them only if you want to customise this generation.
              </p>
              {advancedFields.map(field => (
                <AdvancedFieldInput
                  key={field.key}
                  field={field}
                  value={fieldValues[field.key] ?? ""}
                  onChange={val => setFieldValues(prev => ({ ...prev, [field.key]: val }))}
                />
              ))}
            </div>
          </div>
          )}

        </div>

        {/* ── Data source transparency note ── */}
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "12px",
          color: "#999",
          textAlign: "center",
          marginTop: "20px",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}>
          Your AI Profile (Service + ICP) is automatically bundled into every generation. No re-entry needed.
        </p>

      </div>
    </V2Layout>
  );
}
