import { trpc } from "@/lib/trpc";

const ZAP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/GFyyklkYbPvEBkLS.png";

const PROGRESS_DOTS = [false, false, false, true, false];

interface Stage4Props {
  programName: string;
  onComplete: () => void;
}

export function Stage4Streak({ programName, onComplete }: Stage4Props) {
  const setComplete = trpc.onboarding.setComplete.useMutation();

  async function handleEnterDashboard() {
    await setComplete.mutateAsync({});
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
          maxWidth: "480px",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        {/* Streak flame */}
        <div
          style={{
            fontSize: "64px",
            marginBottom: "12px",
            lineHeight: 1,
            animation: "zo-badge-in 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          🔥
        </div>

        {/* Streak counter */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "Fraunces, serif",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "72px",
              color: "var(--charge)",
              lineHeight: 1,
            }}
          >
            1
          </span>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--ink-2)",
            }}
          >
            day streak
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(20px, 4vw, 26px)",
            marginBottom: "8px",
            lineHeight: 1.2,
          }}
        >
          You're already building momentum
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "var(--ink-2)",
            marginBottom: "28px",
            lineHeight: 1.6,
          }}
        >
          Every day you generate content in ZAP, your streak grows. Coaches who
          show up consistently for{" "}
          <strong style={{ color: "var(--ink)" }}>7 days straight</strong> generate
          3× more leads in their first month.
        </p>

        {/* Streak milestones */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          {[
            { days: 1, label: "Today", active: true },
            { days: 3, label: "3 days", active: false },
            { days: 7, label: "1 week", active: false },
            { days: 30, label: "1 month", active: false },
          ].map(({ days, label, active }) => (
            <div
              key={days}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: active ? "var(--charge)" : "var(--inset)",
                  border: active ? "none" : "1.5px solid var(--ink-4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  boxShadow: active ? "var(--sh-charge)" : "none",
                  animation: active ? "zo-pulse-green 2s ease infinite" : "none",
                }}
              >
                {active ? "🔥" : "○"}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: active ? "var(--charge)" : "var(--ink-3)",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={handleEnterDashboard}
          disabled={setComplete.isPending}
        >
          {setComplete.isPending ? "Setting up…" : `Enter your dashboard →`}
        </button>

        <p
          style={{
            fontSize: "12px",
            color: "var(--ink-3)",
            marginTop: "12px",
          }}
        >
          Your campaign for <em>{programName}</em> is ready to build.
        </p>
      </div>
    </div>
  );
}
