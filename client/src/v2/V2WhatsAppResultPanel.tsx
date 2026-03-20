/**
 * V2WhatsAppResultPanel — Node 10 Results Panel
 *
 * Flat list of 7 WhatsApp message cards.
 * Each card: timing badge, message text, emojis inline, copy, thumbs-up,
 * thumbs-down, star (UI state only), Regenerate Message (Phase L toast).
 * Uses msg.text per confirmed live DB field name (not msg.message).
 */
import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import ZappyMascot from "./ZappyMascot";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppMessage {
  delay?: number;
  delayUnit?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  text?: string;
  // legacy field name — some older records may use 'message'
  message?: string;
  timing?: string;
  emojis?: string[];
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

// ─── Message card ─────────────────────────────────────────────────────────────
function MessageCard({ msg, index }: { msg: WhatsAppMessage; index: number }) {
  const [copied, setCopied]       = useState(false);
  const [thumbUp, setThumbUp]     = useState(false);
  const [thumbDown, setThumbDown] = useState(false);
  const [starred, setStarred]     = useState(false);

  const emojis = Array.isArray(msg.emojis) ? msg.emojis : [];
  // DB stores field as 'text'; older records may use 'message'
  const messageText = msg.text ?? msg.message ?? "";
  const fullText = `${messageText}${emojis.length ? " " + emojis.join(" ") : ""}`;

  function handleCopy() {
    navigator.clipboard.writeText(fullText).catch(() => {});
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
          Message {index + 1}
        </span>
        {msg.timing && (
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
            {msg.timing}
          </span>
        )}
      </div>

      {/* Message text + emojis */}
      <p style={{
        fontFamily: "var(--v2-font-body)",
        fontSize: "14px",
        color: "#1A1624",
        lineHeight: 1.7,
        margin: "0 0 12px",
        whiteSpace: "pre-wrap",
      }}>
        {messageText}
        {emojis.length > 0 && (
          <span style={{ marginLeft: "6px", fontSize: "16px" }}>
            {emojis.join(" ")}
          </span>
        )}
      </p>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={handleCopy}
          style={{ ...iconBtn, background: copied ? "rgba(88,204,2,0.12)" : undefined, borderColor: copied ? "rgba(88,204,2,0.40)" : undefined }}
          title="Copy"
        >
          {copied ? "✓" : "⎘"}
        </button>
        <button
          onClick={() => { setThumbUp(p => !p); if (!thumbUp) setThumbDown(false); }}
          style={{ ...iconBtn, background: thumbUp ? "rgba(88,204,2,0.12)" : undefined, borderColor: thumbUp ? "rgba(88,204,2,0.40)" : undefined }}
          title="Thumbs up"
        >
          👍
        </button>
        <button
          onClick={() => { setThumbDown(p => !p); if (!thumbDown) setThumbUp(false); }}
          style={{ ...iconBtn, background: thumbDown ? "rgba(220,38,38,0.10)" : undefined, borderColor: thumbDown ? "rgba(220,38,38,0.35)" : undefined }}
          title="Thumbs down"
        >
          👎
        </button>
        <button
          onClick={() => setStarred(p => !p)}
          style={{ ...iconBtn, background: starred ? "rgba(255,165,0,0.12)" : undefined, borderColor: starred ? "rgba(255,165,0,0.45)" : undefined, color: starred ? "#D97706" : undefined }}
          title="Star"
        >
          {starred ? "★" : "☆"}
        </button>
        <button
          onClick={() => toast.info("Individual message regeneration coming in Phase L")}
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
export default function V2WhatsAppResultPanel({
  whatsappSequenceId,
}: {
  whatsappSequenceId: number;
}) {
  const { data, isLoading, isError } = trpc.whatsappSequences.get.useQuery(
    { id: whatsappSequenceId },
    { enabled: !!whatsappSequenceId, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#888" }}>
        Loading your WhatsApp Sequence…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "var(--v2-font-body)", color: "#C0390A" }}>
        Could not load WhatsApp sequence. Try refreshing.
      </div>
    );
  }

  const seq = data as { name?: string; messages?: WhatsAppMessage[] | string };
  let messages: WhatsAppMessage[] = [];
  try {
    messages = typeof seq.messages === "string" ? JSON.parse(seq.messages) : (seq.messages ?? []);
  } catch {
    messages = [];
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
            Your WhatsApp Sequence
          </h2>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "13px",
            color: "#777",
            margin: "3px 0 0",
          }}>
            {seq.name || "WhatsApp Sequence"} — {messages.length} messages
          </p>
        </div>
      </div>

      {/* ── Message cards ── */}
      {messages.map((msg, i) => (
        <MessageCard key={i} msg={msg} index={i} />
      ))}
      {messages.length === 0 && (
        <p style={{ fontFamily: "var(--v2-font-body)", fontSize: "14px", color: "#999", textAlign: "center", padding: "24px 0" }}>
          No messages found.
        </p>
      )}
    </div>
  );
}
