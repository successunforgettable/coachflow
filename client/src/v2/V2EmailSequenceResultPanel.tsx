/**
 * V2EmailSequenceResultPanel — Node 9 Results Panel
 *
 * Flat list of 7 email cards. Each card: timing badge, subject (bold),
 * body (collapsed by default with expand/collapse), Copy Subject, Copy Body,
 * thumbs-up, thumbs-down, star (UI state only), Regenerate Email (Phase L toast).
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";

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

// ─── Email card ───────────────────────────────────────────────────────────────
function EmailCard({ email, index }: { email: EmailItem; index: number }) {
  const [expanded, setExpanded]   = useState(false);
  const [copiedSubj, setCopiedSubj] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [thumbUp, setThumbUp]     = useState(false);
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]     = useState(false);

  function handleCopySubject() {
    navigator.clipboard.writeText(email.subject).catch(() => {});
    setCopiedSubj(true);
    setTimeout(() => setCopiedSubj(false), 2000);
  }
  function handleCopyBody() {
    navigator.clipboard.writeText(email.body).catch(() => {});
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
        {email.subject}
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
          {email.body}
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
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
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
        <button
          onClick={() => toast.info("Individual email regeneration coming in Phase L")}
          style={{
            background: "rgba(26,22,36,0.06)",
            border: "none",
            borderRadius: "9999px",
            padding: "6px 14px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 600,
            fontSize: "12px",
            color: "#555",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ↻ Regenerate
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function V2EmailSequenceResultPanel({
  emailSequenceId,
  onContinue,
}: {
  emailSequenceId: number;
  onContinue: () => void;
}) {
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
      {/* ── Fixed top-right Continue button ── */}
      <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 10 }}>
        <button
          onClick={onContinue}
          style={{
            background: "#8B5CF6",
            color: "#fff",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 22px",
            fontFamily: "var(--v2-font-body)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(139,92,246,0.30)",
          }}
        >
          Continue to Next Step →
        </button>
      </div>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", paddingRight: "180px" }}>
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

      {/* ── Email cards ── */}
      {emails.map((email, i) => (
        <EmailCard key={i} email={email} index={i} />
      ))}
      {emails.length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No emails found.
        </p>
      )}
    </div>
  );
}
