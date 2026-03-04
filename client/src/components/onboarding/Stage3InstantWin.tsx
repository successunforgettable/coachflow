import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { trpc } from "@/lib/trpc";

const ZAP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/GFyyklkYbPvEBkLS.png";

const PROGRESS_DOTS = [false, false, true, false, false];

const FALLBACK_HEADLINE =
  "How to Get Premium Coaching Clients Without Chasing Anyone — The Proven System That Works While You Sleep";

interface Stage3Props {
  programName: string;
  campaignType: string;
  generatedHeadline: string | null;
  onComplete: () => void;
}

const CAMPAIGN_LABELS: Record<string, string> = {
  webinar: "Webinar",
  challenge: "Challenge",
  course_launch: "Course Launch",
  product_launch: "Product Launch",
};

export function Stage3InstantWin({
  programName,
  campaignType,
  generatedHeadline,
  onComplete,
}: Stage3Props) {
  const hasConfettiFired = useRef(false);
  const updateStage = trpc.onboarding.updateStageFlag.useMutation();

  const headline = generatedHeadline || FALLBACK_HEADLINE;
  const campaignLabel = CAMPAIGN_LABELS[campaignType] || campaignType;

  // Fire confetti on mount
  useEffect(() => {
    if (hasConfettiFired.current) return;
    hasConfettiFired.current = true;

    const duration = 2500;
    const end = Date.now() + duration;

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#FF5B1D", "#1A1624", "#F5F1EA"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#FF5B1D", "#1A1624", "#F5F1EA"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }, []);

  async function handleContinue() {
    await updateStage.mutateAsync({ stage: 4 });
    onComplete();
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
          textAlign: "center",
        }}
      >
        {/* Celebration badge */}
        <div
          className="zo-badge-in"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--gg)",
            border: "1.5px solid var(--go)",
            borderRadius: "100px",
            padding: "8px 18px",
            marginBottom: "24px",
          }}
        >
          <span style={{ fontSize: "18px" }}>⚡</span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--go)",
              letterSpacing: "0.02em",
            }}
          >
            Your first asset is ready!
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(24px, 5vw, 30px)",
            marginBottom: "8px",
            lineHeight: 1.2,
          }}
        >
          ZAP just wrote your first headline
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "var(--ink-2)",
            marginBottom: "28px",
          }}
        >
          For your{" "}
          <strong style={{ color: "var(--ink)" }}>{campaignLabel}</strong> campaign —{" "}
          <em style={{ color: "var(--ink-2)" }}>{programName}</em>
        </p>

        {/* Headline display card */}
        <div
          style={{
            background: "var(--inset)",
            borderRadius: "14px",
            padding: "24px 20px",
            marginBottom: "28px",
            position: "relative",
          }}
        >
          {/* Quote mark */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "16px",
              fontSize: "32px",
              color: "var(--charge)",
              lineHeight: 1,
              fontFamily: "Georgia, serif",
              opacity: 0.5,
            }}
          >
            "
          </div>
          <p
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.5,
              margin: 0,
              paddingTop: "8px",
              fontStyle: "italic",
            }}
          >
            {headline}
          </p>
        </div>

        {/* Value reinforcement */}
        <p
          style={{
            fontSize: "13px",
            color: "var(--ink-2)",
            marginBottom: "28px",
            lineHeight: 1.6,
          }}
        >
          ZAP will generate{" "}
          <strong style={{ color: "var(--ink)" }}>110+ more assets</strong> like this —
          email sequences, ads, landing pages, WhatsApp messages, and more.
          All tailored to your program.
        </p>

        <button className="btn-primary" onClick={handleContinue}>
          See your full campaign dashboard →
        </button>
      </div>
    </div>
  );
}
