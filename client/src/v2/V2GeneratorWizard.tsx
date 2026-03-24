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
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import { type WizardStep, STEP_LABELS, getNextStep } from "./v2-constants";
import V2HeadlinesResultPanel from "./V2HeadlinesResultPanel";
import RecommendedAssetPanel from "./RecommendedAssetPanel";
import V2AdCopyResultPanel from "./V2AdCopyResultPanel";
import V2ICPResultPanel from "./V2ICPResultPanel";
import V2OfferResultPanel from "./V2OfferResultPanel";
import V2UniqueMethodResultPanel from "./V2UniqueMethodResultPanel";
import V2FreeOptInResultPanel from "./V2FreeOptInResultPanel";
import V2LandingPageResultPanel from "./V2LandingPageResultPanel";
import V2EmailSequenceResultPanel from "./V2EmailSequenceResultPanel";
import V2WhatsAppResultPanel from "./V2WhatsAppResultPanel";
import QuotaIndicator, { getLimit } from "./components/QuotaIndicator";
import UpgradePrompt from "./components/UpgradePrompt";

export type { WizardStep };

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
  service: [],
  icp: [
    { key: "name", label: "ICP Name / Label", type: "text", placeholder: "e.g. Mid-Career Professional", sourceNote: "Auto-generated from your service avatar" },
  ],
  offer: [
    { key: "offerType", label: "Offer Type", type: "select", options: ["standard", "premium", "vip"], sourceNote: "Defaults to 'premium'" },
  ],
  uniqueMethod: [
    { key: "mechanismName", label: "Mechanism Name Override", type: "text", placeholder: "Leave blank to use AI suggestion", sourceNote: "AI generates this from your service description" },
    { key: "applicationMethod", label: "Application Method", type: "text", placeholder: "e.g. 6-week group coaching", sourceNote: "Pulled from your service profile" },
  ],
  freeOptIn: [
    { key: "hvcoTopic", label: "Lead Magnet Topic Override", type: "text", placeholder: "Leave blank to use AI suggestion", sourceNote: "AI generates this from your service profile" },
  ],
  headlines: [
    { key: "formulaType", label: "Headline Style", type: "select", options: ["all", "story", "eyebrow", "question", "authority", "urgency"], optionLabels: { all: "All Styles", story: "Tell Your Story", eyebrow: "Make a Bold Claim", question: "Ask Their Question", authority: "Lead with Credentials", urgency: "Create Urgency" }, sourceNote: "All Styles generates 5 per type. Selecting one generates 25 of that type." },
  ],
  adCopy: [
    { key: "platform", label: "Ad Platform", type: "select", options: ["Facebook", "Instagram", "LinkedIn", "YouTube"], sourceNote: "Defaults to Facebook" },
    { key: "adFormat", label: "Ad Format", type: "select", options: ["single-image", "carousel", "video-script", "story"], sourceNote: "Defaults to single-image" },
  ],
  landingPage: [
    { key: "pageStyle", label: "Page Style", type: "select", options: ["VSL", "long-form", "short-form", "webinar-registration"], sourceNote: "Defaults to long-form" },
  ],
  emailSequence: [
    { key: "sequenceType", label: "Sequence Type", type: "select", options: ["welcome", "nurture", "launch", "re-engagement"], sourceNote: "Defaults to nurture" },
    { key: "emailCount", label: "Number of Emails", type: "select", options: ["3", "5", "7", "10"], sourceNote: "Defaults to 5" },
  ],
  whatsappSequence: [
    { key: "sequenceLength", label: "Sequence Length", type: "select", options: ["3", "5", "7"], sourceNote: "Defaults to 5" },
    { key: "tone", label: "Tone", type: "select", options: ["conversational", "professional", "urgent"], sourceNote: "Pulled from your brand voice" },
  ],
  pushToMeta: [
    { key: "platform", label: "Platform", type: "select", options: ["Meta Ads Manager", "GoHighLevel"], sourceNote: "Defaults to Meta Ads Manager" },
  ],
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
          {field.options?.map(opt => <option key={opt} value={opt}>{(field as any).optionLabels?.[opt] || opt}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} style={{ ...inputBase, resize: "vertical" }} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={inputBase} />
      )}
      {field.key === "formulaType" && value && value !== "all" && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#999", margin: "6px 0 0", lineHeight: 1.5 }}>
          {value === "story" && "Generates narrative headlines that open with a triggering event and end with a specific measurable result. Best for emotional niches."}
          {value === "eyebrow" && "Generates three-part headlines with an authority eyebrow, a mechanism-focused main line, and a pain-point subheadline."}
          {value === "question" && "Generates question headlines that mirror what your ideal client is already thinking. Best for curiosity-driven campaigns."}
          {value === "authority" && "Generates headlines that lead with credentials and proven results. Best when the coach has strong qualifications."}
          {value === "urgency" && "Generates headlines with specific timeframes and action verbs. Best for time-limited offers and launches."}
        </p>
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
const LOADING_MESSAGES_DEFAULT = [
  "Zappy is analysing your inputs…",
  "Building your assets from your AI Profile…",
  "Applying Meta compliance checks…",
  "Almost there — finalising your content now…",
];

const LOADING_MESSAGES_BY_STEP: Record<string, string[]> = {
  headlines: [
    "Generating 25 headlines across 5 proven formulas…",
    "Scoring each headline for Meta compliance…",
    "Calculating which formula type fits your audience…",
    "Ranking by persuasion strength and character count…",
    "Picking your best headline…",
  ],
  offer: [
    "Generating 3 offer angles for your service...",
    "Scoring each angle for persuasion and compliance...",
    "Selecting the strongest offer for your audience...",
  ],
  icp: [
    "Researching your ideal customer's world…",
    "Mapping pain points, desires, and buying triggers…",
    "Building a 17-section customer intelligence profile…",
  ],
  uniqueMethod: [
    "Generating your unique mechanism names...",
    "Scoring for clarity and memorability...",
    "Picking your strongest mechanism...",
  ],
  freeOptIn: [
    "Generating lead magnet title options...",
    "Scoring for curiosity and click-through potential...",
    "Selecting your most compelling opt-in title...",
  ],
  adCopy: [
    "Generating ad copy variations...",
    "Scoring for Meta compliance and hook strength...",
    "Selecting your highest-performing ad copy...",
  ],
  landingPage: [
    "Generating 4 landing page angles...",
    "Scoring each angle for conversion potential...",
    "Selecting your strongest landing page...",
  ],
  emailSequence: [
    "Generating your email sequence...",
    "Scoring for deliverability and engagement...",
    "Finalising your email sequence...",
  ],
  whatsappSequence: [
    "Generating your WhatsApp sequence...",
    "Scoring for conversational tone and response rate...",
    "Finalising your WhatsApp sequence...",
  ],
};

function LoadingState({ step: _step, progressLabel }: { step?: string; progressLabel?: string | null }) {
  const messages = (_step && LOADING_MESSAGES_BY_STEP[_step]) || LOADING_MESSAGES_DEFAULT;
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  // Track previous progressLabel to trigger fade animation on change
  const [labelVisible, setLabelVisible] = useState(true);
  const prevLabelRef = useRef(progressLabel);

  // Cycle messages every 2 seconds with fade (only when no real progress label)
  useEffect(() => {
    if (progressLabel) return; // real progress takes over
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(prev => (prev + 1) % messages.length);
        setVisible(true);
      }, 400);
    }, 2_000);
    return () => clearInterval(interval);
  }, [progressLabel, messages.length]);

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

  const displayMessage = progressLabel ?? messages[msgIndex];

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

