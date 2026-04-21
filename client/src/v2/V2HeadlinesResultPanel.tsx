/**
 * V2HeadlinesResultPanel — Node 6 Results Panel
 *
 * Displays the generated headline set in a 5-tab layout (Story, Eyebrow,
 * Question, Authority, Urgency). Each card has copy, thumbs-up, thumbs-down,
 * and star controls (all UI-state only). Compliance badge reads complianceScore
 * from the DB row.
 *
 * Props:
 *   headlineSetId — nanoid from the job result
 *   serviceId     — numeric service ID (for getLatestByServiceId fallback)
 */
import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";
import ComplianceWarningPanel from "./ComplianceWarningPanel";
import { useFavourites } from "./hooks/useFavourites";
import ExportButtons from "./components/ExportButtons";
import { formatWhatsAppTxt, formatHeadlinesTxt, formatAdCopyTxt, formatOfferTxt, formatMechanismsTxt, formatHvcoTxt, formatIcpTxt, formatLandingPageTxt } from "./lib/exportUtils";

// ─── Types ────────────────────────────────────────────────────────────────────
type FormulaTab = "story" | "eyebrow" | "question" | "authority" | "urgency";

interface HeadlineRow {
  id: number;
  formulaType: string;
  headline: string;
  subheadline: string | null;
  eyebrow: string | null;
  complianceScore: number | null;
  selectionScore?: string | null;
  rating: number;
  // W5 Phase 1 R2 — plain-English violation reasons shipped by the server
  // (normalised from the JSON column to a real string[] | null).
  violationReasons?: string[] | null;
}

// ─── Compliance badge ─────────────────────────────────────────────────────────
function ComplianceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const isGreen = score >= 90;
  const isAmber = score >= 70 && score < 90;
  const bg    = isGreen ? "rgba(88,204,2,0.12)"  : isAmber ? "rgba(255,165,0,0.12)"  : "rgba(220,38,38,0.12)";
  const border = isGreen ? "rgba(88,204,2,0.40)"  : isAmber ? "rgba(255,165,0,0.40)"  : "rgba(220,38,38,0.40)";
  const color  = isGreen ? "#2E7D00"              : isAmber ? "#92400E"               : "#991B1B";
  const label  = isGreen ? "Meta Compliant"       : isAmber ? "Review"                : "Flagged";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "9999px",
      padding: "3px 10px",
      fontSize: "11px",
      fontFamily: "var(--v2-font-body)",
      fontWeight: 600,
      color,
      letterSpacing: "0.02em",
      marginTop: "6px",
    }}>
      <span style={{ fontSize: "10px" }}>{isGreen ? "✓" : isAmber ? "⚠" : "✗"}</span>
      {score}/100 — {label}
    </span>
  );
}

// ─── Score badge (W3 — hookRate) ──────────────────────────────────────────────
function ScoreBadge({ score }: { score?: string | null }) {
  if (score === null || score === undefined) return null;
  const n = parseFloat(score);
  if (isNaN(n)) return null;
  const isTop  = n >= 80;
  const isGood = n >= 60;
  const bg     = isTop  ? "rgba(139,92,246,0.12)" : isGood ? "rgba(88,204,2,0.12)"  : "rgba(26,22,36,0.06)";
  const border = isTop  ? "rgba(139,92,246,0.40)" : isGood ? "rgba(88,204,2,0.40)"  : "rgba(26,22,36,0.15)";
  const color  = isTop  ? "#5B21B6"               : isGood ? "#2E7D00"              : "#666";
  const label  = isTop  ? "⚡ Top Pick"            : isGood ? "✓ Strong"             : "~ Test";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "9999px",
      padding: "3px 10px",
      fontSize: "11px",
      fontFamily: "var(--v2-font-body)",
      fontWeight: 600,
      color,
      letterSpacing: "0.02em",
      marginTop: "6px",
    }}>
      {label}
    </span>
  );
}

// ─── Shared icon-button style ─────────────────────────────────────────────────
const iconBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(26,22,36,0.12)",
  borderRadius: "9999px",
  width: "34px",
  height: "34px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: "15px",
  flexShrink: 0,
  transition: "background 0.15s",
};

