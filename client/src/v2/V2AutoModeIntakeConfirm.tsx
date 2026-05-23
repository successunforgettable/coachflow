/**
 * V2AutoModeIntakeConfirm — Auto Mode Phase A
 *
 * Reviews the LLM extraction from V2AutoModeIntake. User edits any field
 * inline, fills any flagged low-confidence gaps, then clicks
 * "Looks Good — Build My Campaign". On confirm:
 *   1. services.create({name, category, description, targetCustomer, mainBenefit})
 *   2. services.expandProfile(serviceId)  — populates downstream fields
 *   3. icps.generateAsync(serviceId, name=icpDescriptor)  — fires async
 * Then navigates to /v2-dashboard. Phase A terminal state.
 *
 * Phase B (orchestration job) takes over from there in a future commit.
 *
 * Low-confidence-extract fallback (B-4): per-field orange border + "Needs
 * your attention" pill on flagged fields. Banner above the field stack
 * when overall confidence === "low". CTA gated on flagged fields meeting
 * an 8-character minimum each.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import V2Layout from "./V2Layout";
import UpgradePrompt from "./components/UpgradePrompt";

type ServiceCategory = "coaching" | "speaking" | "consulting";

type Extracted = {
  serviceName: string;
  serviceCategory: ServiceCategory;
  serviceDescription: string;
  targetCustomer: string;
  mainBenefit: string;
  icpDescriptor: string;
  confidence: "high" | "medium" | "low";
  lowConfidenceFields: string[];
};

const FIELD_MIN_CHARS = 8;

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "40px 36px",
  maxWidth: "640px",
  margin: "0 auto",
  width: "100%",
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: "var(--v2-font-body)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v2-text-color)",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "6px",
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  fontSize: "14px",
  fontFamily: "var(--v2-font-body)",
  borderRadius: "10px",
  background: "#fff",
  color: "var(--v2-text-color)",
  outline: "none",
};

export default function V2AutoModeIntakeConfirm() {
  const [location, navigate] = useLocation();

  // ── Phase F Item 1 (C0.1) — belt-and-suspenders trial-user gate ──────────
  // Mirror gate to V2AutoModeIntake's proactive gate. Defense against:
  //   - User pastes /v2-dashboard/auto-mode/confirm URL directly
  //   - Back-button navigation after a downgrade
  //   - Stale window.history.state from a previous Pro session
  // Server-side `isAutoModeTierAllowed` (autoMode.ts:65) is the ground
  // truth; this client-side mirror prevents the trial user from wasting
  // the services.create + expandProfile + icps.generateAsync work before
  // the orchestrate FORBIDDEN throw.
  const { user: authUser } = useAuth();
  const isFreeTier = !authUser
    || (authUser.role !== "superuser"
        && authUser.role !== "admin"
        && authUser.subscriptionTier !== "pro"
        && authUser.subscriptionTier !== "agency");

  // wouter passes location state via history.state (set on navigate(_, {state}))
  const incomingState = (typeof window !== "undefined" ? (window.history.state ?? null) : null) as
    | { extracted?: Extracted; rawText?: string }
    | null;

  const [extracted, setExtracted] = useState<Extracted | null>(incomingState?.extracted ?? null);
  const [rawText] = useState<string>(incomingState?.rawText ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // B3.3 hotfix: split loading phase so the button label can rotate
  // ("Saving…" during fast service writes → "Setting up your profile…"
  // during the ICP poll). Two distinct states better than one ambiguous
  // "Saving…" for 30-120s during ICP generation.
  const [loadingPhase, setLoadingPhase] = useState<"saving" | "icp" | null>(null);

  const createService = trpc.services.create.useMutation();
  const expandProfile = trpc.services.expandProfile.useMutation();
  // B3.3 hotfix: reverted from icps.generate (sync, blocks HTTP request for
  // the LLM call duration → Railway proxy timeout at ~3min → HTML 504 →
  // tRPC client JSON.parse fails with "Unexpected token '<', '<!DOCTYPE'")
  // back to icps.generateAsync (returns jobId in <100ms; LLM runs
  // server-side via setImmediate, escaping the HTTP request lifetime).
  // Client-side polls /api/jobs/<jobId> every 5s for completion, extracts
  // result.icpId from the polled response, then calls autoMode.orchestrate.
  // Mirrors the existing V2GeneratorWizard polling pattern.
  const generateIcpAsync = trpc.icps.generateAsync.useMutation();
  const orchestrate = trpc.autoMode.orchestrate.useMutation();

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // No state from intake → bounce back. Avoids broken direct-link state.
  useEffect(() => {
    if (!extracted) navigate("/v2-dashboard/auto-mode");
  }, [extracted, navigate]);

  // Cleanup poll interval on unmount.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Phase F Item 1 (C0.1) — render upgrade screen for trial users BEFORE
  // any extracted-state checks. All hooks above must run unconditionally
  // (React rules-of-hooks); the early return below is the only conditional
  // render gate.
  if (isFreeTier) {
    return (
      <V2Layout>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
          <button
            onClick={() => navigate("/v2-dashboard")}
            style={{ alignSelf: "flex-start", marginBottom: "24px", fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#777", background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Back to Dashboard
          </button>
          <div style={{ maxWidth: "640px", width: "100%", margin: "0 auto" }}>
            <UpgradePrompt
              variant="inline"
              featureName="Auto Mode"
              bodyCopy={{
                line1: "Auto Mode is a Pro feature.",
                line2: "Upgrade to unlock the 1-click campaign builder.",
              }}
            />
          </div>
        </div>
      </V2Layout>
    );
  }

  if (!extracted) return null;

  const flaggedSet = new Set(extracted.lowConfidenceFields);

  function setField<K extends keyof Extracted>(key: K, value: Extracted[K]) {
    setExtracted(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function isFieldFlagged(key: keyof Extracted): boolean {
    if (!flaggedSet.has(String(key))) return false;
    // Once user types past the threshold, the visual flag clears.
    const v = (extracted?.[key] ?? "") as string;
    return v.trim().length < FIELD_MIN_CHARS;
  }

  function inputStyleFor(key: keyof Extracted): React.CSSProperties {
    const flagged = isFieldFlagged(key);
    return {
      ...inputBaseStyle,
      border: flagged ? "1px solid rgba(255,91,29,0.45)" : "1px solid rgba(26,22,36,0.15)",
    };
  }

  // Submit gate: required fields non-empty + flagged fields ≥ FIELD_MIN_CHARS.
  const requiredKeys: (keyof Extracted)[] = ["serviceName", "serviceCategory", "serviceDescription", "targetCustomer", "mainBenefit"];
  const allRequiredFilled = requiredKeys.every(k => (extracted[k] as string).trim().length > 0);
  const noFlaggedGaps = !requiredKeys.some(k => isFieldFlagged(k));
  const submitEnabled = allRequiredFilled && noFlaggedGaps && !isSubmitting;

  // Poll /api/jobs/<jobId> every 5s until terminal status. Mirrors the
  // V2GeneratorWizard pattern (L1782+) — single source of truth for the
  // 5s cadence + 300s ceiling.
  function pollIcpJob(jobId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const POLL_INTERVAL_MS = 5_000;
      const MAX_POLL_MS = 300_000;
      const pollStart = Date.now();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) {
            // Transient HTTP error — keep polling until ceiling.
            if (Date.now() - pollStart > MAX_POLL_MS) {
              if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
              reject(new Error("ICP generation timed out after 300 seconds"));
            }
            return;
          }
          const data = (await res.json()) as { status: string; result: { icpId?: number } | null; error?: string };
          if (data.status === "complete") {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            const icpId = data.result?.icpId;
            if (typeof icpId !== "number") {
              reject(new Error("ICP job completed without an icpId."));
              return;
            }
            resolve(icpId);
          } else if (data.status === "failed") {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            reject(new Error(data.error || "ICP generation failed."));
          } else if (Date.now() - pollStart > MAX_POLL_MS) {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            reject(new Error("ICP generation timed out after 300 seconds"));
          }
        } catch (pollErr) {
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
          reject(pollErr);
        }
      }, POLL_INTERVAL_MS);
    });
  }

  async function handleConfirm() {
    if (!submitEnabled || !extracted) return;
    setSubmitError(null);
    setIsSubmitting(true);
    setLoadingPhase("saving");
    try {
      const created = await createService.mutateAsync({
        name: extracted.serviceName.trim(),
        category: extracted.serviceCategory,
        description: extracted.serviceDescription.trim(),
        targetCustomer: extracted.targetCustomer.trim(),
        mainBenefit: extracted.mainBenefit.trim(),
      });
      const serviceId = (created as { id: number }).id;
      // Expand downstream Service fields. If this fails non-fatally, we
      // still proceed — expansion is enhancement, not gating.
      try { await expandProfile.mutateAsync({ serviceId }); } catch { /* surfaced via dashboard if needed */ }
      // Generate ICP via async job + poll. The sync icps.generate path held
      // the HTTP request open for the LLM call (~30-120s) which exceeded
      // Railway's proxy timeout, returning HTML 504 → tRPC JSON.parse fail.
      // generateIcpAsync returns {jobId} in <100ms; LLM runs server-side
      // via setImmediate.
      setLoadingPhase("icp");
      let icpId: number;
      try {
        const { jobId } = await generateIcpAsync.mutateAsync({
          serviceId,
          name: extracted.icpDescriptor.trim() || `${extracted.serviceName.trim()} Profile`,
        });
        icpId = await pollIcpJob(jobId);
      } catch (icpErr) {
        const msg = icpErr instanceof Error ? icpErr.message : "Could not generate your ICP. You can retry from the dashboard.";
        setSubmitError(msg);
        setIsSubmitting(false);
        setLoadingPhase(null);
        return;
      }
      // Kick Auto Mode orchestration — server-side job; client polls progress.
      try {
        const { jobId } = await orchestrate.mutateAsync({
          serviceId,
          icpId,
          // campaignType undefined per locked B3 spec — orchestrator falls
          // back to runX defaults (course_launch in cascade map).
        });
        navigate(`/v2-dashboard/auto-mode/progress?jobId=${jobId}`);
      } catch (orchestrateErr) {
        const msg = orchestrateErr instanceof Error ? orchestrateErr.message : "Could not start Auto Mode. You can pick up generation manually from the dashboard.";
        setSubmitError(msg);
        setIsSubmitting(false);
        setLoadingPhase(null);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save your profile. Please try again.";
      setSubmitError(msg);
      setIsSubmitting(false);
      setLoadingPhase(null);
    }
  }

  function handleRewrite() {
    navigate("/v2-dashboard/auto-mode", { state: { rawTextResume: rawText } });
  }

  const showLowBanner = extracted.confidence === "low";

  return (
    <V2Layout>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 16px 64px" }}>
        {/* Phase A.1: dual back-links — out-of-flow exit (Dashboard) + in-flow
            back (Re-write). Mirrors intake-screen "Back to Dashboard" position
            and styling so the abandon path is 1-click from anywhere in the
            Auto Mode flow. */}
        <div style={{ alignSelf: "flex-start", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/v2-dashboard")}
            style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#777", background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Back to Dashboard
          </button>
          <span style={{ color: "rgba(26,22,36,0.20)", fontSize: "14px", userSelect: "none" }}>·</span>
          <button
            onClick={handleRewrite}
            style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#777", background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Re-write My Description
          </button>
        </div>
        <div style={cardStyle}>
          <h1 style={{ fontFamily: "var(--v2-font-heading)", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(22px, 5vw, 30px)", color: "var(--v2-text-color)", lineHeight: 1.2, marginBottom: "8px", marginTop: 0, textAlign: "center" }}>
            Here&apos;s what Zappy understood
          </h1>
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#555", lineHeight: 1.55, margin: "0 0 24px", textAlign: "center" }}>
            Edit anything that&apos;s off — these become your campaign foundation. Zappy generates everything else from these six fields.
          </p>
          {showLowBanner && (
            <div style={{ background: "rgba(255,91,29,0.06)", border: "1px solid rgba(255,91,29,0.20)", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#1A1624", lineHeight: 1.55 }}>
              Zappy extracted a starting point — but the highlighted fields below need your input before we build your campaign. The more concrete you are here, the better everything generates downstream.
            </div>
          )}
          <FieldBlock
            label="Service / Programme Name"
            note="What you call this offer."
            flagged={isFieldFlagged("serviceName")}
          >
            <input
              type="text"
              value={extracted.serviceName}
              onChange={(e) => setField("serviceName", e.target.value)}
              placeholder="e.g. Authority Stack Accelerator"
              style={inputStyleFor("serviceName")}
            />
          </FieldBlock>
          <FieldBlock
            label="Category"
            note="Closest match to your delivery model."
            flagged={isFieldFlagged("serviceCategory")}
          >
            <select
              value={extracted.serviceCategory}
              onChange={(e) => setField("serviceCategory", e.target.value as ServiceCategory)}
              style={{ ...inputStyleFor("serviceCategory"), cursor: "pointer" }}
            >
              <option value="coaching">Coaching</option>
              <option value="consulting">Consulting</option>
              <option value="speaking">Speaking</option>
            </select>
          </FieldBlock>
          <FieldBlock
            label="Description"
            note="One sentence describing what you do, in your own words."
            flagged={isFieldFlagged("serviceDescription")}
          >
            <textarea
              value={extracted.serviceDescription}
              onChange={(e) => setField("serviceDescription", e.target.value)}
              rows={2}
              placeholder="e.g. I help new consultants land their first $10k clients via positioning + outbound."
              style={{ ...inputStyleFor("serviceDescription"), resize: "vertical", minHeight: "60px" }}
            />
          </FieldBlock>
          <FieldBlock
            label="Target Customer"
            note="Who you help. Demographic + context."
            flagged={isFieldFlagged("targetCustomer")}
          >
            <input
              type="text"
              value={extracted.targetCustomer}
              onChange={(e) => setField("targetCustomer", e.target.value)}
              placeholder="e.g. New consultants who haven't landed their first $10k client yet"
              style={inputStyleFor("targetCustomer")}
            />
          </FieldBlock>
          <FieldBlock
            label="Main Benefit"
            note="The primary outcome you deliver."
            flagged={isFieldFlagged("mainBenefit")}
          >
            <input
              type="text"
              value={extracted.mainBenefit}
              onChange={(e) => setField("mainBenefit", e.target.value)}
              placeholder="e.g. First paid call within 30 days"
              style={inputStyleFor("mainBenefit")}
            />
          </FieldBlock>
          <FieldBlock
            label="Ideal Customer Descriptor"
            note="One-line snapshot of your ideal customer — feeds the ICP generator."
            flagged={isFieldFlagged("icpDescriptor")}
          >
            <input
              type="text"
              value={extracted.icpDescriptor}
              onChange={(e) => setField("icpDescriptor", e.target.value)}
              placeholder="e.g. Early-stage consultants, 0-2 clients in, frustrated by inconsistent outreach results"
              style={inputStyleFor("icpDescriptor")}
            />
          </FieldBlock>
          {submitError && (
            <div style={{ background: "rgba(255,91,29,0.06)", border: "1px solid rgba(255,91,29,0.20)", borderRadius: "12px", padding: "12px 16px", marginTop: "8px", marginBottom: "16px", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#B5421A" }}>
              {submitError}
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!submitEnabled}
            title={submitEnabled ? undefined : "Fill the highlighted fields first"}
            style={{
              display: "block",
              width: "100%",
              background: "var(--v2-primary-btn)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "18px 32px",
              fontSize: "17px",
              fontFamily: "var(--v2-font-body)",
              fontWeight: 700,
              cursor: submitEnabled ? "pointer" : "not-allowed",
              letterSpacing: "0.01em",
              opacity: submitEnabled ? 1 : 0.55,
              marginTop: "8px",
            }}
          >
            {isSubmitting
              ? (loadingPhase === "icp" ? "Setting up your profile…" : "Saving…")
              : "Looks Good — Build My Campaign"}
          </button>
        </div>
      </div>
    </V2Layout>
  );
}

function FieldBlock({
  label,
  note,
  flagged,
  children,
}: {
  label: string;
  note: string;
  flagged: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={fieldLabelStyle}>
        <span>{label}</span>
        {flagged && (
          <span style={{ background: "rgba(255,91,29,0.10)", color: "#B5421A", border: "1px solid rgba(255,91,29,0.25)", borderRadius: "9999px", padding: "2px 10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Needs your attention
          </span>
        )}
      </div>
      <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "11px", color: "#777", margin: "0 0 6px", lineHeight: 1.5 }}>{note}</p>
      {children}
    </div>
  );
}
