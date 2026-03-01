import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

const ZAP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/GFyyklkYbPvEBkLS.png";

const PROGRESS_DOTS = [false, true, false, false, false];

interface Stage2Props {
  programName: string;
  serviceId: number;
  campaignId: number;
  onComplete: (generatedHeadline: string | null) => void;
}

export function Stage2Video({ programName, serviceId, campaignId, onComplete }: Stage2Props) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [ctaUnlocked, setCtaUnlocked] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [generatedHeadline, setGeneratedHeadline] = useState<string | null>(null);
  const [headlineReady, setHeadlineReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateHeadlines = trpc.headlines.generate.useMutation();
  const utils = trpc.useUtils();
  const updateStage = trpc.onboarding.updateStageFlag.useMutation();

  // Start 20-second CTA unlock timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsElapsed((s) => {
        const next = s + 1;
        if (next >= 20) {
          setCtaUnlocked(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Fire headline generation in background immediately on mount
  useEffect(() => {
    generateHeadlines
      .mutateAsync({
        serviceId,
        campaignId,
        targetMarket: "coaches and consultants",
        pressingProblem: "attracting consistent high-quality clients",
        desiredOutcome: "a fully booked practice with premium clients",
        uniqueMechanism: "ZAP AI-powered marketing system",
      })
      .then(async (result) => {
        if (result?.headlineSetId) {
          // Fetch the actual headline text by headlineSetId
          try {
            const headlines = await utils.headlines.getBySetId.fetch({
              headlineSetId: result.headlineSetId,
            });
            if (headlines?.headlines) {
              // getBySetId returns grouped object: { story:[], question:[], authority:[], ... }
              const grouped = headlines.headlines as Record<string, Array<{ headline?: string }>>;
              const allHeadlines = [
                ...(grouped.question || []),
                ...(grouped.story || []),
                ...(grouped.authority || []),
                ...(grouped.urgency || []),
                ...(grouped.eyebrow || []),
              ];
              if (allHeadlines.length > 0) {
                setGeneratedHeadline(allHeadlines[0].headline || null);
              }
            }
          } catch {
            // Silent failure — fallback used in Stage 3
          }
        }
        setHeadlineReady(true);
      })
      .catch(() => {
        // Silent failure — fallback will be used in Stage 3
        setHeadlineReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track video playback progress
  function handleTimeUpdate() {
    const v = videoRef.current;
    if (v && v.duration) {
      setVideoProgress((v.currentTime / v.duration) * 100);
    }
  }

  async function handleCTAClick() {
    if (!ctaUnlocked) return;
    await updateStage.mutateAsync({ stage: 3 });
    onComplete(generatedHeadline);
  }

  function handleSkip() {
    onComplete(generatedHeadline);
  }

  const secondsLeft = Math.max(0, 20 - secondsElapsed);

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

      {/* Video card */}
      <div
        className="zo-card"
        style={{
          width: "100%",
          maxWidth: "600px",
          overflow: "hidden",
        }}
      >
        {/* Video wrapper */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0D0D14" }}>
          {/* Video element — URL to be provided by Arfeen */}
          <video
            ref={videoRef}
            src="" /* Arfeen to provide video URL */
            autoPlay
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* Placeholder overlay when no video src */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #1A1624 0%, #2D1B4E 100%)",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "48px" }}>🎬</div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textAlign: "center" }}>
              Welcome video coming soon
            </p>
          </div>

          {/* Sound toggle button */}
          <button
            onClick={() => {
              setIsMuted((m) => !m);
              if (videoRef.current) videoRef.current.muted = !isMuted;
            }}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "rgba(0,0,0,0.6)",
              border: "none",
              borderRadius: "8px",
              padding: "6px 10px",
              color: "#fff",
              fontSize: "16px",
              cursor: "pointer",
              zIndex: 2,
            }}
            title={isMuted ? "Turn sound on" : "Mute"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>

        {/* Video progress bar */}
        <div style={{ height: "3px", background: "var(--inset)", position: "relative" }}>
          <div
            style={{
              height: "100%",
              width: `${videoProgress}%`,
              background: "var(--charge)",
              transition: "width 500ms linear",
            }}
          />
        </div>

        {/* Card body */}
        <div style={{ padding: "24px 28px 28px" }}>
          <h2 style={{ fontSize: "22px", marginBottom: "6px" }}>
            A quick word from Arfeen
          </h2>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "24px" }}>
            While you watch, ZAP is already writing your first headline for{" "}
            <strong style={{ color: "var(--ink)" }}>{programName}</strong>.
          </p>

          {/* CTA button */}
          <button
            className="btn-primary"
            onClick={handleCTAClick}
            disabled={!ctaUnlocked}
          >
            {ctaUnlocked
              ? "Let's build your campaign →"
              : `Let's build your campaign → (${secondsLeft}s)`}
          </button>

          {/* Skip link */}
          <div style={{ textAlign: "right", marginTop: "12px" }}>
            <button className="btn-ghost" onClick={handleSkip} style={{ fontSize: "13px" }}>
              Skip video
            </button>
          </div>
        </div>
      </div>

      {/* Background generation indicator */}
      {!headlineReady && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--ink-3)",
            marginTop: "16px",
            textAlign: "center",
          }}
        >
          ✦ ZAP is writing your first headline in the background…
        </p>
      )}
    </div>
  );
}