// ─── Route guard: gate map for sequential progression ─────────────────────────
const STEP_GATES: Record<string, string> = {
  uniqueMethod: "selectedOfferId",
  freeOptIn: "selectedMechanismId",
  headlines: "selectedHvcoId",
  adCopy: "selectedHeadlineId",
  landingPage: "selectedAdCopyId",
  emailSequence: "selectedLandingPageId",
  whatsappSequence: "selectedEmailSequenceId",
};

const GATE_ORDER: string[] = ["offer", "uniqueMethod", "freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence"];

function findFirstIncompleteStep(kit: any): string {
  for (const s of GATE_ORDER) {
    const gate = STEP_GATES[s];
    if (gate && kit[gate] == null) return s;
  }
  return "offer"; // fallback
}

// ─── CampaignKitSidebar: persistent sidebar showing selection state ─────────────
const KIT_SLOTS: Array<{ label: string; field: string; step: string; num: number }> = [
  { label: "Offer", field: "selectedOfferId", step: "offer", num: 3 },
  { label: "Method", field: "selectedMechanismId", step: "uniqueMethod", num: 4 },
  { label: "Lead Magnet", field: "selectedHvcoId", step: "freeOptIn", num: 5 },
  { label: "Headline", field: "selectedHeadlineId", step: "headlines", num: 6 },
  { label: "Ad Copy", field: "selectedAdCopyId", step: "adCopy", num: 7 },
  { label: "Landing Page", field: "selectedLandingPageId", step: "landingPage", num: 8 },
  { label: "Email Sequence", field: "selectedEmailSequenceId", step: "emailSequence", num: 9 },
  { label: "WhatsApp", field: "selectedWhatsAppSequenceId", step: "whatsappSequence", num: 10 },
];

