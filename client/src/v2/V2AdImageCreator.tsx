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
  serviceId: number | null;
  // Raw Flux background used by recompositeText to avoid ghost pixels on
  // text-only edits. Null on pre-R2c-cleanbackground rows — legacy path is
  // gated client-side (Update Text Only disabled) so those users go through
  // New Image + Text to repopulate this field.
  rawImageUrl: string | null;
};

// Node 6 headline shape — matches headlinesRouter.listForServiceId return rows.
type NodeHeadline = {
  id: number;
  text: string;
  formulaType: "story" | "eyebrow" | "question" | "authority" | "urgency";
  selectionScore: string | null;
};

// Tier derived from Node 6's selectionScore — mirrors ScoreBadge in V2HeadlinesResultPanel.
function tierFromScore(score: string | null | undefined): {
  label: string; bg: string; color: string; border: string;
} {
  const n = score == null ? NaN : parseFloat(score);
  if (!isNaN(n) && n >= 80) return { label: "⚡ Top Pick", bg: "rgba(139,92,246,0.12)", color: "#5B21B6", border: "rgba(139,92,246,0.40)" };
  if (!isNaN(n) && n >= 60) return { label: "✓ Strong",   bg: "rgba(88,204,2,0.12)",   color: "#2E7D00", border: "rgba(88,204,2,0.40)"   };
  return                          { label: "~ Test",      bg: "rgba(26,22,36,0.06)",   color: "#666",    border: "rgba(26,22,36,0.15)"  };
}

