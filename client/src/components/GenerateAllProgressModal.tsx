/**
 * GenerateAllProgressModal — Item 2.3
 *
 * Modal that shows real-time progress for the "Generate All Missing" run.
 * - Preview state: all steps queued, "Start Generation" button visible (S1 screenshot)
 * - Running state: sequential steps with spinner, green tick, red X, grey dot
 * - Per-step retry buttons for failed steps
 * - Cancel mid-run (checks cancelledRef before each step)
 * - Route guard: disables sidebar links via window event while running
 * - Design: Sun-bleached Editorial — Fraunces headings, Instrument Sans body, cream palette, shadow only
 */
import { CheckCircle2, XCircle, Loader2, Circle, RefreshCw, X, Zap } from "lucide-react";

export type StepStatus = "queued" | "running" | "done" | "failed" | "skipped";

export interface StepState {
  id: number;
  label: string;
  status: StepStatus;
  error?: string;
}

interface GenerateAllProgressModalProps {
  open: boolean;
  steps: StepState[];
  cancelledRef: React.MutableRefObject<boolean>;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
  onRetry: (stepId: number) => void;
  onMinimise?: () => void;
  isRunning: boolean;
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") {
    return <Loader2 size={18} className="animate-spin" style={{ color: "var(--charge)" }} />;
  }
  if (status === "done") {
    return <CheckCircle2 size={18} style={{ color: "#22c55e" }} />;
  }
  if (status === "failed") {
    return <XCircle size={18} style={{ color: "#ef4444" }} />;
  }
  if (status === "skipped") {
    return <Circle size={18} style={{ color: "var(--ink-3)", opacity: 0.5 }} />;
  }
  // queued
  return <Circle size={18} style={{ color: "var(--ink-4)" }} />;
}

export function GenerateAllProgressModal({
  open,
  steps,
  cancelledRef,
  onStart,
  onCancel,
  onClose,
  onRetry,
  onMinimise,
  isRunning,
}: GenerateAllProgressModalProps) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const totalActive = steps.filter((s) => s.status !== "skipped").length;
  const allQueued = steps.length > 0 && steps.every((s) => s.status === "queued");
  const hasQueued = steps.some((s) => s.status === "queued");
  const allFinished = !isRunning && steps.length > 0 && steps.every((s) => s.status === "done" || s.status === "failed" || s.status === "skipped");
  const wasCancelled = cancelledRef.current && !isRunning;

  // Determine progress label
  let progressLabel = `${doneCount} of ${totalActive} complete`;
  if (allQueued && !isRunning) {
    progressLabel = `${totalActive} assets ready to generate`;
  } else if (isRunning) {
    const runningStep = steps.find((s) => s.status === "running");
    progressLabel = runningStep
      ? `Generating ${runningStep.label}…`
      : `${doneCount} of ${totalActive} generating…`;
  } else if (wasCancelled) {
    progressLabel = `Cancelled — ${doneCount} of ${totalActive} completed`;
  } else if (allFinished) {
    progressLabel = failedCount > 0
      ? `Done — ${doneCount} succeeded, ${failedCount} failed`
      : `All ${doneCount} assets generated`;
  }

  // Title
  let title = "Generate Your Campaign";
  if (isRunning) title = "Generating Your Campaign";
  else if (allFinished && !wasCancelled) title = "Generation Complete";
  else if (wasCancelled) title = "Generation Cancelled";

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(26,22,36,0.55)",
          zIndex: 9998,
          backdropFilter: "blur(2px)",
        }}
        onClick={isRunning ? undefined : onClose}
      />
      {/* Modal */}
      <div
        className="zap-onboarding"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          background: "var(--card)",
          borderRadius: "var(--rL)",
          boxShadow: "0 8px 40px rgba(26,22,36,0.18), 0 2px 8px rgba(26,22,36,0.10)",
          padding: "32px 32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "22px",
                color: "var(--ink)",
                margin: "0 0 6px 0",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h2>
            <p
              style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: "13px",
                color: "var(--ink-2)",
                margin: 0,
              }}
            >
              {progressLabel}
            </p>
          </div>
          {/* Close button / Minimise button */}
          {isRunning ? (
            onMinimise && (
              <button
                onClick={onMinimise}
                title="Minimise — run continues in background"
                style={{
                  background: "transparent",
                  border: "1px solid var(--ink-4)",
                  cursor: "pointer",
                  color: "var(--ink-3)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: "12px",
                  gap: "4px",
                }}
                aria-label="Minimise"
              >
                — Minimise
              </button>
            )
          ) : (
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-3)",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "4px",
            background: "var(--ink-4)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${totalActive > 0 ? (doneCount / totalActive) * 100 : 0}%`,
              background: "var(--charge)",
              borderRadius: "4px",
              transition: "width 400ms ease",
            }}
          />
        </div>

        {/* Step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {steps.map((step) => (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: step.status === "running"
                  ? "rgba(255,91,29,0.06)"
                  : step.status === "done"
                  ? "rgba(34,197,94,0.05)"
                  : step.status === "failed"
                  ? "rgba(239,68,68,0.05)"
                  : "transparent",
                transition: "background 200ms ease",
              }}
            >
              {/* Icon */}
              <div style={{ marginTop: "1px", flexShrink: 0 }}>
                <StatusIcon status={step.status} />
              </div>

              {/* Label + error */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: step.status === "running" ? 600 : 500,
                    fontSize: "14px",
                    color: step.status === "skipped" ? "var(--ink-3)" : "var(--ink)",
                    margin: 0,
                    opacity: step.status === "skipped" ? 0.5 : 1,
                  }}
                >
                  {step.label}
                </p>
                {step.status === "failed" && step.error && (
                  <p
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: "12px",
                      color: "#ef4444",
                      margin: "3px 0 0 0",
                      lineHeight: 1.4,
                    }}
                  >
                    {step.error}
                  </p>
                )}
              </div>

              {/* Retry button */}
              {step.status === "failed" && !isRunning && (
                <button
                  onClick={() => onRetry(step.id)}
                  style={{
                    background: "transparent",
                    border: "1.5px solid var(--ink-4)",
                    borderRadius: "8px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "var(--ink-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    flexShrink: 0,
                    transition: "border-color 150ms ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--ink-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--ink-4)")}
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
          {hasQueued && !isRunning ? (
            /* Preview state — Start Generation + Cancel buttons */
            <>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "1.5px solid var(--ink-4)",
                  borderRadius: "10px",
                  padding: "9px 20px",
                  cursor: "pointer",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "var(--ink-2)",
                  transition: "border-color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--ink-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--ink-4)")}
              >
                Cancel
              </button>
              <button
                onClick={onStart}
                style={{
                  background: "var(--charge)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "9px 20px",
                  cursor: "pointer",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Zap size={14} />
                Start Generation
              </button>
            </>
          ) : isRunning ? (
            <button
              onClick={onCancel}
              style={{
                background: "transparent",
                border: "1.5px solid var(--ink-4)",
                borderRadius: "10px",
                padding: "9px 20px",
                cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                color: "var(--ink-2)",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--ink-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--ink-4)")}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "9px 20px",
                cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </>
  );
}