function CampaignKitSidebar({ kit, currentStep, onNavigate }: { kit: any; currentStep: string; onNavigate: (step: string) => void }) {
  if (!kit) return null;

  const filledCount = KIT_SLOTS.filter(s => kit[s.field] != null).length;
  const totalSlots = KIT_SLOTS.length;
  const isComplete = filledCount === totalSlots;
  const pct = Math.round((filledCount / totalSlots) * 100);

  return (
    <aside style={{
      width: 260,
      minWidth: 260,
      maxWidth: 260,
      background: "#fff",
      borderLeft: "1px solid #e5e0d8",
      padding: "20px",
      position: "sticky",
      top: 0,
      maxHeight: "100vh",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    }}>
      {/* Header */}
      <div>
        <h3 style={{
          fontFamily: "var(--v2-font-heading, 'Fraunces', serif)",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "18px",
          color: "var(--v2-text-dark, #1A1624)",
          margin: 0,
        }}>
          🎯 Campaign Kit
        </h3>
        <p style={{
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontSize: "12px",
          color: "#999",
          margin: "4px 0 0",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {kit.name || "Loading..."}
        </p>
      </div>

      {/* Slot rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {KIT_SLOTS.map(slot => {
          const isFilled = kit[slot.field] != null;
          const isCurrent = slot.step === currentStep;
          // A slot is locked if its gate field is defined and the PREVIOUS gate is not met
          const gateField = STEP_GATES[slot.step];
          const isLocked = !isFilled && gateField && kit[gateField] == null;

          return (
            <button
              key={slot.field}
              onClick={() => { if (!isLocked) onNavigate(slot.step); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "10px",
                border: "none",
                background: isCurrent ? "rgba(255,91,29,0.08)" : isFilled ? "rgba(88,204,2,0.06)" : "transparent",
                cursor: isLocked ? "default" : "pointer",
                width: "100%",
                textAlign: "left",
                transition: "background 0.15s",
                opacity: isLocked ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!isFilled && !isLocked) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)"; }}
              onMouseLeave={e => { if (!isFilled && !isLocked && !isCurrent) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Step number indicator */}
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "50%",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                background: isFilled ? "#58CC02" : isCurrent ? "var(--v2-primary-btn, #FF5B1D)" : isLocked ? "#e5e0d8" : "#ddd",
                color: (isFilled || isCurrent) ? "#fff" : isLocked ? "#bbb" : "#888",
                flexShrink: 0,
              }}>
                {isFilled ? "✓" : slot.num}
              </span>
              <span style={{
                fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
                fontSize: "13px",
                fontWeight: isFilled || isCurrent ? 600 : 400,
                color: isFilled ? "var(--v2-text-dark, #1A1624)" : isCurrent ? "var(--v2-primary-btn, #FF5B1D)" : isLocked ? "#ccc" : "#999",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}>
                {slot.label}
              </span>
              {isLocked && (
                <span style={{ fontSize: "12px", color: "#ccc" }}>🔒</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div>
        <p style={{
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--v2-text-dark, #1A1624)",
          margin: "0 0 6px",
        }}>
          {filledCount} of {totalSlots} selected
        </p>
        <div style={{
          height: 6,
          borderRadius: 3,
          background: "#e5e0d8",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: isComplete ? "#58CC02" : "var(--v2-primary-btn, #FF5B1D)",
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      {/* View Campaign Kit button */}
      <a
        href={isComplete ? `/v2-dashboard/campaign-kit/${kit.id}` : undefined}
        onClick={e => { if (!isComplete) e.preventDefault(); }}
        style={{
          display: "block",
          textAlign: "center",
          padding: "10px 16px",
          borderRadius: "var(--v2-border-radius-pill, 9999px)",
          background: isComplete ? "var(--v2-primary-btn, #FF5B1D)" : "#e5e0d8",
          color: isComplete ? "#fff" : "#999",
          fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
          fontWeight: 700,
          fontSize: "13px",
          textDecoration: "none",
          cursor: isComplete ? "pointer" : "default",
          transition: "all 0.2s ease",
        }}
      >
        {isComplete ? "View Campaign Kit" : `${totalSlots - filledCount} remaining`}
      </a>
    </aside>
  );
}

// ─── UseThisButton: campaign kit selection button ──────────────────────────────
function UseThisButton({ isSelected, onClick, loading }: { isSelected: boolean; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        width: "100%",
        padding: "10px 16px",
        marginTop: "12px",
        borderRadius: "var(--v2-border-radius-pill, 9999px)",
        border: isSelected ? "2px solid #58CC02" : "2px solid var(--v2-primary-btn, #FF5B1D)",
        background: isSelected ? "#58CC02" : "transparent",
        color: isSelected ? "#fff" : "var(--v2-primary-btn, #FF5B1D)",
        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
        fontWeight: 700,
        fontSize: "14px",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "all 0.2s ease",
      }}
    >
      {loading ? "Saving..." : isSelected ? "✓ In Campaign" : "Use This"}
    </button>
  );
}

// ─── HeadlineRecommendation: Node 6 recommended asset wrapper ──────────────────
function HeadlineRecommendation({ headlineSetId, serviceId, service, campaignKit, onSelect, onRegenerate }: {
  headlineSetId: string;
  serviceId: number;
  service: any;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  // Fetch all headlines for this set (returns { headlineSetId, headlines: { story, eyebrow, ... }, metadata })
  const { data: headlineData } = trpc.headlines.getBySetId.useQuery(
    { headlineSetId },
    { enabled: !!headlineSetId }
  );

  // Check if first campaign
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!headlineData || !headlineData.headlines) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading headlines...</p>;
  }

  // Flatten all formula groups into a single array
  const allHeadlines: any[] = [];
  for (const formulaType of ["story", "eyebrow", "question", "authority", "urgency"] as const) {
    const group = headlineData.headlines[formulaType];
    if (group) allHeadlines.push(...group);
  }

  if (allHeadlines.length === 0) return null;

  // Sort by selectionScore descending
  const sorted = [...allHeadlines].sort((a: any, b: any) => (Number(b.selectionScore) || 0) - (Number(a.selectionScore) || 0));

  // Primary: highest scored
  const primary = sorted[0];
  if (!primary) return null;

  // Alternatives: next 2 from DIFFERENT formula types
  const primaryFormula = primary.formulaType || "";
  const alts = sorted
    .filter((h: any) => (h.formulaType || "") !== primaryFormula)
    .slice(0, 2);

  // All assets for the drawer
  const allAssets = sorted.map((h: any) => ({
    id: h.id,
    content: h.headline || "",
    score: h.selectionScore ? Number(h.selectionScore) : null,
    formulaLabel: h.formulaType || undefined,
  }));

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: primary.id,
        content: primary.headline || "",
        score: primary.selectionScore ? Number(primary.selectionScore) : null,
        formulaLabel: primary.formulaType || undefined,
        characterCount: (primary.headline || "").length,
      }}
      alternativeAssets={alts.map((h: any) => ({
        id: h.id,
        content: h.headline || "",
        score: h.selectionScore ? Number(h.selectionScore) : null,
        formulaLabel: h.formulaType || undefined,
      }))}
      allAssets={allAssets}
      nodeLabel="headline"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── OfferRecommendation: Node 3 recommended asset wrapper ──────────────────
function OfferRecommendation({ offerId, campaignKit, onSelect, onRegenerate }: {
  offerId: number;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: offer } = trpc.offers.get.useQuery({ id: offerId }, { enabled: !!offerId });
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!offer) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading offer...</p>;
  }

  // Parse the 3 angle columns into virtual items
  const parseAngle = (raw: any): Record<string, any> | null => {
    if (!raw) return null;
    if (typeof raw === "string") try { return JSON.parse(raw); } catch { return null; }
    return raw as Record<string, any>;
  };

  const godfather = parseAngle(offer.godfatherAngle);
  const free = parseAngle(offer.freeAngle);
  const dollar = parseAngle(offer.dollarAngle);

  const angleItems = [
    { key: "godfather", angle: godfather },
    { key: "free", angle: free },
    { key: "dollar", angle: dollar },
  ].filter(a => a.angle);

  if (angleItems.length === 0) return null;

  const toContent = (angle: Record<string, any> | null): string => {
    if (!angle) return "";
    const name = angle.offerName || angle.name || "";
    const vp = angle.valueProposition || angle.headline || "";
    return name && vp ? `${name} — ${vp}` : name || vp || JSON.stringify(angle).slice(0, 120);
  };

  const primary = {
    id: offerId,
    content: toContent(angleItems[0].angle),
    score: offer.selectionScore ? Number(offer.selectionScore) : null,
    formulaLabel: angleItems[0].key,
  };

  const alternatives = angleItems.slice(1).map(a => ({
    id: offerId,
    content: toContent(a.angle),
    score: offer.selectionScore ? Number(offer.selectionScore) : null,
    formulaLabel: a.key,
  }));

  const allAssets = [primary, ...alternatives];

  return (
    <RecommendedAssetPanel
      primaryAsset={primary}
      alternativeAssets={alternatives}
      allAssets={allAssets}
      nodeLabel="offer"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── MechanismRecommendation: Node 4 recommended asset wrapper ──────────────
function MechanismRecommendation({ mechanismSetId, campaignKit, onSelect, onRegenerate }: {
  mechanismSetId: string;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: mechanisms } = trpc.heroMechanisms.getBySetId.useQuery(
    { mechanismSetId },
    { enabled: !!mechanismSetId }
  );
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!mechanisms || !Array.isArray(mechanisms) || mechanisms.length === 0) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading mechanisms...</p>;
  }

  const sorted = [...mechanisms].sort((a: any, b: any) => (Number(b.selectionScore) || 0) - (Number(a.selectionScore) || 0));
  const top3 = sorted.slice(0, 3);
  const primary = top3[0];
  const alts = top3.slice(1);

  const toContent = (m: any) => {
    const desc = (m.mechanismDescription || "").slice(0, 100);
    return `${m.mechanismName || ""}${desc ? " — " + desc : ""}`;
  };

  const allAssets = sorted.map((m: any) => ({
    id: m.id,
    content: toContent(m),
    score: m.selectionScore ? Number(m.selectionScore) : null,
  }));

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: primary.id,
        content: toContent(primary),
        score: primary.selectionScore ? Number(primary.selectionScore) : null,
      }}
      alternativeAssets={alts.map((m: any) => ({
        id: m.id,
        content: toContent(m),
        score: m.selectionScore ? Number(m.selectionScore) : null,
      }))}
      allAssets={allAssets}
      nodeLabel="mechanism"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── HvcoRecommendation: Node 5 recommended asset wrapper ───────────────────
