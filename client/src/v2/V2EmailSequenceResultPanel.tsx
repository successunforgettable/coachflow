/**
 * V2EmailSequenceResultPanel — Node 9 Results Panel
 *
 * Flat list of email cards. Each card: timing badge, subject (bold),
 * body (collapsed by default with expand/collapse), Copy Subject, Copy Body,
 * thumbs-up, thumbs-down, star (UI state only), per-item Regenerate via AI.
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import ZappyMascot from "./ZappyMascot";
import UpgradePrompt from "./components/UpgradePrompt";
import { useFavourites } from "./hooks/useFavourites";
import ExportButtons from "./components/ExportButtons";
import PlaceholderBanner from "./components/PlaceholderBanner";
import { formatEmailsTxt } from "./lib/exportUtils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailItem {
  day: number;
  subject: string;
  body: string;
  timing: string;
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
function EmailRegenPanel({
  sequenceId,
  index,
  onSuccess,
  onClose,
}: {
  sequenceId: number;
  index: number;
  onSuccess: (subject: string, body: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regenMutation = trpc.emailSequences.regenerateSingle.useMutation();

  async function handleRegen() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenMutation.mutateAsync({
        id: sequenceId,
        index,
        promptOverride: prompt.trim() || undefined,
      });
      onSuccess(result.subject, result.body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "10px", padding: "12px", background: "rgba(139,92,246,0.04)", borderRadius: "12px", border: "1px solid rgba(139,92,246,0.15)" }}>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Optional: describe what to change..."
        style={{
          width: "100%",
          minHeight: "56px",
          fontFamily: "var(--v2-font-body)",
          fontSize: "13px",
          color: "#1A1624",
          lineHeight: 1.5,
          border: "1px solid rgba(139,92,246,0.30)",
          borderRadius: "8px",
          padding: "8px 10px",
          resize: "vertical",
          outline: "none",
          background: "#FFFFFF",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
        <button
          onClick={handleRegen}
          disabled={loading}
          style={{
            background: loading ? "#ccc" : "#FF5B1D",
            color: "#fff",
            border: "none",
            borderRadius: "9999px",
            padding: "7px 18px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "12px",
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.01em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {loading ? (
            <><span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Regenerating...</>
          ) : (
            "Regenerate"
          )}
        </button>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--v2-font-body)",
            fontSize: "12px",
            color: "#888",
            cursor: "pointer",
            padding: "7px 10px",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "12px", color: "#DC2626", margin: "6px 0 0" }}>{error}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Email card ───────────────────────────────────────────────────────────────
function EmailCard({ email, index, sequenceId, isFreeTier, onUpgradeClick, isFav, onToggleFav }: { email: EmailItem; index: number; sequenceId: number; isFreeTier?: boolean; onUpgradeClick?: () => void; isFav?: boolean; onToggleFav?: () => void }) {
  const [subject, setSubject]   = useState(email.subject);
  const [body, setBody]         = useState(email.body);
  const [expanded, setExpanded]   = useState(false);
  const [copiedSubj, setCopiedSubj] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const thumbUp = !!isFav;
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]     = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  function handleCopySubject() {
    navigator.clipboard.writeText(subject).catch(() => {});
    setCopiedSubj(true);
    setTimeout(() => setCopiedSubj(false), 2000);
  }
  function handleCopyBody() {
    navigator.clipboard.writeText(body).catch(() => {});
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(26,22,36,0.10)",
      borderRadius: "16px",
      padding: "18px 20px",
      marginBottom: "12px",
    }}>
      {/* Top row: label + timing badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "11px",
          fontWeight: 700,
          color: "#FF5B1D",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          Email {index + 1}
        </span>
        {email.timing && (
          <span style={{
            background: "rgba(139,92,246,0.10)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: "9999px",
            padding: "2px 10px",
            fontFamily: "var(--v2-font-body)",
            fontSize: "11px",
            fontWeight: 600,
            color: "#6D28D9",
          }}>
            {email.timing}
          </span>
        )}
      </div>

      {/* Subject */}
      <p style={{
        fontFamily: "var(--v2-font-heading)",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "16px",
        color: "#1A1624",
        margin: "0 0 10px",
        lineHeight: 1.35,
      }}>
        {subject}
      </p>

      {/* Body (collapsed by default) */}
      {expanded && (
        <p style={{
          fontFamily: "var(--v2-font-body)",
          fontSize: "14px",
          color: "#333",
          lineHeight: 1.7,
          margin: "0 0 12px",
          whiteSpace: "pre-wrap",
          borderTop: "1px solid rgba(26,22,36,0.08)",
          paddingTop: "12px",
        }}>
          {body}
        </p>
      )}

      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          background: "none",
          border: "none",
          fontFamily: "var(--v2-font-body)",
          fontSize: "12px",
          fontWeight: 600,
          color: "#8B5CF6",
          cursor: "pointer",
          padding: "0",
          marginBottom: "12px",
          letterSpacing: "0.01em",
        }}
      >
        {expanded ? "▲ Collapse body" : "▼ Expand body"}
      </button>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Copy Subject */}
        <button
          onClick={handleCopySubject}
          style={{
            background: copiedSubj ? "rgba(88,204,2,0.12)" : "rgba(26,22,36,0.06)",
            border: copiedSubj ? "1px solid rgba(88,204,2,0.40)" : "1px solid rgba(26,22,36,0.12)",
            borderRadius: "9999px",
            padding: "6px 14px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 600,
            fontSize: "12px",
            color: copiedSubj ? "#2E7D00" : "#444",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {copiedSubj ? "✓ Copied" : "Copy Subject"}
        </button>
        {/* Copy Body */}
        <button
          onClick={handleCopyBody}
          style={{
            background: copiedBody ? "rgba(88,204,2,0.12)" : "rgba(26,22,36,0.06)",
            border: copiedBody ? "1px solid rgba(88,204,2,0.40)" : "1px solid rgba(26,22,36,0.12)",
            borderRadius: "9999px",
            padding: "6px 14px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 600,
            fontSize: "12px",
            color: copiedBody ? "#2E7D00" : "#444",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {copiedBody ? "✓ Copied" : "Copy Body"}
        </button>
        {/* Thumbs Up */}
        <button
          onClick={() => { onToggleFav?.(); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(255,91,29,0.12)" : undefined, borderColor: thumbUp ? "rgba(255,91,29,0.40)" : undefined }}
          title="Thumbs up"
        >
          👍
        </button>
        {/* Thumbs Down */}
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >
          👎
        </button>
        {/* Star */}
        <button
          onClick={() => setStarred(p => !p)}
          style={{ ...iconBtn, background: starred ? "rgba(255,165,0,0.12)" : undefined, borderColor: starred ? "rgba(255,165,0,0.45)" : undefined, color: starred ? "#D97706" : undefined }}
          title="Star"
        >
          {starred ? "★" : "☆"}
        </button>
        {/* Regenerate */}
        {isFreeTier ? (
          <button
            onClick={() => onUpgradeClick?.()}
            style={{ ...iconBtn, opacity: 0.4, cursor: "not-allowed" }}
            title="Upgrade to Pro to regenerate"
          >
            ↺
          </button>
        ) : (
          <button
            onClick={() => setRegenOpen(p => !p)}
            style={{ ...iconBtn, background: regenOpen ? "rgba(255,91,29,0.10)" : undefined, borderColor: regenOpen ? "rgba(255,91,29,0.40)" : undefined }}
            title="Regenerate"
          >
            ↺
          </button>
        )}
      </div>
      {regenOpen && !isFreeTier && (
        <EmailRegenPanel
          sequenceId={sequenceId}
          index={index}
          onSuccess={(newSubj, newBody) => { setSubject(newSubj); setBody(newBody); setRegenOpen(false); }}
          onClose={() => setRegenOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2EmailSequenceResultPanel({
  emailSequenceId,
  isFreeTier,
}: {
  emailSequenceId: number;
  isFreeTier?: boolean;
}) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isFavourited, toggle: toggleFav } = useFavourites("emailSequence");
  const { data, isLoading, isError } = trpc.emailSequences.get.useQuery(
    { id: emailSequenceId },
    { enabled: !!emailSequenceId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your Email Sequence…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load email sequence. Try refreshing.
      </div>
    );
  }

  const seq = data as { name?: string; emails?: EmailItem[] | string };
  let emails: EmailItem[] = [];
  try {
    emails = typeof seq.emails === "string" ? JSON.parse(seq.emails) : (seq.emails ?? []);
  } catch {
    emails = [];
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
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
            Your Email Sequence
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {seq.name || "Email Sequence"} — {emails.length} emails
          </p>
        </div>
      </div>

      {/* ── Operator placeholders banner — surfaces [INSERT_*] tokens across all emails ── */}
      <PlaceholderBanner data={emails} />

      {/* ── Email cards ── */}
      {emails.map((email, i) => (
        <EmailCard key={i} email={email} index={i} sequenceId={emailSequenceId} isFreeTier={isFreeTier} onUpgradeClick={() => setShowUpgradeModal(true)} isFav={isFavourited(i)} onToggleFav={() => toggleFav(i, email.subject)} />
      ))}
      {emails.length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No emails found.
        </p>
      )}
      {showUpgradeModal && <UpgradePrompt variant="modal" featureName="Per-Item Regeneration" onClose={() => setShowUpgradeModal(false)} />}
      <ExportButtons content={formatEmailsTxt(data)} serviceName={(data as any)?.name || "Email Sequence"} nodeName="Email_Sequence" showPdf={true} isFreeTier={isFreeTier} />
    </div>
  );
}
