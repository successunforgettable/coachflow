/**
 * V2VideoCreator — R3 Video Creator
 * Lives in the Tool Library tab only. No new routes.
 *
 * Two-step flow:
 *   Step 1 — Generate Script (free): calls videoScripts.generateAsync, shows 5 scene cards
 *   Step 2 — Render Video (costs credits): calls videos.generate, shows video player
 *
 * Design: #F5F1EA cream, #FF5B1D orange, #1A1624 dark, Fraunces + Instrument Sans
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";
import { Link } from "wouter";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#F5F1EA",
  card:        "#FFFFFF",
  orange:      "#FF5B1D",
  purple:      "#8B5CF6",
  dark:        "#1A1624",
  radius:      "24px",
  pill:        "9999px",
  fontHeading: "Fraunces, serif",
  fontBody:    "Instrument Sans, sans-serif",
};

// ─── Video type options (V2 simplified set) ───────────────────────────────────
const VIDEO_TYPES = [
  { value: "explainer",         label: "Explainer"   },
  { value: "testimonial",       label: "Testimonial" },
  { value: "proof_results",     label: "VSL"         },
];

// ─── Visual style options ─────────────────────────────────────────────────────
const VISUAL_STYLES = [
  { value: "text_only",           label: "Text Only"   },
  { value: "kinetic_typography",  label: "Stock Video" },
  { value: "motion_graphics",     label: "Animated"    },
];

// ─── Duration options ─────────────────────────────────────────────────────────
const DURATIONS = [
  { value: "15", label: "15s (1 credit)" },
  { value: "30", label: "30s (1 credit)" },
  { value: "60", label: "60s (2 credits)" },
];

// ─── Cycling messages ─────────────────────────────────────────────────────────
const SCRIPT_MESSAGES = [
  "Writing your video script…",
  "Crafting your scenes…",
  "Almost ready…",
];
const RENDER_MESSAGES = [
  "Recording your voiceover…",
  "Assembling your video…",
  "Rendering final cut…",
  "Almost there…",
];

// ─── Credit cost helper ───────────────────────────────────────────────────────
function getCreditCost(duration: string): number {
  if (duration === "15" || duration === "30") return 1;
  if (duration === "60") return 2;
  return 3;
}

// ─── Scene card ───────────────────────────────────────────────────────────────
function SceneCard({ scene, index }: { scene: any; index: number }) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: "16px",
        padding: "20px 24px",
        border: "1.5px solid #e8e2d8",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          fontFamily: T.fontHeading,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "13px",
          color: T.orange,
          marginBottom: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Scene {index + 1}
      </div>

      {/* Voiceover text */}
      <div style={{ marginBottom: "12px" }}>
        <span
          style={{
            fontFamily: T.fontBody,
            fontSize: "11px",
            fontWeight: 600,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: "4px",
          }}
        >
          Voiceover
        </span>
        <p
          style={{
            fontFamily: T.fontBody,
            fontSize: "14px",
            color: T.dark,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {scene.voiceoverText}
        </p>
      </div>

      {/* Visual direction */}
      <div style={{ marginBottom: "12px" }}>
        <span
          style={{
            fontFamily: T.fontBody,
            fontSize: "11px",
            fontWeight: 600,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: "4px",
          }}
        >
          Visual Direction
        </span>
        <p
          style={{
            fontFamily: T.fontBody,
            fontSize: "13px",
            color: "#666",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {scene.visualDirection}
        </p>
      </div>

      {/* On-screen text */}
      {scene.onScreenText && (
        <div>
          <span
            style={{
              fontFamily: T.fontBody,
              fontSize: "11px",
              fontWeight: 600,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: "4px",
            }}
          >
            On-Screen Text
          </span>
          <p
            style={{
              fontFamily: T.fontBody,
              fontSize: "13px",
              color: T.purple,
              margin: 0,
              fontWeight: 600,
            }}
          >
            {scene.onScreenText}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2VideoCreator({ isFreeTier }: { isFreeTier?: boolean } = {}) {
  // Form state
  const [videoType, setVideoType]     = useState(VIDEO_TYPES[0].value);
  const [visualStyle, setVisualStyle] = useState(VISUAL_STYLES[0].value);
  const [duration, setDuration]       = useState(DURATIONS[1].value); // default 30s

  // Step 1 state
  const [step1Status, setStep1Status] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [scriptJobId, setScriptJobId] = useState<string | null>(null);
  const [scriptResult, setScriptResult] = useState<{
    scriptId: number;
    scenes: any[];
    voiceoverText: string;
    creditCost: number;
  } | null>(null);
  const [step1Elapsed, setStep1Elapsed] = useState(0);
  const [step1MsgIdx, setStep1MsgIdx]   = useState(0);
  const [step1Error, setStep1Error]     = useState("");

  // Step 2 state
  const [step2Status, setStep2Status] = useState<"idle" | "confirming" | "rendering" | "done" | "error">("idle");
  const [videoId, setVideoId]         = useState<number | null>(null);
  const [videoUrl, setVideoUrl]       = useState<string | null>(null);
  const [step2Elapsed, setStep2Elapsed] = useState(0);
  const [step2MsgIdx, setStep2MsgIdx]   = useState(0);
  const [step2Error, setStep2Error]     = useState("");

  // Refs for intervals
  const poll1Ref  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timer1Ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const msg1Ref   = useRef<ReturnType<typeof setInterval> | null>(null);
  const poll2Ref  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timer2Ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const msg2Ref   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: servicesList } = trpc.services.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: icpList }      = trpc.icps.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: creditData }   = trpc.videoCredits.getBalance.useQuery(undefined, { staleTime: 10_000 });

  const activeService = servicesList?.[0];
  const activeIcp     = icpList?.[0];
  const credits       = creditData?.balance ?? 0;
  const creditCost    = getCreditCost(duration);

  // ── Load last completed video on mount ───────────────────────────────────────
  const { data: latestVideo } = trpc.videos.getLatestByServiceId.useQuery(
    { serviceId: activeService?.id ?? 0 },
    { enabled: !!activeService, staleTime: 30_000 }
  );

  useEffect(() => {
    if (latestVideo && step1Status === "idle" && step2Status === "idle") {
      setVideoUrl(latestVideo.videoUrl ?? null);
      setVideoId(latestVideo.id);
      if (latestVideo.videoUrl) {
        setStep2Status("done");
        setStep1Status("done");
        if (latestVideo.script?.scenes) {
          setScriptResult({
            scriptId: latestVideo.scriptId!,
            scenes: latestVideo.script.scenes as any[],
            voiceoverText: latestVideo.script.voiceoverText ?? "",
            creditCost: getCreditCost(latestVideo.script.duration ?? "30"),
          });
        }
      }
    }
  }, [latestVideo]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const generateScriptAsync = trpc.videoScripts.generateAsync.useMutation();
  const generateVideo       = trpc.videos.generate.useMutation();

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      [poll1Ref, timer1Ref, msg1Ref, poll2Ref, timer2Ref, msg2Ref].forEach((r) => {
        if (r.current) clearInterval(r.current);
      });
    };
  }, []);

  // ── Step 1: Poll for script job ───────────────────────────────────────────────
  const startScriptPolling = useCallback((jId: string) => {
    if (poll1Ref.current) clearInterval(poll1Ref.current);
    poll1Ref.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "complete") {
          clearInterval(poll1Ref.current!); poll1Ref.current = null;
          clearInterval(timer1Ref.current!); timer1Ref.current = null;
          clearInterval(msg1Ref.current!); msg1Ref.current = null;
          const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          setScriptResult(result);
          setStep1Status("done");
        } else if (data.status === "failed") {
          clearInterval(poll1Ref.current!); poll1Ref.current = null;
          clearInterval(timer1Ref.current!); timer1Ref.current = null;
          clearInterval(msg1Ref.current!); msg1Ref.current = null;
          setStep1Error(data.error || "Script generation failed. Please try again.");
          setStep1Status("error");
        }
      } catch { /* ignore */ }
    }, 5_000);
  }, []);

  // ── Step 2: Poll for video render ─────────────────────────────────────────────
  const startVideoPolling = useCallback((vId: number) => {
    if (poll2Ref.current) clearInterval(poll2Ref.current);
    poll2Ref.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/trpc/videos.getById?input=${encodeURIComponent(JSON.stringify({ json: { videoId: vId } }))}`);
        if (!res.ok) return;
        const json = await res.json();
        const video = json?.result?.data?.json;
        if (!video) return;
        if (video.creatomateStatus === "succeeded" && video.videoUrl) {
          clearInterval(poll2Ref.current!); poll2Ref.current = null;
          clearInterval(timer2Ref.current!); timer2Ref.current = null;
          clearInterval(msg2Ref.current!); msg2Ref.current = null;
          setVideoUrl(video.videoUrl);
          setStep2Status("done");
        } else if (video.creatomateStatus === "failed") {
          clearInterval(poll2Ref.current!); poll2Ref.current = null;
          clearInterval(timer2Ref.current!); timer2Ref.current = null;
          clearInterval(msg2Ref.current!); msg2Ref.current = null;
          setStep2Error("Video rendering failed. Please try again.");
          setStep2Status("error");
        }
      } catch { /* ignore */ }
    }, 5_000);
  }, []);

  // ── Step 1 handler ───────────────────────────────────────────────────────────
  async function handleGenerateScript() {
    if (!activeService) return;
    setStep1Status("generating");
    setStep1Elapsed(0);
    setStep1MsgIdx(0);
    setStep1Error("");
    setScriptResult(null);
    setStep2Status("idle");
    setVideoUrl(null);
    setVideoId(null);
    timer1Ref.current = setInterval(() => setStep1Elapsed((s) => s + 1), 1_000);
    msg1Ref.current   = setInterval(() => setStep1MsgIdx((i) => (i + 1) % SCRIPT_MESSAGES.length), 6_000);
    try {
      const { jobId: jId } = await generateScriptAsync.mutateAsync({
        serviceId:   activeService.id,
        videoType:   videoType as any,
        duration:    duration as any,
        visualStyle: visualStyle as any,
      });
      setScriptJobId(jId);
      startScriptPolling(jId);
    } catch (err: unknown) {
      clearInterval(timer1Ref.current!); timer1Ref.current = null;
      clearInterval(msg1Ref.current!);   msg1Ref.current   = null;
      setStep1Error(err instanceof Error ? err.message : "Script generation failed.");
      setStep1Status("error");
    }
  }

  // ── Step 2 handler: confirm ───────────────────────────────────────────────────
  function handleRenderConfirm() {
    setStep2Status("confirming");
  }

  function handleRenderCancel() {
    setStep2Status("idle");
  }

  // ── Step 2 handler: render ────────────────────────────────────────────────────
  async function handleRender() {
    if (!scriptResult?.scriptId) return;
    setStep2Status("rendering");
    setStep2Elapsed(0);
    setStep2MsgIdx(0);
    setStep2Error("");
    timer2Ref.current = setInterval(() => setStep2Elapsed((s) => s + 1), 1_000);
    msg2Ref.current   = setInterval(() => setStep2MsgIdx((i) => (i + 1) % RENDER_MESSAGES.length), 6_000);
    try {
      const { videoId: vId } = await generateVideo.mutateAsync({
        scriptId:    scriptResult.scriptId,
        visualStyle: visualStyle as any,
        brandColor:  "#3B82F6",
      });
      setVideoId(vId);
      startVideoPolling(vId);
    } catch (err: unknown) {
      clearInterval(timer2Ref.current!); timer2Ref.current = null;
      clearInterval(msg2Ref.current!);   msg2Ref.current   = null;
      setStep2Error(err instanceof Error ? err.message : "Render failed.");
      setStep2Status("error");
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────
  function handleReset() {
    setStep1Status("idle");
    setStep2Status("idle");
    setScriptResult(null);
    setVideoUrl(null);
    setVideoId(null);
    setStep1Error("");
    setStep2Error("");
    setScriptJobId(null);
  }

  // ─── Shared styles ────────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontFamily: T.fontBody,
    fontSize: "11px",
    fontWeight: 600,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: "6px",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1.5px solid #e8e2d8",
    background: "#fff",
    fontFamily: T.fontBody,
    fontSize: "14px",
    color: T.dark,
    outline: "none",
    cursor: "pointer",
    appearance: "auto",
  };

  const readonlyStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1.5px solid #e8e2d8",
    background: "#f8f5f0",
    fontFamily: T.fontBody,
    fontSize: "14px",
    color: T.dark,
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100%",
        padding: "32px 24px",
        fontFamily: T.fontBody,
      }}
    >
      {/* Back link */}
      <Link
        href="/v2-dashboard?tab=tools"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontFamily: T.fontBody,
          fontSize: "13px",
          fontWeight: 600,
          color: "#888",
          textDecoration: "none",
          marginBottom: "28px",
        }}
      >
        ← Back to Tool Library
      </Link>

      {/* Heading */}
      <h1
        style={{
          fontFamily: T.fontHeading,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "clamp(28px, 4vw, 40px)",
          color: T.dark,
          margin: "0 0 6px 0",
          lineHeight: 1.1,
        }}
      >
        Video Creator
      </h1>
      <p
        style={{
          fontFamily: T.fontBody,
          fontSize: "15px",
          color: "#666",
          margin: "0 0 32px 0",
        }}
      >
        Generate AI video ads with voiceover and motion graphics.
      </p>

      <div style={{ maxWidth: "720px" }}>

        {/* ── FORM (shown when idle or after error) ──────────────────────────── */}
        {(step1Status === "idle" || step1Status === "error") && (
          <div
            style={{
              background: T.card,
              borderRadius: T.radius,
              padding: "32px",
              border: "1.5px solid #e8e2d8",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Service (read-only) */}
              <div>
                <span style={labelStyle}>Service</span>
                <div style={readonlyStyle}>
                  {activeService?.name ?? "No service found"}
                </div>
              </div>

              {/* ICP (read-only) */}
              <div>
                <span style={labelStyle}>Ideal Customer</span>
                <div style={readonlyStyle}>
                  {activeIcp?.name ?? "No ICP found"}
                </div>
              </div>

              {/* Video Type */}
              <div>
                <span style={labelStyle}>Video Type</span>
                <select
                  style={selectStyle}
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value)}
                >
                  {VIDEO_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Visual Style */}
              <div>
                <span style={labelStyle}>Visual Style</span>
                <select
                  style={selectStyle}
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                >
                  {VISUAL_STYLES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={labelStyle}>Duration</span>
                <select
                  style={selectStyle}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  {DURATIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {step1Status === "error" && step1Error && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "#fff0ed",
                  border: "1.5px solid #ffd0c4",
                  fontFamily: T.fontBody,
                  fontSize: "13px",
                  color: "#c0392b",
                }}
              >
                {step1Error}
              </div>
            )}

            {/* Generate Script button */}
            <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                onClick={handleGenerateScript}
                disabled={!activeService}
                style={{
                  padding: "14px 32px",
                  borderRadius: T.pill,
                  border: "none",
                  background: activeService ? T.dark : "#ccc",
                  color: "#fff",
                  fontFamily: T.fontBody,
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: activeService ? "pointer" : "not-allowed",
                  letterSpacing: "0.01em",
                }}
              >
                Generate Script — Free
              </button>
              <span
                style={{
                  fontFamily: T.fontBody,
                  fontSize: "13px",
                  color: "#888",
                }}
              >
                No credits used for script generation
              </span>
            </div>
          </div>
        )}

        {/* ── STEP 1 GENERATING STATE ─────────────────────────────────────────── */}
        {step1Status === "generating" && (
          <div
            style={{
              background: T.card,
              borderRadius: T.radius,
              padding: "40px 32px",
              border: "1.5px solid #e8e2d8",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            <ZappyMascot state="loading" size={110} />
            <p
              style={{
                fontFamily: T.fontHeading,
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "20px",
                color: T.dark,
                margin: "16px 0 6px 0",
              }}
            >
              {SCRIPT_MESSAGES[step1MsgIdx]}
            </p>
            <p
              style={{
                fontFamily: T.fontBody,
                fontSize: "13px",
                color: "#888",
                margin: 0,
              }}
            >
              {step1Elapsed}s elapsed
            </p>
          </div>
        )}

        {/* ── SCRIPT DISPLAY (Step 1 done) ────────────────────────────────────── */}
        {(step1Status === "done" || step2Status !== "idle") && scriptResult && (
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                fontFamily: T.fontHeading,
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "22px",
                color: T.dark,
                margin: "0 0 16px 0",
              }}
            >
              Your Video Script
            </h2>

            {scriptResult.scenes.map((scene: any, i: number) => (
              <SceneCard key={i} scene={scene} index={i} />
            ))}

            {/* Word count + credit cost */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                background: "#f8f5f0",
                borderRadius: "12px",
                marginBottom: "20px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: T.fontBody, fontSize: "13px", color: "#666" }}>
                {scriptResult.scenes.reduce(
                  (sum: number, s: any) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0),
                  0
                )}{" "}
                words total
              </span>
              <span
                style={{
                  fontFamily: T.fontBody,
                  fontSize: "13px",
                  fontWeight: 700,
                  color: T.orange,
                }}
              >
                {scriptResult.creditCost} credit{scriptResult.creditCost !== 1 ? "s" : ""} to render
              </span>
            </div>

            {/* Edit note */}
            <p
              style={{
                fontFamily: T.fontBody,
                fontSize: "12px",
                color: "#aaa",
                margin: "0 0 20px 0",
                fontStyle: "italic",
              }}
            >
              Want to edit scenes? Editing will be available in Phase L.
            </p>

            {/* ── RENDER BUTTON (Step 2 idle) ─────────────────────────────────── */}
            {/* Trial users always see upgrade prompt — before credit or confirmation checks */}
            {step2Status === "idle" && isFreeTier && (
              <UpgradePrompt variant="inline" featureName="Video Creator" />
            )}
            {step2Status === "idle" && !isFreeTier && (
              <>
                {credits === 0 ? (
                  <div
                    style={{
                      padding: "14px 20px",
                      borderRadius: "12px",
                      background: "#fff0ed",
                      border: "1.5px solid #ffd0c4",
                      fontFamily: T.fontBody,
                      fontSize: "13px",
                      color: "#c0392b",
                    }}
                  >
                    No credits remaining —{" "}
                    <a href="/pricing" style={{ color: T.orange, fontWeight: 700 }}>
                      Upgrade to Pro Plus for more
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={handleRenderConfirm}
                    style={{
                      padding: "14px 32px",
                      borderRadius: T.pill,
                      border: "none",
                      background: T.orange,
                      color: "#fff",
                      fontFamily: T.fontBody,
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Render Video — {scriptResult.creditCost} credit{scriptResult.creditCost !== 1 ? "s" : ""}
                  </button>
                )}
              </>
            )}

            {/* ── CONFIRMATION INLINE ─────────────────────────────────────────── */}
            {step2Status === "confirming" && !isFreeTier && (
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: "16px",
                  background: "#fff",
                  border: "1.5px solid #e8e2d8",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: T.fontBody,
                    fontSize: "14px",
                    color: T.dark,
                    flex: 1,
                    minWidth: "200px",
                  }}
                >
                  This will use {scriptResult.creditCost} of your {credits} credit{credits !== 1 ? "s" : ""}. Confirm?
                </span>
                <button
                  onClick={handleRender}
                  style={{
                    padding: "10px 24px",
                    borderRadius: T.pill,
                    border: "none",
                    background: T.orange,
                    color: "#fff",
                    fontFamily: T.fontBody,
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={handleRenderCancel}
                  style={{
                    padding: "10px 24px",
                    borderRadius: T.pill,
                    border: "1.5px solid #e8e2d8",
                    background: "transparent",
                    color: T.dark,
                    fontFamily: T.fontBody,
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Step 2 error */}
            {step2Status === "error" && step2Error && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "#fff0ed",
                  border: "1.5px solid #ffd0c4",
                  fontFamily: T.fontBody,
                  fontSize: "13px",
                  color: "#c0392b",
                }}
              >
                {step2Error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2 RENDERING STATE ──────────────────────────────────────────── */}
        {step2Status === "rendering" && !isFreeTier && (
          <div
            style={{
              background: T.card,
              borderRadius: T.radius,
              padding: "40px 32px",
              border: "1.5px solid #e8e2d8",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            <ZappyMascot state="loading" size={110} />
            <p
              style={{
                fontFamily: T.fontHeading,
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "20px",
                color: T.dark,
                margin: "16px 0 6px 0",
              }}
            >
              {RENDER_MESSAGES[step2MsgIdx]}
            </p>
            <p
              style={{
                fontFamily: T.fontBody,
                fontSize: "13px",
                color: "#888",
                margin: 0,
              }}
            >
              {step2Elapsed}s elapsed — video rendering typically takes 2–5 minutes
            </p>
          </div>
        )}

        {/* ── VIDEO OUTPUT (Step 2 done) ──────────────────────────────────────── */}
        {step2Status === "done" && videoUrl && (
          <div
            style={{
              background: T.card,
              borderRadius: T.radius,
              padding: "32px",
              border: "1.5px solid #e8e2d8",
              marginBottom: "24px",
            }}
          >
            <ZappyMascot state="cheering" size={90} />

            <h2
              style={{
                fontFamily: T.fontHeading,
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: "22px",
                color: T.dark,
                margin: "16px 0 20px 0",
              }}
            >
              Your video is ready!
            </h2>

            {/* Video player */}
            <video
              controls
              src={videoUrl}
              style={{
                width: "100%",
                borderRadius: "16px",
                background: "#000",
                marginBottom: "20px",
                maxHeight: "480px",
              }}
            />

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a
                href={videoUrl}
                download
                style={{
                  padding: "12px 28px",
                  borderRadius: T.pill,
                  border: "none",
                  background: T.dark,
                  color: "#fff",
                  fontFamily: T.fontBody,
                  fontWeight: 700,
                  fontSize: "14px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Download MP4
              </a>
              <button
                onClick={handleReset}
                style={{
                  padding: "12px 28px",
                  borderRadius: T.pill,
                  border: "1.5px solid #e8e2d8",
                  background: "transparent",
                  color: T.dark,
                  fontFamily: T.fontBody,
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Generate New Video
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