function HvcoRecommendation({ hvcoSetId, campaignKit, onSelect, onRegenerate }: {
  hvcoSetId: string;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: titles } = trpc.hvco.getBySetId.useQuery(
    { hvcoSetId },
    { enabled: !!hvcoSetId }
  );
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!titles || !Array.isArray(titles) || titles.length === 0) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading opt-in titles...</p>;
  }

  const sorted = [...titles].sort((a: any, b: any) => (Number(b.selectionScore) || 0) - (Number(a.selectionScore) || 0));
  const top3 = sorted.slice(0, 3);
  const primary = top3[0];
  const alts = top3.slice(1);

  const allAssets = sorted.map((t: any) => ({
    id: t.id,
    content: t.title || "",
    score: t.selectionScore ? Number(t.selectionScore) : null,
  }));

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: primary.id,
        content: primary.title || "",
        score: primary.selectionScore ? Number(primary.selectionScore) : null,
      }}
      alternativeAssets={alts.map((t: any) => ({
        id: t.id,
        content: t.title || "",
        score: t.selectionScore ? Number(t.selectionScore) : null,
      }))}
      allAssets={allAssets}
      nodeLabel="opt-in title"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── AdCopyRecommendation: Node 7 recommended asset wrapper ─────────────────
function AdCopyRecommendation({ adSetId, campaignKit, onSelect, onRegenerate }: {
  adSetId: string;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: ads } = trpc.adCopy.getByAdSetId.useQuery(
    { adSetId },
    { enabled: !!adSetId }
  );
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!ads) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading ad copy...</p>;
  }

  // getByAdSetId returns { headlines: [], bodies: [], links: [], ... } — flatten into a single array
  const allItems: any[] = [
    ...((ads as any).headlines || []),
    ...((ads as any).bodies || []),
    ...((ads as any).links || []),
  ];
  if (allItems.length === 0) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>No ad copy found.</p>;
  }

  const sorted = [...allItems].sort((a: any, b: any) => (Number(b.selectionScore) || 0) - (Number(a.selectionScore) || 0));
  const top3 = sorted.slice(0, 3);
  const primary = top3[0];
  const alts = top3.slice(1);

  const allAssets = sorted.map((a: any) => ({
    id: a.id,
    content: (a.content || "").slice(0, 120),
    score: a.selectionScore ? Number(a.selectionScore) : null,
    formulaLabel: a.contentType || undefined,
  }));

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: primary.id,
        content: (primary.content || "").slice(0, 120),
        score: primary.selectionScore ? Number(primary.selectionScore) : null,
        formulaLabel: primary.contentType || undefined,
      }}
      alternativeAssets={alts.map((a: any) => ({
        id: a.id,
        content: (a.content || "").slice(0, 120),
        score: a.selectionScore ? Number(a.selectionScore) : null,
        formulaLabel: a.contentType || undefined,
      }))}
      allAssets={allAssets}
      nodeLabel="ad copy"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── LandingPageRecommendation: Node 8 recommended asset wrapper ────────────
function LandingPageRecommendation({ landingPageId, campaignKit, onSelect, onRegenerate }: {
  landingPageId: number;
  campaignKit: any;
  onSelect: (id: number, angle: string) => void;
  onRegenerate: () => void;
}) {
  const { data: page } = trpc.landingPages.get.useQuery({ id: landingPageId }, { enabled: !!landingPageId });
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!page) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading landing page...</p>;
  }

  const parseAngle = (raw: any): Record<string, any> | null => {
    if (!raw) return null;
    if (typeof raw === "string") try { return JSON.parse(raw); } catch { return null; }
    return raw as Record<string, any>;
  };

  const angles = [
    { key: "original", angle: parseAngle(page.originalAngle) },
    { key: "godfather", angle: parseAngle(page.godfatherAngle) },
    { key: "free", angle: parseAngle(page.freeAngle) },
    { key: "dollar", angle: parseAngle(page.dollarAngle) },
  ].filter(a => a.angle);

  if (angles.length === 0) return null;

  const toContent = (angle: Record<string, any> | null): string => {
    if (!angle) return "";
    return angle.mainHeadline || angle.headline || JSON.stringify(angle).slice(0, 120);
  };

  // Use a unique pseudo-id for each angle (encode angle index into id for selection)
  const primary = {
    id: landingPageId,
    content: toContent(angles[0].angle),
    score: page.selectionScore ? Number(page.selectionScore) : null,
    formulaLabel: angles[0].key,
  };

  const alternatives = angles.slice(1).map(a => ({
    id: landingPageId,
    content: toContent(a.angle),
    score: page.selectionScore ? Number(page.selectionScore) : null,
    formulaLabel: a.key,
  }));

  const allAssets = [primary, ...alternatives];

  // Wrap onSelect to pass angle name alongside the id
  const handleSelect = (_id: number) => {
    // Determine which angle was clicked based on the caller — default to first angle
    // Since all items share the same id, we select the primary angle
    onSelect(landingPageId, angles[0].key);
  };

  return (
    <RecommendedAssetPanel
      primaryAsset={primary}
      alternativeAssets={alternatives.map((a, i) => ({
        ...a,
        // Override id to encode angle index so we can differentiate on click
        id: landingPageId * 100 + (i + 1),
      }))}
      allAssets={allAssets}
      nodeLabel="landing page"
      isFirstCampaign={!hasCompleted}
      onSelect={(selectedId: number) => {
        // Decode: if selectedId > landingPageId * 10 it's an alternative
        if (selectedId === landingPageId) {
          onSelect(landingPageId, angles[0].key);
        } else {
          const altIndex = selectedId - landingPageId * 100;
          const angleKey = angles[altIndex]?.key || angles[0].key;
          onSelect(landingPageId, angleKey);
        }
      }}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── EmailRecommendation: Node 9 recommended asset wrapper ──────────────────
function EmailRecommendation({ emailSequenceId, campaignKit, onSelect, onRegenerate }: {
  emailSequenceId: number;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: sequence } = trpc.emailSequences.get.useQuery({ id: emailSequenceId }, { enabled: !!emailSequenceId });
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!sequence) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading email sequence...</p>;
  }

  const emails = typeof sequence.emails === "string" ? JSON.parse(sequence.emails) : (sequence.emails || []);
  const emailCount = Array.isArray(emails) ? emails.length : 0;
  const content = `${sequence.name || "Email Sequence"} — ${emailCount} email${emailCount !== 1 ? "s" : ""}`;

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: sequence.id,
        content,
        score: sequence.selectionScore ? Number(sequence.selectionScore) : null,
      }}
      alternativeAssets={[]}
      allAssets={[{
        id: sequence.id,
        content,
        score: sequence.selectionScore ? Number(sequence.selectionScore) : null,
      }]}
      nodeLabel="email sequence"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── WhatsAppRecommendation: Node 10 recommended asset wrapper ──────────────
