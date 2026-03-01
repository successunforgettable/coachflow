import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const ZAP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/GFyyklkYbPvEBkLS.png";

const PROGRESS_DOTS = [false, false, false, true, false];

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  webinar: "webinar",
  challenge: "challenge",
  course_launch: "course",
  product_launch: "launch",
};

const STEPS = [
  { num: 1, label: "Your Sales Offer", done: false },
  { num: 2, label: "Your Unique Method", done: false },
  { num: 3, label: "Your Free Opt-In", done: false },
  { num: 4, label: "Your Headlines", done: true },
  { num: 5, label: "Your Ideal Customer", done: false },
  { num: 6, label: "Your Ads", done: false },
  { num: 7, label: "Your Ad Images", done: false },
  { num: 8, label: "Your Ad Videos", done: false },
  { num: 9, label: "Your Landing Page", done: false },
  { num: 10, label: "Your Email Follow-Up", done: false },
  { num: 11, label: "Your WhatsApp Follow-Up", done: false },
];

interface Stage4Props {
  programName: string;
  campaignId: number | null;
  campaignType: string;
  onComplete: () => void;
}

export function Stage4Streak({ programName, campaignId, campaignType, onComplete }: Stage4Props) {
  const [, navigate] = useLocation();
  const setComplete = trpc.onboarding.setComplete.useMutation();
  const updateStage = trpc.onboarding.updateStageFlag.useMutation();

  useEffect(() => {
    updateStage.mutate({ stage: 4 });
  }, []);

  const typeLabel = CAMPAIGN_TYPE_LABELS[campaignType] || "campaign";

  async function handleStartStep1() {
    await setComplete.mutateAsync({});
    if (campaignId) {
      navigate(`/campaigns/${campaignId}`);
    } else {
      navigate("/dashboard");
    }
  }

  async function handleExploreOwn() {
    await setComplete.mutateAsync({});
    navigate("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 20px 48px",
      }}
    >
      {/* Logo */}
      <div
        style={{
          background: "#1A1624",
          borderRadius: "12px",
          padding: "0 14px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          marginBottom: "28px",
        }}
      >
        <img src={ZAP_LOGO} alt="ZAP" style={{ height: "28px", width: "auto" }} />
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "36px" }}>
        {PROGRESS_DOTS.map((active, i) => (
          <div
            key={i}
            style={{
              width: active ? "24px" : "8px",
              height: "8px",
              borderRadius: "100px",
              background: active ? "var(--charge)" : "var(--ink-4)",
              transition: "all 300ms ease",
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="zo-card zo-fade-up"
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "36px 32px",
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontFamily: "Fraunces, serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "28px",
            color: "var(--ink)",
            marginBottom: "20px",
            lineHeight: 1.2,
          }}
        >
          Your campaign kit
        </h2>

        {/* Progress bar — 9% fill */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              height: "8px",
              background: "var(--inset)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "9%",
                background: "var(--charge)",
                borderRadius: "4px",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--ink-3)",
              marginTop: "6px",
              textAlign: "right",
            }}
          >
            1 of 11
          </p>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "15px",
            color: "var(--ink-2)",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          Everything ZAP will build for your{" "}
          <strong style={{ color: "var(--ink)" }}>{typeLabel}</strong>:
        </p>

        {/* 11-step list */}
        <div style={{ marginBottom: "28px" }}>
          {STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                borderBottom: step.num < 11 ? "1px solid var(--ink-5, rgba(255,255,255,0.06))" : "none",
              }}
            >
              {/* Tick or number circle */}
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: step.done ? "#22c55e" : "transparent",
                  border: step.done ? "none" : "2px solid var(--ink-4)",
                  fontSize: "12px",
                  color: step.done ? "#fff" : "var(--ink-3)",
                  fontWeight: 700,
                }}
              >
                {step.done ? "✓" : step.num}
              </div>

              {/* Label */}
              <span
                style={{
                  flex: 1,
                  fontSize: "15px",
                  color: step.done ? "var(--ink)" : "var(--ink-2)",
                  fontWeight: step.done ? 600 : 400,
                }}
              >
                {step.label}
              </span>

              {/* "1 done" badge */}
              {step.done && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#22c55e",
                    fontWeight: 600,
                    background: "rgba(34,197,94,0.12)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  1 done
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          className="btn-primary"
          onClick={handleStartStep1}
          disabled={setComplete.isPending}
          style={{ width: "100%", marginBottom: "14px" }}
        >
          {setComplete.isPending ? "Setting up…" : "Start from Step 1 →"}
        </button>

        {/* Secondary link */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleExploreOwn}
            disabled={setComplete.isPending}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-3)",
              fontSize: "14px",
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "'Instrument Sans', sans-serif",
            }}
          >
            I'll explore on my own ›
          </button>
        </div>
      </div>
    </div>
  );
}
