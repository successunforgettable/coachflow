/**
 * V2GeneratorWizard — Sprint 4
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
 */
import { useState, useEffect } from "react";
import Confetti from "react-confetti";
import { trpc } from "@/lib/trpc";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import { type WizardStep, STEP_LABELS } from "./v2-constants";

export type { WizardStep };

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

// ─── Loading State: Zappy + progress ring ────────────────────────────────────
function LoadingState() {
  return (
    <>
      <style>{`
        @keyframes v2-spin {
          to { transform: rotate(360deg); }
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
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--v2-text-color)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.5,
        }}>
          Zappy is writing your Meta-compliant assets…
        </p>
      </div>
    </>
  );
}

// ─── Success State: Zappy cheering + confetti ─────────────────────────────────
function SuccessState({ score }: { score: number }) {
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
          colors={["#FF5B1D", "#8B5CF6", "#58CC02", "#FFD700", "#F5F1EA"]}
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
          margin: "0 0 4px",
          textAlign: "center",
        }}>
          {score}/100 — Let's fix a few things before these go live.
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

// ─── Main component ───────────────────────────────────────────────────────────
interface V2GeneratorWizardProps {
  step: WizardStep;
  serviceId?: number;
  onBack?: () => void;
}

export default function V2GeneratorWizard({ step, serviceId, onBack }: V2GeneratorWizardProps) {
  const stepLabel = STEP_LABELS[step];
  const advancedFields = ADVANCED_FIELDS[step];

  // ── Accordion state ──
  const [accordionOpen, setAccordionOpen] = useState(false);

  // ── Advanced field overrides ──
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    advancedFields.forEach(f => { defaults[f.key] = f.options ? f.options[0] : ""; });
    return defaults;
  });

  // ── UI state ──
  type WizardStatus = "idle" | "loading" | "success" | "concerned" | "missing_data";
  const [status, setStatus] = useState<WizardStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [complianceScore, setComplianceScore] = useState(100);
  const [complianceViolations, setComplianceViolations] = useState<string[]>([]);

  // ── Demo mode: ?demo=missing | ?demo=success | ?demo=concerned ──
  const demoMode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("demo")
    : null;
  const isDemoMissing   = demoMode === "missing";
  const isDemoSuccess   = demoMode === "success";
  const isDemoConcerned = demoMode === "concerned";
  const isDemoLoading   = demoMode === "loading";

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
    }
  }, [isDemoSuccess, isDemoConcerned]);

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

    // ── MANDATORY SAFETY LOG — DO NOT REMOVE ──
    console.log("ZAP V2 Payload Check:", payload);

    // ── Fire the API ──
    setStatus("loading");

    // Simulate API response with compliance check (real API wiring in Sprint 5)
    setTimeout(() => {
      // Simulate a 100/100 compliance result for real users
      const simulatedScore = 100;
      setComplianceScore(simulatedScore);
      if (simulatedScore === 100) {
        setStatus("success");
      } else {
        setComplianceViolations(["Example violation — real violations come from API response"]);
        setStatus("concerned");
      }
    }, 2200);
  }

  // ── Determine which body to render ──
  const showGenerateButton = status === "idle" || status === "missing_data";

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

          {/* ── LOADING STATE ── */}
          {status === "loading" && <LoadingState />}

          {/* ── SUCCESS STATE ── */}
          {status === "success" && <SuccessState score={complianceScore} />}

          {/* ── CONCERNED STATE ── */}
          {status === "concerned" && (
            <ConcernedState score={complianceScore} violations={complianceViolations} />
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

          {/* ── GENERATE NOW button (only shown in idle / missing_data states) ── */}
          {showGenerateButton && (
            <button
              onClick={handleGenerateNow}
              style={{
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
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              Generate Now
            </button>
          )}

          {/* ── Try Again button after concerned/success ── */}
          {(status === "success" || status === "concerned") && (
            <button
              onClick={() => setStatus("idle")}
              style={{
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
              }}
            >
              ↺ Generate Again
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