function WhatsAppRecommendation({ whatsappSequenceId, campaignKit, onSelect, onRegenerate }: {
  whatsappSequenceId: number;
  campaignKit: any;
  onSelect: (id: number) => void;
  onRegenerate: () => void;
}) {
  const { data: sequence } = trpc.whatsappSequences.get.useQuery({ id: whatsappSequenceId }, { enabled: !!whatsappSequenceId });
  const { data: hasCompleted } = trpc.campaignKits.hasCompletedCampaign.useQuery();

  if (!sequence) {
    return <p style={{ textAlign: "center", color: "#999", fontFamily: "var(--v2-font-body)" }}>Loading WhatsApp sequence...</p>;
  }

  const messages = typeof sequence.messages === "string" ? JSON.parse(sequence.messages) : (sequence.messages || []);
  const msgCount = Array.isArray(messages) ? messages.length : 0;
  const content = `${sequence.name || "WhatsApp Sequence"} — ${msgCount} message${msgCount !== 1 ? "s" : ""}`;

  return (
    <RecommendedAssetPanel
      primaryAsset={{
        id: sequence.id,
        content,
        score: sequence.selectionScore ? Number(sequence.selectionScore) : null,
      }}
      alternativeAssets={[]}
      allAssets={[{
        id: sequence.id,
        content,
        score: sequence.selectionScore ? Number(sequence.selectionScore) : null,
      }]}
      nodeLabel="WhatsApp sequence"
      isFirstCampaign={!hasCompleted}
      onSelect={onSelect}
      onRegenerate={onRegenerate}
    />
  );
}

