/**
 * V2AutoModeProgress — Auto Mode Phase B3
 *
 * Polls /api/jobs/<jobId> every 5s. Renders ZappyMascot + step counter +
 * current step label (read straight from progress.label, which the
 * orchestrator writes from B2's ORCHESTRATION_STEP_LABELS) + progress bar.
 *
 * Reads jobId from URL query param (?jobId=<uuid>). Mounted at
 * /v2-dashboard/auto-mode/progress (App.tsx route registration).
 *
 * On `complete`: navigates to
 *   /v2-dashboard/campaign-kit/<kitId>?from=auto-mode
 * (kitId is read from result.kitId; if null/missing, falls back to
 * /v2-dashboard).
 *
 * On `failed`: surfaces "Auto Mode hit a snag at <Step Display Name>" with
 * primary CTA "Continue from <Step> →" deep-linking to the wizard step
 * via STEP_TO_WIZARD_ROUTE.
 *
 * Polling interval matches the existing wizard's 5s pattern (per pre-flight
 * Section 4 + Phase 0 job-processor pattern at server/_core/index.ts:132).
 */
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import V2Layout from "./V2Layout";
import ZappyMascot from "./ZappyMascot";
import {
  STEP_TO_WIZARD_ROUTE,
  STEP_DISPLAY_NAME,
  getFailedStepNameFromProgressStep,
} from "./AutoModeZappyScript";

// Phase C C1: cascade is now 9 steps (added adCreatives at end). The runtime
// value comes from progress?.total via the polled job response — this is the
// fallback used only when progress is null/missing on the first poll tick.
const TOTAL_STEPS = 9;
const POLL_INTERVAL_MS = 5_000;

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "40px 36px",
  maxWidth: "640px",
  margin: "0 auto",
  width: "100%",
};

type JobStatus = "pending" | "running" | "complete" | "failed";

type JobProgress = {
  step?: number;
  total?: number;
  label?: string;
};

type JobResult = {
  kitId?: number | null;
};

type JobPollResponse = {
  status: JobStatus;
  result: JobResult | null;
  error: string | null;
  progress: JobProgress | null;
};

export default function V2AutoModeProgress() {
  const [, navigate] = useLocation();
  const jobId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("jobId")
    : null;

  const [status, setStatus] = useState<JobStatus>("pending");
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultKitId, setResultKitId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the job's status every 5s. Stops on terminal status (complete | failed).
  useEffect(() => {
    if (!jobId) {
      setErrorMsg("No jobId in URL — return to Auto Mode and try again.");
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) {
          if (active) setErrorMsg(`Could not read job status (${res.status}).`);
          return;
        }
        const data = (await res.json()) as JobPollResponse;
        if (!active) return;
        setStatus(data.status);
        setProgress(data.progress ?? null);
        if (data.status === "complete") {
          setResultKitId(data.result?.kitId ?? null);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } else if (data.status === "failed") {
          setErrorMsg(data.error ?? "Auto Mode failed.");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch (err) {
        if (active) setErrorMsg(err instanceof Error ? err.message : "Polling failed.");
      }
    };
    void poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobId]);

  // Auto-navigate on complete (after a short pause to let the user see the cheering state).
  useEffect(() => {
    if (status !== "complete") return;
    const timer = setTimeout(() => {
      if (resultKitId != null) {
        navigate(`/v2-dashboard/campaign-kit/${resultKitId}?from=auto-mode`);
      } else {
        navigate("/v2-dashboard");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [status, resultKitId, navigate]);

  // ── Failure state render ──────────────────────────────────────────────────
  if (status === "failed") {
    const failedStep = getFailedStepNameFromProgressStep(progress?.step);
    const wizardRoute = failedStep ? STEP_TO_WIZARD_ROUTE[failedStep] : null;
    const stepDisplay = failedStep ? STEP_DISPLAY_NAME[failedStep] : "Setup";
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <ZappyMascot state="concerned" size={120} />
              <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 5vw, 28px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginTop: "20px", marginBottom: "12px" }}>
                Auto Mode hit a snag at {stepDisplay}.
              </h1>
              <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555", lineHeight: 1.55, margin: "0 0 8px", maxWidth: "440px" }}>
                Steps before this one are saved. You can pick up from {stepDisplay} in the wizard, or re-trigger Auto Mode from the dashboard — it'll skip the steps that already finished.
              </p>
              {errorMsg && (
                <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#B5421A", lineHeight: 1.5, margin: "8px 0 24px", maxWidth: "440px" }}>
                  Error detail: {errorMsg.slice(0, 240)}
                </p>
              )}
              {wizardRoute && (
                <button
                  onClick={() => navigate(wizardRoute)}
                  style={{
                    background: "var(--v2-primary-btn)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--v2-border-radius-pill)",
                    padding: "14px 28px",
                    fontSize: "16px",
                    fontFamily: "var(--v2-font-body)",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: "16px",
                    marginBottom: "12px",
                  }}
                >
                  Continue from {stepDisplay} →
                </button>
              )}
              <button
                onClick={() => navigate("/v2-dashboard")}
                style={{
                  background: "transparent",
                  color: "#777",
                  border: "1px solid rgba(26,22,36,0.15)",
                  borderRadius: "var(--v2-border-radius-pill)",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontFamily: "var(--v2-font-body)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </V2Layout>
    );
  }

  // ── Complete state render (brief — auto-navigates after 1.5s) ──────────────
  if (status === "complete") {
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px 64px" }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <ZappyMascot state="cheering" size={140} />
              <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(24px, 5vw, 30px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginTop: "20px", marginBottom: "12px" }}>
                Your campaign is built.
              </h1>
              <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555", lineHeight: 1.55, margin: 0 }}>
                Taking you to your campaign kit…
              </p>
            </div>
          </div>
        </div>
      </V2Layout>
    );
  }

  // ── Loading state render (default) ────────────────────────────────────────
  const stepNum = progress?.step ?? 0;
  const totalNum = progress?.total ?? TOTAL_STEPS;
  const label = progress?.label ?? "Reading your profile and getting Zappy ready…";
  const pct = totalNum > 0 ? Math.round((stepNum / totalNum) * 100) : 0;

  return (
    <V2Layout>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <ZappyMascot state="loading" size={140} />
            <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 5vw, 28px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginTop: "20px", marginBottom: "8px" }}>
              Building your campaign…
            </h1>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#777", margin: "0 0 28px", letterSpacing: "0.04em" }}>
              Step {Math.max(stepNum, 1)} of {totalNum}
            </p>
            <p style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "16px",
              color: "var(--v2-text-color)",
              lineHeight: 1.55,
              margin: "0 0 32px",
              maxWidth: "440px",
              minHeight: "48px", // reserves space so layout doesn't jump on label changes
            }}>
              {label}
            </p>
            <div style={{
              width: "100%",
              maxWidth: "440px",
              height: "10px",
              background: "rgba(26,22,36,0.08)",
              borderRadius: "var(--v2-border-radius-pill)",
              overflow: "hidden",
              marginBottom: "20px",
            }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--v2-primary-btn), #FF8A4D)",
                borderRadius: "var(--v2-border-radius-pill)",
                transition: "width 0.6s ease",
              }} />
            </div>
            <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "rgba(26,22,36,0.45)", margin: 0, maxWidth: "380px", lineHeight: 1.5 }}>
              This usually takes about 5 minutes. You can leave this tab open — Zappy keeps working in the background.
            </p>
          </div>
        </div>
      </div>
    </V2Layout>
  );
}
