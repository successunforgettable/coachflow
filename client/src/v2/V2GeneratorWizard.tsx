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
import V2AdCopyResultPanel from "./V2AdCopyResultPanel";
import V2ICPResultPanel from "./V2ICPResultPanel";
import V2OfferResultPanel from "./V2OfferResultPanel";
import V2UniqueMethodResultPanel from "./V2UniqueMethodResultPanel";
import V2FreeOptInResultPanel from "./V2FreeOptInResultPanel";
import V2LandingPageResultPanel from "./V2LandingPageResultPanel";
import V2EmailSequenceResultPanel from "./V2EmailSequenceResultPanel";
import V2WhatsAppResultPanel from "./V2WhatsAppResultPanel";

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
    { key: "headlineStyle", label: "Headline Style", type: "select", options: ["curiosity", "benefit", "how-to", "question", "bold-claim"], sourceNote: "Defaults to 'benefit'" },
    { key: "quantity", label: "Number of Headlines", type: "select", options: ["5", "10", "15", "20"], sourceNote: "Defaults to 10" },
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
  const [latestHvcoSetId, setLatestHvcoSetId] = useState<string | null>(null);
  const [latestLandingPageId, setLatestLandingPageId] = useState<number | null>(null);
  const [latestEmailSequenceId, setLatestEmailSequenceId] = useState<number | null>(null);
  const [latestWhatsappSequenceId, setLatestWhatsappSequenceId] = useState<number | null>(null);
  // ── ICP name input (only for ICP step) ──
  const [icpName, setIcpName] = useState("");
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
        const { jobId } = await generateHeadlinesAsync.mutateAsync({
          serviceId: svcId,
          targetMarket: svc?.targetCustomer || "",
          pressingProblem: svc?.painPoints || "",
          desiredOutcome: svc?.mainBenefit || "",
          uniqueMechanism: svc?.uniqueMechanismSuggestion || "",
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
        setErrorMsg(msg);
        setStatus("missing_data");
      } else {
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
    </V2Layout>
  );
}