// ─── Success State: Zappy cheering + confetti ─────────────────────────────────
function SuccessState({ score, nextStepUrl, isLastStep }: {
  score: number;
  nextStepUrl?: string | null;
  isLastStep?: boolean;
}) {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Delay confetti by 800ms so result panel renders first
  useEffect(() => {
    if (score === 100) {
      const timer = setTimeout(() => setShowConfetti(true), 800);
      return () => clearTimeout(timer);
    }
  }, [score]);

  return (
    <>
      {showConfetti && (
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
  // ── Subscription tier check (reuses existing auth — refresh on mount to catch tier changes) ──
  const { user: authUser, refresh: refreshAuth } = useAuth();
  useEffect(() => { refreshAuth(); }, []);
  const isFreeTier = !authUser || (authUser.role !== "superuser" && authUser.role !== "admin" && authUser.subscriptionTier !== "pro" && authUser.subscriptionTier !== "agency");

  // ── Quota tracking per step ──
  const STEP_QUOTA_MAP: Partial<Record<WizardStep, { key: "icp" | "offers" | "adCopy" | "email" | "whatsapp" | "landingPages" | "headlines" | "hvco" | "heroMechanisms"; countField: string; featureName: string }>> = {
    icp:              { key: "icp",          countField: "icpGeneratedCount",          featureName: "ICP Generation" },
    offer:            { key: "offers",       countField: "offerGeneratedCount",        featureName: "Offer Generation" },
    uniqueMethod:     { key: "heroMechanisms", countField: "heroMechanismGeneratedCount", featureName: "Unique Method" },
    freeOptIn:        { key: "hvco",         countField: "hvcoGeneratedCount",         featureName: "Free Opt-In Titles" },
    adCopy:           { key: "adCopy",       countField: "adCopyGeneratedCount",       featureName: "Ad Copy" },
    landingPage:      { key: "landingPages", countField: "landingPageGeneratedCount",  featureName: "Landing Page" },
    emailSequence:    { key: "email",        countField: "emailSeqGeneratedCount",     featureName: "Email Sequence" },
    whatsappSequence: { key: "whatsapp",     countField: "whatsappSeqGeneratedCount",  featureName: "WhatsApp Sequence" },
  };
  const quotaInfo = STEP_QUOTA_MAP[step];
  const quotaUsed = quotaInfo ? ((authUser as any)?.[quotaInfo.countField] ?? 0) : 0;
  const quotaLimit = quotaInfo ? getLimit(authUser?.subscriptionTier, quotaInfo.key) : Infinity;
  const isQuotaExceeded = quotaInfo && quotaLimit !== Infinity && quotaLimit < 999 && quotaUsed >= quotaLimit;

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
  const [latestHvcoSetId, setLatestHvcoSetId] = useState<string | null>(null);
  const [latestLandingPageId, setLatestLandingPageId] = useState<number | null>(null);
  const [latestEmailSequenceId, setLatestEmailSequenceId] = useState<number | null>(null);
  const [latestWhatsappSequenceId, setLatestWhatsappSequenceId] = useState<number | null>(null);
  // ── ICP name input (only for ICP step) ──
  const [icpName, setIcpName] = useState("");
  // ── Campaign Kit state ──
  const [campaignKit, setCampaignKit] = useState<any>(null);
  const [activeLandingPageAngle, setActiveLandingPageAngle] = useState<string>("original");
  const getOrCreateKit = trpc.campaignKits.getOrCreate.useMutation();
  const updateKitSelection = trpc.campaignKits.updateSelection.useMutation();
  // ── tRPC utils for cache invalidation ──
  const utils = trpc.useUtils();
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

  // ── Fetch service (real data, not mock) ──
  const { data: serviceData } = trpc.services.list.useQuery(undefined, {
    enabled: !isDemoMissing,
  });

  // ── Fetch ICPs (real data, not mock) ──
  const { data: icpData } = trpc.icps.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: !isDemoMissing }
  );

  // ── Resolve the active service ──
  const activeService = isDemoMissing ? undefined : (
    serviceId ? serviceData?.find(s => s.id === serviceId) : serviceData?.[0]
  );

  // ── Resolve the active ICP ──
  const activeIcp = isDemoMissing ? undefined : icpData?.[0];

  // ── Load or create campaign kit when ICP is available ──
  const kitLoadedRef = useRef(false);
  useEffect(() => {
    if (activeIcp?.id && !kitLoadedRef.current) {
      kitLoadedRef.current = true;
      getOrCreateKit.mutateAsync({ icpId: activeIcp.id })
        .then(kit => setCampaignKit(kit))
        .catch(err => console.warn("[CampaignKit] Failed to load:", err));
    }
  }, [activeIcp?.id]);

  // ── Route guard: redirect if upstream selection not met ──
  useEffect(() => {
    if (!campaignKit) return;
    const gateField = STEP_GATES[step];
    if (gateField && campaignKit[gateField] == null) {
      const target = findFirstIncompleteStep(campaignKit);
      navigate(`/v2-dashboard/wizard/${target}`);
    }
  }, [campaignKit, step]);

  // ── Helper: select an item for the campaign kit ──
  const selectForKit = async (field: string, value: number | string | null) => {
    if (!campaignKit?.id) return;
    try {
      const updated = await updateKitSelection.mutateAsync({ kitId: campaignKit.id, [field]: value });
      setCampaignKit(updated);
    } catch (err) {
      console.error("[CampaignKit] Selection failed:", err);
    }
  };

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

  // ── History load: fetch latest result for this step on mount ──
  // Uses list queries (all routers support serviceId filter, ordered by createdAt desc)
  // If a result exists, set the ID state and switch to "success" status
  const historyLoadedRef = useRef(false);
  const resolvedServiceId = activeService?.id;

  // Reset state when step changes (prevents stale errors persisting across nodes)
  useEffect(() => {
    setStatus("idle");
    setErrorMsg("");
    setComplianceScore(100);
    setComplianceViolations([]);
    setProgressLabel(null);
    historyLoadedRef.current = false;
  }, [step]);

  // Fetch latest for each node type (only the one matching current step)
  const { data: historyIcps } = trpc.icps.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "icp" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyOffers } = trpc.offers.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "offer" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyMechanisms } = trpc.heroMechanisms.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "uniqueMethod" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyHvco } = trpc.hvco.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "freeOptIn" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyHeadlines } = trpc.headlines.getLatestByServiceId.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "headlines" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyAdCopy } = trpc.adCopy.getLatestByServiceId.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "adCopy" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyLandingPages } = trpc.landingPages.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "landingPage" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyEmails } = trpc.emailSequences.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "emailSequence" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );
  const { data: historyWhatsapp } = trpc.whatsappSequences.list.useQuery(
    { serviceId: resolvedServiceId! },
    { enabled: step === "whatsappSequence" && !!resolvedServiceId && status === "idle" && !historyLoadedRef.current }
  );

  useEffect(() => {
    if (historyLoadedRef.current || status !== "idle" || demoMode) return;

    if (step === "icp" && historyIcps && historyIcps.length > 0) {
      setLatestIcpId(historyIcps[0].id);
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "offer" && historyOffers && historyOffers.length > 0) {
      setLatestOfferId(historyOffers[0].id);
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "uniqueMethod" && historyMechanisms && historyMechanisms.length > 0) {
      const m = historyMechanisms[0] as any;
      setLatestMechanismSetId(m.mechanismSetId ?? m.id?.toString());
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "freeOptIn" && historyHvco && historyHvco.length > 0) {
      const h = historyHvco[0] as any;
      setLatestHvcoSetId(h.hvcoSetId ?? h.id?.toString());
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "headlines" && historyHeadlines) {
      const h = historyHeadlines as any;
      if (h?.headlineSetId || h?.adSetId) {
        setLatestHeadlineSetId(h.headlineSetId ?? h.adSetId);
        setStatus("success");
        historyLoadedRef.current = true;
      }
    } else if (step === "adCopy" && historyAdCopy) {
      const a = historyAdCopy as any;
      if (a?.adSetId) {
        setLatestAdSetId(a.adSetId);
        setStatus("success");
        historyLoadedRef.current = true;
      }
    } else if (step === "landingPage" && historyLandingPages && historyLandingPages.length > 0) {
      setLatestLandingPageId(historyLandingPages[0].id);
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "emailSequence" && historyEmails && historyEmails.length > 0) {
      setLatestEmailSequenceId(historyEmails[0].id);
      setStatus("success");
      historyLoadedRef.current = true;
    } else if (step === "whatsappSequence" && historyWhatsapp && historyWhatsapp.length > 0) {
      setLatestWhatsappSequenceId(historyWhatsapp[0].id);
      setStatus("success");
      historyLoadedRef.current = true;
    }
  }, [step, status, demoMode, historyIcps, historyOffers, historyMechanisms, historyHvco, historyHeadlines, historyAdCopy, historyLandingPages, historyEmails, historyWhatsapp]);

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
      type JobResult = { headlineSetId?: string; adSetId?: string; icpId?: number; offerId?: number; mechanismSetId?: string; hvcoSetId?: string; id?: number; [key: string]: unknown };
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
        const { jobId } = await generateIcpAsync.mutateAsync({
          serviceId: svcId,
          name: (payload.icpName as string) || (svc?.avatarName ? `${svc.avatarName} Profile` : "My Ideal Customer"),
        });
        const icpResult = await pollJob(jobId);
        if (typeof icpResult.icpId === 'number') setLatestIcpId(icpResult.icpId);
      } else if (step === "offer") {
        const { jobId } = await generateOfferAsync.mutateAsync({
          serviceId: svcId,
          offerType: "premium",
        });
        const offerResult = await pollJob(jobId);
        if (typeof offerResult.offerId === 'number') setLatestOfferId(offerResult.offerId);
      } else if (step === "uniqueMethod") {
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
        });
        const mechResult = await pollJob(jobId);
        if (typeof mechResult.mechanismSetId === 'string') setLatestMechanismSetId(mechResult.mechanismSetId);
      } else if (step === "freeOptIn") {
        const { jobId } = await generateHvcoAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          hvcoTopic: svc?.hvcoTopic || svc?.mainBenefit || "",
        });
        const hvcoResult = await pollJob(jobId);
        if (typeof hvcoResult.hvcoSetId === 'string') setLatestHvcoSetId(hvcoResult.hvcoSetId);
      } else if (step === "headlines") {
        const selectedFormula = fieldValues.formulaType && fieldValues.formulaType !== "all" ? fieldValues.formulaType : undefined;
        const { jobId } = await generateHeadlinesAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          pressingProblem: svc?.painPoints || "",
          desiredOutcome: svc?.mainBenefit || "",
          uniqueMechanism: svc?.uniqueMechanismSuggestion || "",
          formulaType: selectedFormula as any,
        });
        const headlineResult = await pollJob(jobId);
        if (headlineResult.headlineSetId) {
          setLatestHeadlineSetId(headlineResult.headlineSetId);
        }
      } else if (step === "adCopy") {
        const { jobId } = await generateAdCopyAsync.mutateAsync({
          serviceId: svcId,
          adType: "lead_gen",
          adStyle: "conversational",
          adCallToAction: "Book a Free Call",
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
        const { jobId } = await generateLandingPageAsync.mutateAsync({
          serviceId: svcId,
        });
        // Pass onProgress so the LoadingState shows "Generating angle X of 4…" in real time
        const lpResult = await pollJob(jobId, (label) => setProgressLabel(label));
        if (typeof lpResult.id === 'number') setLatestLandingPageId(lpResult.id);
      } else if (step === "emailSequence") {
        const { jobId } = await generateEmailSequenceAsync.mutateAsync({
          serviceId: svcId,
          sequenceType: "welcome",
          name: `${svc?.name || "My Service"} — Welcome Sequence`,
        });
        const emailResult = await pollJob(jobId);
        if (typeof emailResult.id === 'number') setLatestEmailSequenceId(emailResult.id);
      } else if (step === "whatsappSequence") {
        const { jobId } = await generateWhatsappSequenceAsync.mutateAsync({
          serviceId: svcId,
          sequenceType: "engagement",
          name: `${svc?.name || "My Service"} — Engagement Sequence`,
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
        // Parse quota_exceeded JSON if present, show friendly message
        let friendlyMsg = msg;
        try {
          const parsed = JSON.parse(msg);
          if (parsed.message === "quota_exceeded") {
            const generatorNames: Record<string, string> = {
              headlines: "headline", hvco: "lead magnet", heroMechanisms: "unique method",
              icp: "ICP", adCopy: "ad copy", email: "email sequence",
              whatsapp: "WhatsApp sequence", landingPages: "landing page", offers: "offer",
            };
            const name = generatorNames[parsed.generator] || parsed.generator || "asset";
            friendlyMsg = `QUOTA_EXCEEDED:${parsed.generator}:You've used your free ${name} generations. Upgrade to ZAP Pro to generate more.`;
          }
        } catch { /* not JSON — use raw msg */ }
        setErrorMsg(friendlyMsg);
        setStatus("missing_data");
      } else if (msg.includes("529") || msg.toLowerCase().includes("overloaded") || msg.toLowerCase().includes("busy")) {
        setErrorMsg("The AI is temporarily busy — please try again in a minute.");
        setStatus("error");
      } else {
        setErrorMsg("");
        setStatus("error");
      }
    }
  }, [step, activeService, generateIcpAsync, generateOfferAsync, generateHeroMechanismAsync, generateHvcoAsync, generateHeadlinesAsync, generateAdCopyAsync, generateLandingPageAsync, generateEmailSequenceAsync, generateWhatsappSequenceAsync, utils, pollIntervalRef]);

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
  function handleRetry() {
    if (lastPayloadRef.current) {
      runGeneration(lastPayloadRef.current);
    } else {
      // No stored payload (loaded from history) — reset to idle so user can trigger fresh generation
      setStatus("idle");
      setErrorMsg("");
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

  // ── Determine which body to render ──
  const showGenerateButton = status === "idle" || status === "missing_data";
  const isErrorState = status === "timeout" || status === "error" || status === "offline";

  return (
    <V2Layout>
      <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Main wizard column ── */}
      <div style={{
        flex: 1,
        minWidth: 0,
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

          {/* ── SUCCESS STATE (hidden on nodes using RecommendedAssetPanel) ── */}
          {status === "success" && step !== "headlines" && step !== "offer" && step !== "uniqueMethod" && step !== "freeOptIn" && step !== "adCopy" && step !== "landingPage" && step !== "emailSequence" && step !== "whatsappSequence" && (
            <SuccessState
              score={complianceScore}
              nextStepUrl={(() => { const next = getNextStep(step); return next ? `/v2-dashboard/wizard/${next}` : null; })()}
              isLastStep={step === "pushToMeta"}
            />
          )}
          {/* ── R1a: NODE 6 HEADLINES — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "headlines" && latestHeadlineSetId && activeService && (
            <HeadlineRecommendation
              headlineSetId={latestHeadlineSetId}
              serviceId={activeService.id}
              service={activeService}
              campaignKit={campaignKit}
              onSelect={async (headlineId: number) => {
                await selectForKit("selectedHeadlineId", headlineId);
                navigate("/v2-dashboard/wizard/adCopy");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 7 AD COPY — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "adCopy" && latestAdSetId && (
            <AdCopyRecommendation
              adSetId={latestAdSetId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedAdCopyId", itemId);
                navigate("/v2-dashboard/wizard/landingPage");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 7 AD COPY — FULL RESULT PANEL ── */}
          {status === "success" && step === "adCopy" && latestAdSetId && activeService && (
            <V2AdCopyResultPanel
              adSetId={latestAdSetId}
              serviceId={activeService.id}
              isFreeTier={isFreeTier}
            />
          )}
          {/* ── R1b: NODE 2 ICP RESULT PANEL ── */}
          {status === "success" && step === "icp" && latestIcpId && (
            <V2ICPResultPanel icpId={latestIcpId} isFreeTier={isFreeTier} />
          )}
          {/* ── NODE 3 OFFER — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "offer" && latestOfferId && (
            <OfferRecommendation
              offerId={latestOfferId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedOfferId", itemId);
                navigate("/v2-dashboard/wizard/uniqueMethod");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 4 UNIQUE METHOD — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "uniqueMethod" && latestMechanismSetId && (
            <MechanismRecommendation
              mechanismSetId={latestMechanismSetId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedMechanismId", itemId);
                navigate("/v2-dashboard/wizard/freeOptIn");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 5 FREE OPT-IN — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "freeOptIn" && latestHvcoSetId && (
            <HvcoRecommendation
              hvcoSetId={latestHvcoSetId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedHvcoId", itemId);
                navigate("/v2-dashboard/wizard/headlines");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 8 LANDING PAGE — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "landingPage" && latestLandingPageId && (
            <LandingPageRecommendation
              landingPageId={latestLandingPageId}
              campaignKit={campaignKit}
              onSelect={async (pageId: number, angle: string) => {
                if (!campaignKit?.id) return;
                try {
                  const updated = await updateKitSelection.mutateAsync({
                    kitId: campaignKit.id,
                    selectedLandingPageId: pageId,
                    selectedLandingPageAngle: angle,
                  });
                  setCampaignKit(updated);
                } catch (err) {
                  console.error("[CampaignKit] LP selection failed:", err);
                }
                navigate("/v2-dashboard/wizard/emailSequence");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 8 LANDING PAGE — FULL RESULT PANEL ── */}
          {status === "success" && step === "landingPage" && latestLandingPageId && (
            <V2LandingPageResultPanel
              landingPageId={latestLandingPageId}
              isFreeTier={isFreeTier}
              onAngleChange={setActiveLandingPageAngle}
            />
          )}
          {/* ── NODE 9 EMAIL SEQUENCE — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "emailSequence" && latestEmailSequenceId && (
            <EmailRecommendation
              emailSequenceId={latestEmailSequenceId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedEmailSequenceId", itemId);
                navigate("/v2-dashboard/wizard/whatsappSequence");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 9 EMAIL SEQUENCE — FULL RESULT PANEL ── */}
          {status === "success" && step === "emailSequence" && latestEmailSequenceId && (
            <V2EmailSequenceResultPanel emailSequenceId={latestEmailSequenceId} isFreeTier={isFreeTier} />
          )}
          {/* ── NODE 10 WHATSAPP SEQUENCE — RECOMMENDED ASSET PANEL ── */}
          {status === "success" && step === "whatsappSequence" && latestWhatsappSequenceId && (
            <WhatsAppRecommendation
              whatsappSequenceId={latestWhatsappSequenceId}
              campaignKit={campaignKit}
              onSelect={async (itemId: number) => {
                await selectForKit("selectedWhatsAppSequenceId", itemId);
                navigate("/v2-dashboard/wizard/pushToMeta");
              }}
              onRegenerate={handleRetry}
            />
          )}
          {/* ── NODE 10 WHATSAPP SEQUENCE — FULL RESULT PANEL ── */}
          {status === "success" && step === "whatsappSequence" && latestWhatsappSequenceId && (
            <V2WhatsAppResultPanel whatsappSequenceId={latestWhatsappSequenceId} isFreeTier={isFreeTier} />
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
              message={errorMsg || "Something went wrong halfway through. Your inputs are saved — just hit Generate Again."}
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
          {status === "missing_data" && errorMsg && (
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
              {errorMsg.startsWith("QUOTA_EXCEEDED:") ? (() => {
                const parts = errorMsg.split(":");
                const generator = parts[1] || "headlines";
                const message = parts.slice(2).join(":");
                return (
                  <>
                    <p style={{ margin: "0 0 12px" }}>{message}</p>
                    <a
                      href={`/pricing?utm_source=app&utm_medium=quota&utm_campaign=${generator}`}
                      style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        borderRadius: "var(--v2-border-radius-pill, 9999px)",
                        background: "var(--v2-primary-btn, #FF5B1D)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "14px",
                        textDecoration: "none",
                      }}
                    >
                      Upgrade to Pro
                    </a>
                  </>
                );
              })() : errorMsg}
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
              {showGenerateButton && isQuotaExceeded && quotaInfo ? (
                <>
                  <QuotaIndicator generatorKey={quotaInfo.key} usedCount={quotaUsed} tier={authUser?.subscriptionTier} />
                  <UpgradePrompt variant="inline" featureName={quotaInfo.featureName} />
                </>
              ) : showGenerateButton ? (
                <>
                  <button
                    onClick={handleGenerateNow}
                    style={primaryBtnStyle}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                  >
                    Generate Now
                  </button>
                  {quotaInfo && (
                    <QuotaIndicator generatorKey={quotaInfo.key} usedCount={quotaUsed} tier={authUser?.subscriptionTier} />
                  )}
                </>
              ) : null}
            </>
          )}

          {/* ── Try Again / Generate Again button after concerned/success ── */}
          {(status === "success" || status === "concerned") && (
            isFreeTier && status === "success" && !isQuotaExceeded && !PRO_GATED_STEPS.includes(step) ? (
              <UpgradePrompt variant="inline" featureName="Generate Again" />
            ) : (
              <button
                onClick={() => { setStatus("idle"); }}
                style={secondaryBtnStyle}
              >
                ↺ Generate Again
              </button>
            )
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

          {/* ── ADVANCED TOGGLE (always visible) ── */}
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

          {/* ── ACCORDION (CSS max-height transition, NOT display:none) ── */}
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
      {/* ── Campaign Kit Sidebar (desktop only) ── */}
      <div className="campaign-kit-sidebar-wrapper" style={{ display: "none" }}>
        <CampaignKitSidebar kit={campaignKit} currentStep={step} onNavigate={(s) => navigate(`/v2-dashboard/wizard/${s}`)} />
      </div>
      <style>{`@media (min-width: 1024px) { .campaign-kit-sidebar-wrapper { display: block !important; } }`}</style>
      </div>
    </V2Layout>
  );
}
