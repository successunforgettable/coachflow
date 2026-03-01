/**
 * GuidedCampaignBuilder — Item 2.1
 *
 * Renders the 11-step guided campaign builder inside the .zap-onboarding design system.
 * Receives the full campaign object (including assetCounts, icpId, serviceId, campaignType).
 *
 * Layout:
 *   Desktop: two-column — left: active step card (large), right: 200px journey spine
 *   Mobile: horizontal scrollable step indicator at top, step cards stacked below
 *
 * Step locking:
 *   Step 1 always unlocked.
 *   Step N locked if step N-1 has 0 completed assets.
 *   Step 5 (ICP) auto-completes if campaign.icpId != null OR assetCounts.icp >= 1.
 *   Step 6 unlocks automatically when Step 5 is complete (no user action needed).
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Lock, CheckCircle2, ChevronRight } from "lucide-react";

// ─── Step Definitions ────────────────────────────────────────────────────────

export interface StepDefinition {
  number: number;
  label: string;
  description: string;
  assetKey: keyof AssetCounts | "icp_special" | "ad_creatives" | "videos";
  generateUrl: string;
  viewUrl: string;
  isIcpStep?: boolean;
}

export interface AssetCounts {
  headline: number;
  hvco: number;
  hero_mechanism: number;
  ad_copy: number;
  email_sequence: number;
  whatsapp_sequence: number;
  landing_page: number;
  offer: number;
  icp: number;
  ad_creatives: number;
  videos: number;
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    number: 1,
    label: "Your Sales Offer",
    description:
      "This is what you are selling — the price, the promise, and everything the buyer gets when they say yes.",
    assetKey: "offer",
    generateUrl: "/generators/offers",
    viewUrl: "/offers",
  },
  {
    number: 2,
    label: "Your Unique Method",
    description:
      "This is the special way you get results that no one else does — the thing that makes your program different from everything else out there.",
    assetKey: "hero_mechanism",
    generateUrl: "/hero-mechanisms/new",
    viewUrl: "/hero-mechanisms",
  },
  {
    number: 3,
    label: "Your Free Opt-In",
    description:
      "This is a free gift you give people to get their email address — something small and useful that shows them you know what you are talking about.",
    assetKey: "hvco",
    generateUrl: "/hvco-titles/new",
    viewUrl: "/hvco-titles",
  },
  {
    number: 4,
    label: "Your Headlines",
    description:
      "These are the first words people read in your ads and posts — the ones that make them stop scrolling and want to know more.",
    assetKey: "headline",
    generateUrl: "/headlines/new",
    viewUrl: "/headlines",
  },
  {
    number: 5,
    label: "Your Ideal Customer",
    description:
      "This is a picture of the exact person you want to reach — who they are, what they struggle with, and what they want.",
    assetKey: "icp_special",
    generateUrl: "/generators/icp",
    viewUrl: "/generators/icp",
    isIcpStep: true,
  },
  {
    number: 6,
    label: "Your Ads",
    description:
      "These are the words in your ads — the sentences that explain your offer and get people to click.",
    assetKey: "ad_copy",
    generateUrl: "/ad-copy",
    viewUrl: "/ad-copy",
  },
  {
    number: 7,
    label: "Your Ad Images",
    description:
      "These are the pictures that go with your ads — eye-catching images that grab attention and make people want to read your ad.",
    assetKey: "ad_creatives",
    generateUrl: "/ad-creatives",
    viewUrl: "/ad-creatives",
  },
  {
    number: 8,
    label: "Your Ad Videos",
    description:
      "These are short videos for your ads — they show people what you do and why it matters.",
    assetKey: "videos",
    generateUrl: "/video-creator",
    viewUrl: "/videos",
  },
  {
    number: 9,
    label: "Your Landing Page",
    description:
      "This is the web page people land on after clicking your ad — the page that explains your offer and gets them to sign up.",
    assetKey: "landing_page",
    generateUrl: "/generators/landing-page",
    viewUrl: "/landing-pages",
  },
  {
    number: 10,
    label: "Your Email Follow-Up",
    description:
      "These are the emails you send after someone signs up — messages that build trust and move people toward buying.",
    assetKey: "email_sequence",
    generateUrl: "/generators/email",
    viewUrl: "/generators/email",
  },
  {
    number: 11,
    label: "Your WhatsApp Follow-Up",
    description:
      "These are the WhatsApp messages you send to people who signed up — quick messages that keep leads warm and move them toward a decision.",
    assetKey: "whatsapp_sequence",
    generateUrl: "/generators/whatsapp",
    viewUrl: "/generators/whatsapp",
  },
];

// ─── Lock Logic (pure, exported for testing) ─────────────────────────────────

export function getStepAssetCount(
  step: StepDefinition,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): number {
  if (step.isIcpStep) {
    // Step 5 is complete if campaign has a linked ICP OR at least 1 ICP asset
    return (icpId != null ? 1 : 0) + (assetCounts.icp ?? 0);
  }
  const key = step.assetKey as keyof AssetCounts;
  return assetCounts[key] ?? 0;
}

export function isStepComplete(
  step: StepDefinition,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): boolean {
  return getStepAssetCount(step, assetCounts, icpId) >= 1;
}

export function isStepLocked(
  stepIndex: number,
  assetCounts: AssetCounts,
  icpId: number | null | undefined
): boolean {
  if (stepIndex === 0) return false; // Step 1 always unlocked
  const prevStep = STEP_DEFINITIONS[stepIndex - 1];
  return !isStepComplete(prevStep, assetCounts, icpId);
}

// ─── Campaign type for props ──────────────────────────────────────────────────

interface CampaignData {
  id: number;
  name: string;
  description?: string | null;
  campaignType?: string | null;
  icpId?: number | null;
  serviceId?: number | null;
  assetCounts: AssetCounts;
}

// ─── Step 5 ICP Summary Card ──────────────────────────────────────────────────

function IcpSummaryCard({ icpId, serviceId }: { icpId: number | null | undefined; serviceId: number | null | undefined }) {
  const { data: icp, isLoading } = trpc.icps.get.useQuery(
    { id: icpId! },
    { enabled: !!icpId }
  );

  const { data: allIcps } = trpc.icps.list.useQuery(
    serviceId ? { serviceId } : undefined,
    { enabled: true }
  );

  if (!icpId) {
    return (
      <div style={{
        background: "rgba(255,91,29,0.06)",
        border: "1.5px solid rgba(255,91,29,0.18)",
        borderRadius: "var(--r)",
        padding: "16px 20px",
        marginTop: "16px",
      }}>
        <p style={{ color: "var(--charge)", fontWeight: 600, fontSize: "14px", margin: 0 }}>
          ⚠️ Complete Your Brand Setup first
        </p>
        <p style={{ color: "var(--ink-2)", fontSize: "13px", marginTop: "6px", marginBottom: 0 }}>
          Go to Your Brand Summary to set up your brand, then come back here.
        </p>
        <Link href="/source-of-truth">
          <span style={{ color: "var(--charge)", fontSize: "13px", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
            Set up Your Brand Summary →
          </span>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ marginTop: "16px", color: "var(--ink-3)", fontSize: "14px" }}>
        Loading your ideal customer…
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(26,140,91,0.06)",
      border: "1.5px solid rgba(26,140,91,0.18)",
      borderRadius: "var(--r)",
      padding: "16px 20px",
      marginTop: "16px",
    }}>
      <p style={{ color: "var(--go)", fontWeight: 600, fontSize: "14px", margin: "0 0 4px 0" }}>
        ✓ Your ideal customer has been built automatically
      </p>
      {icp && (
        <p style={{ color: "var(--ink)", fontSize: "15px", fontWeight: 600, margin: "0 0 4px 0" }}>
          {icp.name}
        </p>
      )}
      {icp?.introduction && (
        <p style={{ color: "var(--ink-2)", fontSize: "13px", margin: "0 0 10px 0", lineHeight: 1.5 }}>
          {icp.introduction.slice(0, 160)}{icp.introduction.length > 160 ? "…" : ""}
        </p>
      )}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/generators/icp`}>
          <span style={{ color: "var(--charge)", fontSize: "13px", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
            {(allIcps?.length ?? 0) > 1 ? "Change audience →" : "View full profile →"}
          </span>
        </Link>
      </div>
    </div>
  );
}

// ─── Individual Step Card ─────────────────────────────────────────────────────

interface StepCardProps {
  step: StepDefinition;
  stepIndex: number;
  assetCounts: AssetCounts;
  icpId: number | null | undefined;
  serviceId: number | null | undefined;
  isActive: boolean;
  onClick: () => void;
}

function StepCard({ step, stepIndex, assetCounts, icpId, serviceId, isActive, onClick }: StepCardProps) {
  const locked = isStepLocked(stepIndex, assetCounts, icpId);
  const complete = isStepComplete(step, assetCounts, icpId);
  const prevStep = stepIndex > 0 ? STEP_DEFINITIONS[stepIndex - 1] : null;

  let statusColor = "var(--ink-3)";
  let statusLabel = "Not started";
  if (complete) { statusColor = "var(--go)"; statusLabel = "Complete"; }
  else if (!locked && getStepAssetCount(step, assetCounts, icpId) > 0) { statusColor = "#D97706"; statusLabel = "In progress"; }

  return (
    <div
      onClick={locked ? undefined : onClick}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--rL)",
        background: locked ? "var(--inset)" : (isActive ? "var(--card-2)" : "var(--card)"),
        boxShadow: isActive ? "var(--sh-lg), 0 0 0 2px rgba(255,91,29,0.18)" : "var(--sh-sm)",
        border: "1.5px solid var(--ink-4)",
        padding: "28px 28px 24px 28px",
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.65 : 1,
        transition: "box-shadow 180ms ease, border-color 180ms ease",
        marginBottom: "16px",
      }}
    >
      {/* Ghost step number */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-20px",
          right: "-10px",
          fontSize: "clamp(140px, 28vw, 240px)",
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          WebkitTextStroke: "1.5px rgba(255,91,29,.12)",
          color: "transparent",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      >
        {step.number}
      </span>

      {/* Card content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ width: "24px", height: "2px", background: "var(--charge)", flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 600,
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--charge)",
          }}>
            Step {step.number} of 11
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "clamp(22px, 3vw, 30px)",
          color: locked ? "var(--ink-3)" : "var(--ink)",
          margin: "0 0 8px 0",
          lineHeight: 1.15,
        }}>
          {step.label}
        </h3>

        {/* Description */}
        <p style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontSize: "14px",
          color: "var(--ink-2)",
          margin: "0 0 16px 0",
          lineHeight: 1.6,
        }}>
          {step.description}
        </p>

        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px" }}>
          {complete ? (
            <CheckCircle2 size={15} color="var(--go)" />
          ) : locked ? (
            <Lock size={15} color="var(--ink-3)" />
          ) : (
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
          )}
          <span style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            color: statusColor,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Locked message — only show when locked AND not complete */}
        {locked && !complete && prevStep && (
          <p style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: "13px",
            color: "var(--ink-3)",
            margin: "0 0 16px 0",
          }}>
            Complete <strong>{prevStep.label}</strong> first
          </p>
        )}

        {/* Step 5 ICP special case */}
        {step.isIcpStep && !locked && (
          <IcpSummaryCard icpId={icpId} serviceId={serviceId} />
        )}

        {/* Action buttons (non-ICP steps, not locked) */}
        {!step.isIcpStep && !locked && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href={step.generateUrl}>
              <button style={{
                background: "var(--charge)",
                color: "#fff",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                boxShadow: "var(--sh-charge)",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Generate →
              </button>
            </Link>
            {complete && (
              <Link href={step.viewUrl}>
                <button style={{
                  background: "transparent",
                  color: "var(--ink)",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1.5px solid var(--ink-4)",
                  cursor: "pointer",
                  transition: "border-color 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--ink-2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink-4)")}
                >
                  View / Edit
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Step 5 ICP: show Change audience / View link */}
        {step.isIcpStep && !locked && icpId && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
            <Link href={step.viewUrl}>
              <button style={{
                background: "transparent",
                color: "var(--ink)",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "1.5px solid var(--ink-4)",
                cursor: "pointer",
              }}>
                View / Edit
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Journey Spine (desktop right column) ────────────────────────────────────

interface JourneySpineProps {
  assetCounts: AssetCounts;
  icpId: number | null | undefined;
  activeStep: number;
  onStepClick: (index: number) => void;
}

function JourneySpine({ assetCounts, icpId, activeStep, onStepClick }: JourneySpineProps) {
  return (
    <div style={{
      width: "200px",
      flexShrink: 0,
      background: "var(--inset)",
      borderLeft: "1.5px solid var(--ink-4)",
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      position: "sticky",
      top: "24px",
      alignSelf: "flex-start",
      borderRadius: "var(--r)",
    }}>
      <p style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
        margin: "0 0 12px 0",
      }}>
        Campaign Journey
      </p>
      {STEP_DEFINITIONS.map((step, idx) => {
        const locked = isStepLocked(idx, assetCounts, icpId);
        const complete = isStepComplete(step, assetCounts, icpId);
        const isCurrent = idx === activeStep;

        let dotBg = "var(--ink-4)"; // locked/not started
        if (complete) dotBg = "var(--go)";
        else if (isCurrent) dotBg = "var(--charge)";

        return (
          <button
            key={step.number}
            onClick={() => !locked && onStepClick(idx)}
            disabled={locked}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: isCurrent ? "rgba(255,91,29,0.08)" : "transparent",
              border: "none",
              borderRadius: "8px",
              padding: "7px 8px",
              cursor: locked ? "default" : "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 150ms ease",
            }}
          >
            {/* Dot */}
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: dotBg,
              flexShrink: 0,
              boxShadow: isCurrent && !complete ? "0 0 0 3px rgba(255,91,29,0.25)" : "none",
              transition: "box-shadow 300ms ease",
            }} />
            <span style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: "12px",
              fontWeight: isCurrent ? 700 : 500,
              color: locked ? "var(--ink-4)" : complete ? "var(--go)" : isCurrent ? "var(--charge)" : "var(--ink-2)",
              lineHeight: 1.3,
            }}>
              {step.label}
            </span>
            {complete && <CheckCircle2 size={12} color="var(--go)" style={{ marginLeft: "auto", flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Mobile Horizontal Stepper ────────────────────────────────────────────────

interface MobileStepperProps {
  assetCounts: AssetCounts;
  icpId: number | null | undefined;
  activeStep: number;
  onStepClick: (index: number) => void;
}

function MobileStepper({ assetCounts, icpId, activeStep, onStepClick }: MobileStepperProps) {
  return (
    <div style={{
      display: "flex",
      overflowX: "auto",
      gap: "8px",
      padding: "12px 0 16px 0",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    }}>
      {STEP_DEFINITIONS.map((step, idx) => {
        const locked = isStepLocked(idx, assetCounts, icpId);
        const complete = isStepComplete(step, assetCounts, icpId);
        const isCurrent = idx === activeStep;

        let dotBg = "var(--ink-4)";
        if (complete) dotBg = "var(--go)";
        else if (isCurrent) dotBg = "var(--charge)";

        return (
          <button
            key={step.number}
            onClick={() => !locked && onStepClick(idx)}
            disabled={locked}
            title={step.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              cursor: locked ? "default" : "pointer",
              padding: "4px 6px",
              flexShrink: 0,
            }}
          >
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: dotBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isCurrent && !complete ? "0 0 0 3px rgba(255,91,29,0.25)" : "none",
              transition: "box-shadow 300ms ease",
            }}>
              {complete ? (
                <CheckCircle2 size={14} color="#fff" />
              ) : (
                <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>{step.number}</span>
              )}
            </div>
            <span style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: "9px",
              fontWeight: isCurrent ? 700 : 500,
              color: locked ? "var(--ink-4)" : complete ? "var(--go)" : isCurrent ? "var(--charge)" : "var(--ink-3)",
              whiteSpace: "nowrap",
              maxWidth: "52px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {step.label.replace("Your ", "")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GuidedCampaignBuilderProps {
  campaign: CampaignData;
}

export default function GuidedCampaignBuilder({ campaign }: GuidedCampaignBuilderProps) {
  const { assetCounts, icpId, serviceId } = campaign;

  // Find the first unlocked, incomplete step as the default active step
  const defaultActiveStep = (() => {
    for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
      const locked = isStepLocked(i, assetCounts, icpId);
      const complete = isStepComplete(STEP_DEFINITIONS[i], assetCounts, icpId);
      if (!locked && !complete) return i;
    }
    // All complete — show last step
    return STEP_DEFINITIONS.length - 1;
  })();

  const [activeStep, setActiveStep] = useState(defaultActiveStep);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActiveStep = useRef(defaultActiveStep);

  // Scroll to active step card when spine click changes activeStep
  useEffect(() => {
    if (activeStep !== prevActiveStep.current) {
      prevActiveStep.current = activeStep;
      const el = stepCardRefs.current[activeStep];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeStep]);

  // Progress: count complete steps
  const completeCount = STEP_DEFINITIONS.filter((s) =>
    isStepComplete(s, assetCounts, icpId)
  ).length;

  const progressPct = Math.round((completeCount / STEP_DEFINITIONS.length) * 100);

  return (
    <div className="zap-onboarding" style={{ background: "var(--paper)", padding: "0" }}>
      {/* Progress bar */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
          <span style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--ink)",
          }}>
            {completeCount} of 11 steps complete
          </span>
          <span style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: "13px",
            color: "var(--ink-2)",
          }}>
            {progressPct}%
          </span>
        </div>
        {/* Progress track */}
        <div style={{
          height: "6px",
          background: "var(--ink-4)",
          borderRadius: "999px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "var(--charge)",
            borderRadius: "999px",
            transition: "width 400ms ease",
          }} />
        </div>
      </div>

      {/* Mobile stepper (hidden on desktop) */}
      <div className="gcb-mobile-stepper">
        <MobileStepper
          assetCounts={assetCounts}
          icpId={icpId}
          activeStep={activeStep}
          onStepClick={setActiveStep}
        />
      </div>

      {/* Desktop two-column layout */}
      <div className="gcb-layout">
        {/* Left: step cards */}
        <div className="gcb-cards">
          {STEP_DEFINITIONS.map((step, idx) => (
            <div key={step.number} ref={el => { stepCardRefs.current[idx] = el; }}>
              <StepCard
                step={step}
                stepIndex={idx}
                assetCounts={assetCounts}
                icpId={icpId}
                serviceId={serviceId}
                isActive={idx === activeStep}
                onClick={() => setActiveStep(idx)}
              />
            </div>
          ))}
        </div>

        {/* Right: journey spine (hidden on mobile) */}
        <div className="gcb-spine">
          <JourneySpine
            assetCounts={assetCounts}
            icpId={icpId}
            activeStep={activeStep}
            onStepClick={setActiveStep}
          />
        </div>
      </div>
    </div>
  );
}