function ImageCard({
  creative,
  onRegenerateWithText,
  onUpdateTextOnly,
  busy,
  isTrialTier,
  regenError,
}: {
  creative: Creative;
  onRegenerateWithText: (id: number, newHeadline: string) => void;
  onUpdateTextOnly: (id: number, newHeadline: string) => void;
  busy: boolean;
  isTrialTier: boolean;
  regenError: string | null;
}) {
  const [editMode, setEditMode]               = useState(false);

  // Picker source is the creative's own serviceId — not the user's currently
  // active service — so multi-service batches and stale revisits stay scoped
  // correctly. React Query dedupes identical serviceIds across cards, so a
  // single-service batch still makes one network call.
  const { data: approvedHeadlines } = trpc.headlines.listForServiceId.useQuery(
    { serviceId: creative.serviceId ?? 0 },
    { enabled: creative.serviceId != null, staleTime: 30_000 }
  );
  const availableHeadlines: NodeHeadline[] = approvedHeadlines ?? [];

  // Pre-select the headline currently baked into the creative if it matches one
  // of Node 6's entries exactly. Legacy rows with non-matching copy leave this
  // null — user must pick from the list before the action buttons enable.
  const preSelect = availableHeadlines.find(h => h.text === creative.headline)?.text ?? null;
  const [selectedHeadline, setSelectedHeadline] = useState<string | null>(preSelect);

  // Re-sync selection when the underlying headline or the available list changes.
  useEffect(() => {
    setSelectedHeadline(availableHeadlines.find(h => h.text === creative.headline)?.text ?? null);
  }, [creative.headline, availableHeadlines]);

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

  function openEdit() {
    setSelectedHeadline(availableHeadlines.find(h => h.text === creative.headline)?.text ?? null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
  }

  function commitUpdateText() {
    if (!selectedHeadline) return;
    if (selectedHeadline === creative.headline) { setEditMode(false); return; }
    onUpdateTextOnly(creative.id, selectedHeadline);
    setEditMode(false);
  }

  function commitRegenerate() {
    if (!selectedHeadline) return;
    onRegenerateWithText(creative.id, selectedHeadline);
    setEditMode(false);
  }

  const hasSelection    = selectedHeadline !== null;
  const actionsDisabled = busy || !hasSelection;
  // Legacy rows (pre-R2c-cleanbackground) have no raw Flux background, so
  // recompositeText would fall back to the already-baked imageUrl and ghost
  // pixels from the old headline would bleed through the new one. Gate the
  // Update Text Only button entirely; New Image + Text remains available
  // and will repopulate rawImageUrl on completion.
  const isLegacyRow         = creative.rawImageUrl == null;
  const updateTextDisabled  = actionsDisabled || isLegacyRow;
  const updateTextTooltip   = isLegacyRow
    ? "Regenerate this image once to enable quick text updates"
    : "Re-composites the new headline onto the same image. Free — no Flux call.";

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
        {busy ? (
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
                Working…
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
        {/* Inline regen error — cleared when user clicks Regenerate again */}
        {regenError && !busy && (
          <div
            role="alert"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: "10px",
              padding: "8px 12px",
              fontFamily: T.fontBody,
              fontSize: "12px",
              color: "#991B1B",
              lineHeight: 1.4,
            }}
          >
            {regenError}
          </div>
        )}
        {/* Actions — two-state UI: default (Download + Regenerate) or edit panel */}
        {!editMode ? (
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
            {/* Regenerate — opens the edit panel */}
            <button
              onClick={() => !busy && openEdit()}
              disabled={busy}
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
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = busy ? "0.5" : "1"; }}
            >
              {busy ? "…" : "Regenerate"}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "4px",
              padding: "14px",
              background: T.bg,
              borderRadius: "16px",
              border: "1.5px solid #e8e2d8",
            }}
          >
            <label
              style={{
                fontFamily: T.fontBody,
                fontSize: "11px",
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Pick a headline from Node 6
            </label>

            {availableHeadlines.length === 0 ? (
              <div
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1.5px dashed #d9d3c7",
                  background: "#fff",
                  fontFamily: T.fontBody,
                  fontSize: "13px",
                  color: "#888",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                No compliant headlines for this campaign yet.<br />
                Generate a headline set in the Headlines tool, then come back to pick one.
              </div>
            ) : (
              <>
                {!hasSelection && (
                  <div
                    style={{
                      fontFamily: T.fontBody,
                      fontSize: "12px",
                      color: "#888",
                      fontStyle: "italic",
                    }}
                  >
                    Select a headline from Node 6 to apply it
                  </div>
                )}
                <div
                  role="listbox"
                  aria-label="Approved headlines"
                  style={{
                    maxHeight: "280px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    paddingRight: "4px",
                  }}
                >
                  {availableHeadlines.map((h) => {
                    const selected = selectedHeadline === h.text;
                    const tier     = tierFromScore(h.selectionScore);
                    return (
                      <button
                        key={h.id}
                        role="option"
                        aria-selected={selected}
                        onClick={() => setSelectedHeadline(h.text)}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          padding: "10px 12px",
                          paddingLeft: selected ? "10px" : "14px",
                          borderLeft: selected ? `4px solid ${T.orange}` : "0",
                          background: selected ? T.bg : "#fff",
                          borderTop:    "1px solid #eee",
                          borderRight:  "1px solid #eee",
                          borderBottom: "1px solid #eee",
                          borderRadius: "8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          fontFamily: T.fontBody,
                          transition: "background 0.15s",
                        }}
                      >
                        <div style={{ fontSize: "13px", color: T.dark, lineHeight: 1.4 }}>
                          {h.text}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: tier.bg,
                            border: `1px solid ${tier.border}`,
                            borderRadius: "9999px",
                            padding: "2px 8px",
                            fontSize: "10px",
                            fontWeight: 600,
                            color: tier.color,
                            letterSpacing: "0.02em",
                          }}>
                            {tier.label}
                          </span>
                          <span style={{ fontSize: "10px", color: "#999" }}>
                            {h.text.length} chars
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              {/* Update Text Only — secondary, purple, cheap recomposite */}
              {/* Disabled on legacy rows (rawImageUrl == null) to prevent ghost-pixel composites */}
              <button
                onClick={() => !updateTextDisabled && commitUpdateText()}
                disabled={updateTextDisabled}
                style={{
                  flex: 1,
                  background: T.purple,
                  color: "#fff",
                  border: "none",
                  borderRadius: T.pill,
                  padding: "10px 14px",
                  fontFamily: T.fontBody,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: updateTextDisabled ? "not-allowed" : "pointer",
                  opacity: updateTextDisabled ? 0.4 : 1,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { if (!updateTextDisabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = updateTextDisabled ? "0.4" : "1"; }}
                title={updateTextTooltip}
              >
                Update Text Only
              </button>
              {/* New Image + Text — primary, orange, full regenerate */}
              <button
                onClick={() => !actionsDisabled && commitRegenerate()}
                disabled={actionsDisabled}
                style={{
                  flex: 1,
                  background: T.orange,
                  color: "#fff",
                  border: "none",
                  borderRadius: T.pill,
                  padding: "10px 14px",
                  fontFamily: T.fontBody,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: actionsDisabled ? "not-allowed" : "pointer",
                  opacity: actionsDisabled ? 0.4 : 1,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { if (!actionsDisabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = actionsDisabled ? "0.4" : "1"; }}
                title={isTrialTier ? "Counts toward your free-tier regeneration limit (2 total)." : "Generates a new image and composites the new text."}
              >
                New Image + Text
              </button>
            </div>

            <button
              onClick={cancelEdit}
              disabled={busy}
              style={{
                background: "transparent",
                border: "none",
                color: "#999",
                fontFamily: T.fontBody,
                fontSize: "12px",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                padding: "4px",
                alignSelf: "center",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2AdImageCreator() {
  const [visualStyle, setVisualStyle]   = useState(VISUAL_STYLES[0].value);
  const [imageFormat, setImageFormat]   = useState(IMAGE_FORMATS[0].value);
  const [uglyMode, setUglyMode]         = useState(false);
  const [jobId, setJobId]               = useState<string | null>(null);
  const [status, setStatus]             = useState<"idle" | "generating" | "done" | "error">("idle");
  const [batchId, setBatchId]           = useState<string | null>(null);
  const [elapsed, setElapsed]           = useState(0);
  const [msgIdx, setMsgIdx]             = useState(0);
  const [regenIds, setRegenIds]         = useState<Set<number>>(new Set());
  const [regenErrors, setRegenErrors]   = useState<Map<number, string>>(new Map());
  const [errorMsg, setErrorMsg]         = useState("");
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Intervals started by handleRegenerateWithText, one per in-flight card.
  // Kept in a ref so the unmount cleanup below closes over the live Set
  // rather than a stale value from the first render.
  const regenIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: services }    = trpc.services.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: icpList }     = trpc.icps.list.useQuery(undefined, { staleTime: 30_000 });
  const { data: creditData }  = trpc.videoCredits.getBalance.useQuery(undefined, { staleTime: 10_000 });
  const { data: authData }    = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });

  const activeService = services?.[0];
  const activeIcp     = icpList?.[0];
  const credits       = creditData?.balance ?? 0;
  const isTrialTier   = !authData?.user?.subscriptionTier || authData.user.subscriptionTier === "trial";

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
  const generateAsync    = trpc.adCreatives.generateAsync.useMutation();
  const regenerateSingle = trpc.adCreatives.regenerateSingle.useMutation();
  const recompositeText  = trpc.adCreatives.recompositeText.useMutation();

  // ── Polling logic ────────────────────────────────────────────────────────────
  // Hard 180 s cap prevents an infinite spinner if the background handler dies
  // between the stuck-job reaper's sweeps or the network stays down. The
  // server-side reaper will eventually flip the row to failed; this cap just
  // stops the client from waiting past the point where the user has given up.
  const POLL_TIMEOUT_MS = 180_000;
  const startPolling = useCallback((jId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const pollStart = performance.now();
    pollRef.current = setInterval(async () => {
      try {
        if (performance.now() - pollStart > POLL_TIMEOUT_MS) {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          clearInterval(msgRef.current!);
          pollRef.current = null;
          setErrorMsg("Generation took too long — try again.");
          setStatus("error");
          return;
        }
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
  // If the user navigates away during a regenerate, the server's setImmediate
  // job keeps running and persists its result — but we must kill the client
  // intervals so we don't setState on an unmounted tree (React warning + leak).
  useEffect(() => {
    return () => {
      if (pollRef.current)  clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (msgRef.current)   clearInterval(msgRef.current);
      for (const id of regenIntervalsRef.current) clearInterval(id);
      regenIntervalsRef.current.clear();
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
        uglyMode,
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

  // ── Full regenerate (new Flux image + new/updated text) ─────────────────────
  // Async job pattern: mutation returns { jobId } immediately, we poll
  // /api/jobs/:jobId until complete/failed. The 180 s cap is a safety net on
  // top of the server-side stuck-job reaper — if the reaper hasn't run yet or
  // the network is flaky, the user still gets an actionable error instead of
  // an infinite spinner.
  async function handleRegenerateWithText(id: number, newHeadline: string) {
    setRegenIds((prev) => new Set(prev).add(id));
    // Clear any previous error for this card when the user retries.
    setRegenErrors((prev) => { const m = new Map(prev); m.delete(id); return m; });
    try {
      const { jobId } = await regenerateSingle.mutateAsync({
        id,
        headlineOverride: newHeadline,
      });
      const pollStart = performance.now();
      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            if (performance.now() - pollStart > POLL_TIMEOUT_MS) {
              clearInterval(interval);
              regenIntervalsRef.current.delete(interval);
              reject(new Error("Regeneration took too long — try again"));
              return;
            }
            const res = await fetch(`/api/jobs/${jobId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === "complete" || data.status === "failed") {
              clearInterval(interval);
              regenIntervalsRef.current.delete(interval);
              resolve();
            }
          } catch { /* keep polling */ }
        }, 5_000);
        regenIntervalsRef.current.add(interval);
      });
      await refetchBatch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Regeneration failed — try again";
      setRegenErrors((prev) => { const m = new Map(prev); m.set(id, msg); return m; });
    }
    setRegenIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  // ── Update text only (no Flux call, synchronous on the server) ──────────────
  async function handleUpdateTextOnly(id: number, newHeadline: string) {
    setRegenIds((prev) => new Set(prev).add(id));
    // Clear any previous error for this card when the user retries.
    setRegenErrors((prev) => { const m = new Map(prev); m.delete(id); return m; });
    try {
      await recompositeText.mutateAsync({ id, headline: newHeadline });
      await refetchBatch();
    } catch (err: unknown) {
      // Surface tRPC errors inline — in particular the BAD_REQUEST message from
      // assertHeadlineIsApproved, which is actionable to the user ("Headline
      // must be selected from your campaign's approved headlines.").
      const msg = err instanceof Error ? err.message : "Update failed — try again";
      setRegenErrors((prev) => { const m = new Map(prev); m.set(id, msg); return m; });
    }
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

        {/* Ugly Ad Mode toggle */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setUglyMode(p => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {/* Pill track */}
            <span style={{
              position: "relative",
              display: "inline-block",
              width: "44px",
              height: "24px",
              borderRadius: "9999px",
              background: uglyMode ? "#1A1624" : "rgba(26,22,36,0.15)",
              transition: "background 0.2s",
              flexShrink: 0,
            }}>
              {/* Knob */}
              <span style={{
                position: "absolute",
                top: "3px",
                left: uglyMode ? "23px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "9999px",
                background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                transition: "left 0.2s",
              }} />
            </span>
            {/* Label */}
            <span style={{ textAlign: "left" }}>
              <span style={{
                display: "block",
                fontFamily: T.fontBody,
                fontWeight: 700,
                fontSize: "14px",
                color: T.dark,
              }}>
                Ugly Ad Mode
              </span>
              <span style={{
                display: "block",
                fontFamily: T.fontBody,
                fontSize: "12px",
                color: "#888",
                marginTop: "1px",
              }}>
                Raw UGC style — outperforms studio ads for cold traffic
              </span>
            </span>
          </button>
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
            {uglyMode ? "Generate Ugly Ads" : "Generate Ad Images"}
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
                onRegenerateWithText={handleRegenerateWithText}
                onUpdateTextOnly={handleUpdateTextOnly}
                busy={regenIds.has(creative.id)}
                isTrialTier={isTrialTier}
                regenError={regenErrors.get(creative.id) ?? null}
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
