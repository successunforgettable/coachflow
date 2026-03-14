/**
 * V2AdImageCreator — R2 Scroll-Stopper Ad Creator
 * Lives in the Tool Library tab only. No new routes.
 *
 * Spec:
 * - Auto-populates Service and ICP from user's active profiles (read-only)
 * - Visual Style dropdown: Transformation | Bold Text | Lifestyle | Results | Pattern Interrupt
 * - Image Format dropdown: Square 1080x1080 | Landscape 1200x628 | Story 1080x1920
 * - Credit display: "5 credits per generation" — reads videoCredits.getBalance
 * - Generate button: pill, #FF5B1D, disabled if credits = 0
 * - Generation state: Zappy working, elapsed timer, cycling messages
 * - Output: 5-card responsive grid with image, headline, style badge, compliance badge,
 *   Download button, Regenerate button (per-card spinner)
 * - On complete: Zappy cheering
 * - On revisit: loads last batch via getLatestByServiceId
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ZappyMascot from "./ZappyMascot";
import { Link } from "wouter";

// ─── Design tokens (inline, V2 cream system) ─────────────────────────────────
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

// ─── Visual style options ─────────────────────────────────────────────────────
const VISUAL_STYLES = [
  { value: "transformation",     label: "Transformation"     },
  { value: "bold_text",          label: "Bold Text"          },
  { value: "lifestyle",          label: "Lifestyle"          },
  { value: "results",            label: "Results"            },
  { value: "pattern_interrupt",  label: "Pattern Interrupt"  },
];

// ─── Image format options ─────────────────────────────────────────────────────
const IMAGE_FORMATS = [
  { value: "1080x1080",  label: "Square 1080×1080"    },
  { value: "1200x628",   label: "Landscape 1200×628"  },
  { value: "1080x1920",  label: "Story 1080×1920"     },
];

// ─── Cycling messages ─────────────────────────────────────────────────────────
const CYCLING_MESSAGES = [
  "Creating your ad visuals...",
  "Generating scroll-stopping imagery...",
  "Almost ready...",
];

// ─── Compliance badge ─────────────────────────────────────────────────────────
function ComplianceBadge({ issues }: { issues: string[] }) {
  const ok = issues.length === 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 10px",
        borderRadius: T.pill,
        fontSize: "11px",
        fontFamily: T.fontBody,
        fontWeight: 600,
        background: ok ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
        color:      ok ? "#16a34a"               : "#b45309",
        border:     `1px solid ${ok ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {ok ? "✓ Meta Compliant" : `⚠ ${issues.length} issue${issues.length > 1 ? "s" : ""}`}
    </span>
  );
}

// ─── Style badge ──────────────────────────────────────────────────────────────
function StyleBadge({ style }: { style: string }) {
  const label = style.replace(/_/g, " ");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: T.pill,
        fontSize: "11px",
        fontFamily: T.fontBody,
        fontWeight: 600,
        background: "rgba(139,92,246,0.1)",
        color: T.purple,
        border: "1px solid rgba(139,92,246,0.2)",
        textTransform: "capitalize" as const,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ─── Single image card ────────────────────────────────────────────────────────
type Creative = {
  id: number;
  headline: string;
  imageUrl: string;
  designStyle: string | null;
  complianceIssues: string | null;
};

function ImageCard({
  creative,
  onRegenerate,
  regenerating,
}: {
  creative: Creative;
  onRegenerate: (id: number) => void;
  regenerating: boolean;
}) {
  const issues: string[] = (() => {
    if (!creative.complianceIssues) return [];
    try { return JSON.parse(creative.complianceIssues); } catch { return []; }
  })();

  function handleDownload() {
    const a = document.createElement("a");
    a.href = creative.imageUrl;
    a.download = `zap-ad-${creative.id}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <div
      style={{
        background: T.card,
        borderRadius: T.radius,
        boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", background: "#f0ece4" }}>
        {regenerating ? (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(245,241,234,0.85)",
              zIndex: 2,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <ZappyMascot state="loading" size={64} />
              <p style={{ fontFamily: T.fontBody, fontSize: "12px", color: "#888", marginTop: "8px" }}>
                Regenerating…
              </p>
            </div>
          </div>
        ) : null}
        <img
          src={creative.imageUrl}
          alt={creative.headline}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      </div>
      {/* Card body */}
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {/* Headline */}
        <p
          style={{
            fontFamily: T.fontHeading,
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "15px",
            color: T.dark,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {creative.headline}
        </p>
        {/* Badges */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <StyleBadge style={creative.designStyle || "person_shocked"} />
          <ComplianceBadge issues={issues} />
        </div>
        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          {/* Download */}
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              background: T.dark,
              color: "#fff",
              border: "none",
              borderRadius: T.pill,
              padding: "10px 14px",
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            Download
          </button>
          {/* Regenerate */}
          <button
            onClick={() => !regenerating && onRegenerate(creative.id)}
            disabled={regenerating}
            style={{
              flex: 1,
              background: "transparent",
              color: T.dark,
              border: `2px solid ${T.dark}`,
              borderRadius: T.pill,
              padding: "10px 14px",
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: "13px",
              cursor: regenerating ? "not-allowed" : "pointer",
              opacity: regenerating ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { if (!regenerating) (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = regenerating ? "0.5" : "1"; }}
          >
            {regenerating ? "…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2AdImageCreator() {
  const [visualStyle, setVisualStyle]   = useState(VISUAL_STYLES[0].value);
  const [imageFormat, setImageFormat]   = useState(IMAGE_FORMATS[0].value);
  const [jobId, setJobId]               = useState<string | null>(null);
  const [status, setStatus]             = useState<"idle" | "generating" | "done" | "error">("idle");
  const [batchId, setBatchId]           = useState<string | null>(null);
  const [elapsed, setElapsed]           = useState(0);
  const [msgIdx, setMsgIdx]             = useState(0);
  const [regenIds, setRegenIds]         = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg]         = useState("");
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: services }    = trpc.services.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: icpList }     = trpc.icps.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: creditData }  = trpc.videoCredits.getBalance.useQuery(undefined, { staleTime: 10_000 });

  const activeService = services?.[0];
  const activeIcp     = icpList?.[0];
  const credits       = creditData?.balance ?? 0;

  // ── Load last batch on mount ─────────────────────────────────────────────────
  const { data: latestBatch } = trpc.adCreatives.getLatestByServiceId.useQuery(
    { serviceId: activeService?.id ?? 0 },
    { enabled: !!activeService, staleTime: 30_000 }
  );

  useEffect(() => {
    if (latestBatch && status === "idle") {
      setBatchId(latestBatch.batchId);
      setStatus("done");
    }
  }, [latestBatch]);

  // ── Batch query (shown after generation) ────────────────────────────────────
  const { data: batchData, refetch: refetchBatch } = trpc.adCreatives.getBatch.useQuery(
    { batchId: batchId ?? "" },
    { enabled: !!batchId && status === "done", staleTime: 0 }
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const generateAsync   = trpc.adCreatives.generateAsync.useMutation();
  const regenerateSingle = trpc.adCreatives.regenerateSingle.useMutation();

  // ── Polling logic ────────────────────────────────────────────────────────────
  const startPolling = useCallback((jId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "complete") {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          clearInterval(msgRef.current!);
          pollRef.current = null;
          const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          setBatchId(result.batchId);
          setStatus("done");
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          clearInterval(msgRef.current!);
          pollRef.current = null;
          setErrorMsg(data.error || "Generation failed. Please try again.");
          setStatus("error");
        }
      } catch { /* ignore */ }
    }, 5_000);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current)  clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (msgRef.current)   clearInterval(msgRef.current);
    };
  }, []);

  // ── Generate handler ─────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!activeService) return;
    setStatus("generating");
    setElapsed(0);
    setMsgIdx(0);
    setErrorMsg("");
    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1_000);
    // Start cycling messages
    msgRef.current = setInterval(() => setMsgIdx((i) => (i + 1) % CYCLING_MESSAGES.length), 6_000);
    try {
      const { jobId: jId } = await generateAsync.mutateAsync({
        serviceId:   activeService.id,
        icpId:       activeIcp?.id,
        visualStyle,
        imageFormat,
      });
      setJobId(jId);
      startPolling(jId);
    } catch (err: unknown) {
      clearInterval(timerRef.current!);
      clearInterval(msgRef.current!);
      setErrorMsg(err instanceof Error ? err.message : "Generation failed.");
      setStatus("error");
    }
  }

  // ── Regenerate single card ───────────────────────────────────────────────────
  async function handleRegenerate(id: number) {
    setRegenIds((prev) => new Set(prev).add(id));
    try {
      await regenerateSingle.mutateAsync({ id });
      await refetchBatch();
    } catch { /* ignore */ }
    setRegenIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  // ── Shared label style ───────────────────────────────────────────────────────
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
    background: "#f7f4ef",
    fontFamily: T.fontBody,
    fontSize: "14px",
    color: "#888",
    boxSizing: "border-box",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: "64px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: "28px" }}>
        <h2
          style={{
            fontFamily: T.fontHeading,
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "26px",
            color: T.dark,
            margin: "0 0 6px 0",
          }}
        >
          Ad Images
        </h2>
        <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: "#666", margin: 0 }}>
          Generate 5 scroll-stopping ad image variations from your service profile.
        </p>
      </div>

      {/* ── Form card ── */}
      <div
        style={{
          background: T.card,
          borderRadius: T.radius,
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          padding: "32px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          {/* Service (read-only) */}
          <div>
            <label style={labelStyle}>Service</label>
            <div style={readonlyStyle}>
              {activeService ? activeService.name : "No service found — create one first"}
            </div>
          </div>
          {/* ICP (read-only) */}
          <div>
            <label style={labelStyle}>Ideal Customer</label>
            <div style={readonlyStyle}>
              {activeIcp ? activeIcp.name : "No ICP found — create one first"}
            </div>
          </div>
          {/* Visual Style */}
          <div>
            <label style={labelStyle}>Visual Style</label>
            <select
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              style={selectStyle}
            >
              {VISUAL_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {/* Image Format */}
          <div>
            <label style={labelStyle}>Image Format</label>
            <select
              value={imageFormat}
              onChange={(e) => setImageFormat(e.target.value)}
              style={selectStyle}
            >
              {IMAGE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Credit display + Generate button */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {credits === 0 ? (
            <p style={{ fontFamily: T.fontBody, fontSize: "13px", color: "#b45309", margin: 0 }}>
              No credits remaining —{" "}
              <Link
                href="/pricing"
                style={{ color: T.orange, fontWeight: 700, textDecoration: "underline" }}
              >
                Upgrade to Pro Plus for more
              </Link>
            </p>
          ) : (
            <p style={{ fontFamily: T.fontBody, fontSize: "13px", color: "#666", margin: 0 }}>
              <strong style={{ color: T.dark }}>{credits}</strong> credits available &nbsp;·&nbsp; 5 credits per generation
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={status === "generating" || credits === 0 || !activeService}
            style={{
              background: (status === "generating" || credits === 0 || !activeService) ? "#ccc" : T.orange,
              color: "#fff",
              border: "none",
              borderRadius: T.pill,
              padding: "14px 32px",
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: "15px",
              cursor: (status === "generating" || credits === 0 || !activeService) ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (status !== "generating" && credits > 0 && activeService)
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
            }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            Generate Ad Images
          </button>
        </div>
      </div>

      {/* ── Generating state ── */}
      {status === "generating" && (
        <div
          style={{
            background: T.card,
            borderRadius: T.radius,
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            padding: "48px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <ZappyMascot state="loading" size={100} />
          <p
            style={{
              fontFamily: T.fontHeading,
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "20px",
              color: T.dark,
              margin: 0,
            }}
          >
            {CYCLING_MESSAGES[msgIdx]}
          </p>
          <p style={{ fontFamily: T.fontBody, fontSize: "13px", color: "#999", margin: 0 }}>
            {elapsed}s elapsed — this usually takes 60–90 seconds
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div
          style={{
            background: "#fff5f5",
            border: "1.5px solid #fca5a5",
            borderRadius: T.radius,
            padding: "24px 28px",
            marginBottom: "32px",
          }}
        >
          <p style={{ fontFamily: T.fontBody, fontSize: "14px", color: "#dc2626", margin: 0 }}>
            {errorMsg || "Something went wrong. Please try again."}
          </p>
          <button
            onClick={() => setStatus("idle")}
            style={{
              marginTop: "12px",
              background: T.dark,
              color: "#fff",
              border: "none",
              borderRadius: T.pill,
              padding: "10px 20px",
              fontFamily: T.fontBody,
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Output grid ── */}
      {status === "done" && batchData && batchData.length > 0 && (
        <div>
          {/* Zappy cheering header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <ZappyMascot state="cheering" size={64} />
            <div>
              <h3
                style={{
                  fontFamily: T.fontHeading,
                  fontStyle: "italic",
                  fontWeight: 900,
                  fontSize: "20px",
                  color: T.dark,
                  margin: "0 0 4px 0",
                }}
              >
                Your 5 ad images are ready!
              </h3>
              <p style={{ fontFamily: T.fontBody, fontSize: "13px", color: "#666", margin: 0 }}>
                Download any image or regenerate individual variations.
              </p>
            </div>
          </div>
          {/* 2-col grid on desktop, 1-col on mobile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {batchData.map((creative) => (
              <ImageCard
                key={creative.id}
                creative={creative}
                onRegenerate={handleRegenerate}
                regenerating={regenIds.has(creative.id)}
              />
            ))}
          </div>
          {/* Generate new batch button */}
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <button
              onClick={() => { setStatus("idle"); setBatchId(null); }}
              style={{
                background: "transparent",
                color: T.dark,
                border: `2px solid ${T.dark}`,
                borderRadius: T.pill,
                padding: "12px 28px",
                fontFamily: T.fontBody,
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              Generate New Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