// ─── Inline regen panel ──────────────────────────────────────────────────────
function HeadlineRegenPanel({
  itemId,
  onSuccess,
  onClose,
}: {
  itemId: number;
  onSuccess: (headline: string, subheadline: string | null) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.headlines.regenerateSingle.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({ id: itemId, promptOverride: prompt.trim() || undefined });
      onSuccess(result.headline, result.subheadline ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "10px", padding: "12px", background: "rgba(139,92,246,0.04)", borderRadius: "12px", border: "1px solid rgba(139,92,246,0.15)" }}>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Optional: describe what to change..."
        style={{ width: "100%", minHeight: "56px", fontFamily: "var(--v2-font-body)", fontSize: "13px", color: "#1A1624", lineHeight: 1.5, border: "1px solid rgba(139,92,246,0.30)", borderRadius: "8px", padding: "8px 10px", resize: "vertical", outline: "none", background: "#FFFFFF", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
        <button onClick={handleRegen} disabled={loading}
          style={{ background: loading ? "#ccc" : "#FF5B1D", color: "#fff", border: "none", borderRadius: "9999px", padding: "7px 18px", fontFamily: "var(--v2-font-body)", fontWeight: 700, fontSize: "12px", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: "6px" }}>
          {loading ? (<><span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Regenerating...</>) : "Regenerate"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "none", fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#888", cursor: "pointer", padding: "7px 10px" }}>Cancel</button>
      </div>
      {error && <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#DC2626", margin: "6px 0 0" }}>{error}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Per-headline card ────────────────────────────────────────────────────────
type CardRewrite = {
  id: number;
  rewrittenText: string;
  complianceScore: number;
  violationReasons: unknown;
  userAccepted: boolean;
  userDismissed: boolean;
};

function HeadlineCard({ headline, isFreeTier, index, isFav, onToggleFav, complianceRewritesEnabled, rewritesForCard, onRewritesChanged }: { headline: HeadlineRow; isFreeTier?: boolean; index: number; isFav: boolean; onToggleFav: () => void; complianceRewritesEnabled: boolean; rewritesForCard: CardRewrite[]; onRewritesChanged: () => void }) {
  const copyLocked = isFreeTier && index >= 10;
  const [headlineText, setHeadlineText] = useState(headline.headline);
  const [subheadlineText, setSubheadlineText] = useState(headline.subheadline);
  const [copied, setCopied]     = useState(false);
  const thumbUp = isFav;
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]   = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  function handleCopy() {
    const text = [headline.eyebrow, headlineText, subheadlineText]
      .filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "18px 20px",
      marginBottom: "12px",
    }}>
      {/* Eyebrow */}
      {headline.eyebrow && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "11px",
          fontWeight: 700,
          color: "#FF5B1D",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 0 6px",
        }}>
          {headline.eyebrow}
        </p>
      )}
      {/* Main headline */}
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "18px",
        color: "#1A1624",
        margin: "0 0 4px",
        lineHeight: 1.35,
      }}>
        {headlineText}
      </p>
      <p style={{ fontFamily: "'Instrument Sans', 'Inter', system-ui, sans-serif", fontSize: 11, color: "#bbb", margin: "4px 0 0" }}>
        {headlineText?.length ?? 0} chars
      </p>
      {/* Subheadline */}
      {subheadlineText && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "13px",
          color: "#555",
          margin: "0 0 8px",
          lineHeight: 1.5,
        }}>
          {subheadlineText}
        </p>
      )}
      {/* Compliance + score badges */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <ComplianceBadge score={headline.complianceScore} />
        <ScoreBadge score={headline.selectionScore} />
      </div>
      {/* W5 Phase 1 — active compliance rewrite panel drives three states
          based on the batched rewrites query:
            - Any accepted rewrite → don't render (score is already
              compliant too, so this is belt-and-braces).
            - Any dismissed rewrite (and none accepted) → amber
              "Warning dismissed" collapsed badge, read-only on expand.
            - Otherwise → red "click to fix" badge as today.
          Gated on the feature flag AND complianceScore < 70. */}
      {(() => {
        if (!complianceRewritesEnabled) return null;
        if (headline.complianceScore === null || headline.complianceScore >= 70) return null;
        const anyAccepted  = rewritesForCard.some(r => r.userAccepted);
        if (anyAccepted) return null;
        const anyDismissed = rewritesForCard.some(r => r.userDismissed);
        const liveRewrites = rewritesForCard.filter(r => !r.userAccepted && !r.userDismissed);
        return (
          <ComplianceWarningPanel
            sourceTable="headlines"
            sourceId={headline.id}
            originalText={headlineText}
            violations={headline.violationReasons ?? []}
            initialMode={anyDismissed ? "dismissed" : "active"}
            liveRewrites={liveRewrites}
            dismissedRewrites={rewritesForCard.filter(r => r.userDismissed)}
            onAccept={(newText) => { setHeadlineText(newText); onRewritesChanged(); }}
            onDismiss={() => { onRewritesChanged(); }}
            onGeneratedMore={onRewritesChanged}
          />
        );
      })()}
      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }}>
        {copyLocked ? (
          <button onClick={() => setUpgradeFeature("Full Copy Access")} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro for full copy access">🔒</button>
        ) : (
          <button onClick={handleCopy} style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }} title="Copy to clipboard">{copied ? "✓" : "⎘"}</button>
        )}
        <button onClick={() => { onToggleFav(); if (!thumbUp) setThumbDown(false); }} style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }} title="Thumbs up">👍</button>
        <button onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }} style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }} title="Thumbs down">👎</button>
        <button onClick={() => setStarred(p => !p)} style={{ ...iconBtn, background: starred ? "rgba(255,165,0,0.12)" : undefined, borderColor: starred ? "rgba(255,165,0,0.45)" : undefined, color: starred ? "#D97706" : undefined }} title="Star">{starred ? "★" : "☆"}</button>
        {isFreeTier ? (
          <button onClick={() => setUpgradeFeature("Per-Item Regeneration")} style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }} title="Upgrade to Pro to regenerate">↺</button>
        ) : (
          <button onClick={() => setRegenOpen(p => !p)} style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }} title="Regenerate">↺</button>
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <HeadlineRegenPanel
          itemId={headline.id}
          onSuccess={(h, s) => { setHeadlineText(h); setSubheadlineText(s); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
      {upgradeFeature && <UpgradePrompt variant="modal" featureName={upgradeFeature} onClose={() => setUpgradeFeature(null)} />}
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#1A1624" : "rgba(26,22,36,0.06)",
        color: active ? "#F5F1EA" : "#1A1624",
        border: "none",
        borderRadius: "9999px",
        padding: "7px 16px",
        fontFamily: "var(--v2-font-body)",
        fontWeight: 600,
        fontSize: "13px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s, color 0.15s",
        letterSpacing: "0.01em",
      }}
    >
      {label} <span style={{ opacity: 0.65, fontSize: "11px" }}>({count})</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2HeadlinesResultPanel({
  headlineSetId,
  serviceId: _serviceId,
  isFreeTier,
}: {
  headlineSetId: string;
  serviceId: number;
  isFreeTier?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<FormulaTab>("story");
  const [searchQuery, setSearchQuery] = useState("");
  const { isFavourited, toggle: toggleFav } = useFavourites("headlines");

  const { data, isLoading, isError } = trpc.headlines.getBySetId.useQuery(
    { headlineSetId },
    { enabled: !!headlineSetId, staleTime: 60_000 }
  );

  // W5 Phase 1 — ENABLE_COMPLIANCE_REWRITES flag probe. Cached forever on
  // the client (the flag only changes at server restart). Used to decide
  // whether flagged headline cards render ComplianceWarningPanel or the
  // legacy passive badge.
  const { data: rewriteFlag } = trpc.complianceRewrites.isEnabled.useQuery(
    undefined,
    { staleTime: Infinity },
  );
  const complianceRewritesEnabled = rewriteFlag?.enabled === true;

  // Batched rewrites-for-set query. Fires once on mount (not per card) when
  // the flag is on. Child cards read their own rewrite list out of the map.
  // staleTime: 5 min because rewrites only change via user action; the
  // explicit refetchRewrites() after accept/dismiss/undismiss/generateMore
  // is the authoritative refresh path. refetchOnWindowFocus disabled for
  // the same reason — tab re-focus shouldn't thrash this endpoint.
  const { data: allRewrites = [], refetch: refetchRewrites } = trpc.complianceRewrites.listForHeadlineSet.useQuery(
    { headlineSetId },
    {
      enabled: complianceRewritesEnabled && !!headlineSetId,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  );
  const rewritesByHeadlineId = useMemo(() => {
    const map = new Map<number, typeof allRewrites>();
    for (const r of allRewrites) {
      const list = map.get(r.sourceId) ?? [];
      list.push(r);
      map.set(r.sourceId, list);
    }
    return map;
  }, [allRewrites]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your headlines…
      </div>
    );
  }

  // ── Error ──
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load headlines. Try refreshing.
      </div>
    );
  }

  const TABS: { key: FormulaTab; label: string }[] = [
    { key: "story",     label: "Story" },
    { key: "eyebrow",   label: "Eyebrow" },
    { key: "question",  label: "Question" },
    { key: "authority", label: "Authority" },
    { key: "urgency",   label: "Urgency" },
  ];

  const activeHeadlines: HeadlineRow[] = (data.headlines[activeTab] ?? []) as HeadlineRow[];
  const sortedHeadlines = [...activeHeadlines].sort(
    (a, b) => parseFloat(b.selectionScore ?? '0') - parseFloat(a.selectionScore ?? '0'),
  );
  const filteredHeadlines = searchQuery
    ? sortedHeadlines.filter(h => {
        const q = searchQuery.toLowerCase();
        return (
          h.headline.toLowerCase().includes(q) ||
          (h.subheadline && h.subheadline.toLowerCase().includes(q)) ||
          (h.eyebrow && h.eyebrow.toLowerCase().includes(q))
        );
      })
    : sortedHeadlines;

  return (
    <div style={{
      background: "#F5F1EA",
      borderRadius: "24px",
      border: "1px solid rgba(26,22,36,0.10)",
      padding: "28px 24px",
      marginTop: "24px",
      position: "relative",
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <ZappyMascot state="cheering" size={56} />
        <div>
          <h2 style={{
            fontFamily: "var(--v2-font-heading)",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "22px",
            color: "#1A1624",
            margin: 0,
          }}>
            Your Headlines
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {TABS.reduce((sum, t) => sum + (data.headlines[t.key]?.length ?? 0), 0)} headlines across 5 formulas
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "20px",
        overflowX: "auto",
        paddingBottom: "4px",
      }}>
        {TABS.map(t => (
          <TabPill
            key={t.key}
            label={t.label}
            count={data.headlines[t.key]?.length ?? 0}
            active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
          />
        ))}
      </div>

      {/* ── Search ── */}
      <input
        type="text"
        placeholder="Search headlines..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          width: "100%",
          fontFamily: "var(--v2-font-body)",
          fontSize: "14px",
          color: "var(--v2-text-color)",
          background: "#fff",
          border: "1px solid rgba(26,22,36,0.12)",
          borderRadius: "12px",
          padding: "10px 14px",
          outline: "none",
          marginBottom: "16px",
          boxSizing: "border-box" as const,
        }}
      />

      {/* ── Tab content ── */}
      <div>
        {filteredHeadlines.length === 0 ? (
          <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#888", textAlign: "center", padding: "24px 0" }}>
            No {activeTab} headlines in this set.
          </p>
        ) : (
          filteredHeadlines.map((h, i) => <HeadlineCard key={h.id} headline={h} isFreeTier={isFreeTier} index={i} isFav={isFavourited(h.id)} onToggleFav={() => toggleFav(h.id, h.headline)} complianceRewritesEnabled={complianceRewritesEnabled} rewritesForCard={rewritesByHeadlineId.get(h.id) ?? []} onRewritesChanged={refetchRewrites} />)
        )}
      </div>
      <ExportButtons content={formatHeadlinesTxt(data)} serviceName="Headlines" nodeName="Headlines" showPdf={true} isFreeTier={isFreeTier} />
    </div>
  );
}
