/**
 * V2OperatorIntake (2026-07-18) — the "finish your page" conversation.
 *
 * The token-driven, Zappy-led, one-at-a-time operator intake (the locked vision). It reads the exact
 * operator tokens THIS page baked in (server `getPublishReadiness`), asks the mapped question one at a
 * time — count stated upfront — and each answer flows through the unified core (`answerOperatorField` →
 * applyOperatorAnswer): sets the structured field AND clears the copy token. A front-loaded datetime is
 * parsed server-side so redundant questions are skipped. N/A is first-class (chips: "It's free" → __FREE__,
 * "By email" → __EMAIL_CAPTURE__, …), "Free" only where free is real (events). When nothing gates
 * publishing, it publishes and the live URL is the hero of the success state. No SQL, no script.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import ChatThread, { type ChatMessage } from "./ChatThread";

interface OperatorQuestion {
  token: string;
  key: string;
  question: string;
  category: "hard-hold" | "nudge" | "auto-fill";
  scope: "content" | "coach" | "copy-only";
  naBranches: { sentinel: string; label: string }[];
  known: boolean;
}

interface AnsweredField {
  token: string;
  key: string;
  label: string;
  current: string;
  naBranches: { sentinel: string; label: string }[];
}

const SKIP = "__SKIP__";
let seq = 0;
const mid = () => `oi-${++seq}`;
const lc1 = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export default function V2OperatorIntake({
  landingPageId,
  onPublished,
}: {
  landingPageId: number;
  onPublished?: (publicUrl: string) => void;
}) {
  const readiness = trpc.landingPages.getPublishReadiness.useQuery({ id: landingPageId });
  const answer = trpc.landingPages.answerOperatorField.useMutation();
  const reanswer = trpc.landingPages.reanswerOperatorField.useMutation();
  const publish = trpc.landingPages.publishToCloudflare.useMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState<OperatorQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [answered, setAnswered] = useState<AnsweredField[]>([]);
  const [editing, setEditing] = useState<AnsweredField | null>(null);
  const [editValue, setEditValue] = useState("");
  const started = useRef(false);

  const push = (m: Omit<ChatMessage, "id">) => setMessages((prev) => [...prev, { id: mid(), ...m }]);

  // Ask the next question (count stated in the phrasing), or publish when nothing gates it.
  const askNext = async (questions: OperatorQuestion[], remaining: number, first = false) => {
    if (questions.length === 0) {
      setCurrent(null);
      push({ type: "system-divider", text: "That's everything I need" });
      push({ type: "zappy-bubble", mood: "celebrating", text: "Perfect — putting your page live now…" });
      setBusy(true);
      try {
        const res = await publish.mutateAsync({ landingPageId });
        push({ type: "zappy-bubble", mood: "celebrating", text: "Done — your page is live! 🎉" });
        setPublishedUrl(res.publicUrl);
        onPublished?.(res.publicUrl);
      } catch (e: any) {
        push({ type: "zappy-bubble", mood: "idle", text: `Almost — something still needs a moment (${e?.message ?? "please try again"}).` });
      } finally {
        setBusy(false);
      }
      return;
    }
    const q = questions[0];
    setCurrent(q);
    const prefix = first
      ? `I need ${remaining} quick thing${remaining === 1 ? "" : "s"} to make this live — first, ${lc1(q.question)}`
      : remaining === 1
      ? `Last one — ${q.question}`
      : `${remaining} more — ${q.question}`;
    push({ type: "zappy-bubble", mood: "idle", text: prefix });
    const chips = [...q.naBranches.map((b) => b.label), ...(q.category === "nudge" ? ["Skip"] : [])];
    if (chips.length) push({ type: "chip-row", chips });
  };

  useEffect(() => {
    if (started.current || !readiness.data) return;
    started.current = true;
    const { questions, remaining, ready, publicUrl, answered: ans } = readiness.data as any;
    setAnswered(ans ?? []);
    if (ready && publicUrl) {
      setPublishedUrl(publicUrl);
      return;
    }
    void askNext(questions, remaining, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness.data]);

  // Re-answer an already-answered field (the edit flow), then re-publish so the change goes live.
  const saveEdit = async (token: string, newAnswer: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await reanswer.mutateAsync({ id: landingPageId, token, answer: newAnswer });
      setAnswered((res as any).answered ?? answered);
      const pub = await publish.mutateAsync({ landingPageId });
      setPublishedUrl(pub.publicUrl);
      onPublished?.(pub.publicUrl);
      setEditing(null);
    } catch (e: any) {
      alert(`Couldn't save that change (${e?.message ?? "please try again"}).`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (token: string, rawAnswer: string, echo: string) => {
    if (busy) return;
    setBusy(true);
    setCurrent(null);
    push({ type: "user-bubble", text: echo });
    try {
      const res = await answer.mutateAsync({ id: landingPageId, token, answer: rawAnswer });
      setAnswered((res as any).answered ?? answered);
      await askNext(res.questions as OperatorQuestion[], res.remaining);
    } catch (e: any) {
      push({ type: "zappy-bubble", mood: "idle", text: `Hmm, I couldn't save that (${e?.message ?? "try again"}). Want to try once more?` });
      if (current) void askNext([current], 1);
    } finally {
      setBusy(false);
    }
  };

  const onSendText = (text: string) => {
    if (current) void submit(current.token, text, text);
  };
  const onChipTap = (_id: string, chip: string) => {
    if (!current) return;
    if (chip === "Skip") return void submit(current.token, SKIP, "Skip for now");
    const branch = current.naBranches.find((b) => b.label === chip);
    if (branch) void submit(current.token, branch.sentinel, chip);
  };

  // Success hero — the live URL is the triumph; lead with it, copy + view prominent.
  if (publishedUrl) {
    return (
      <div style={{ padding: 28, textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
        <div style={{ fontFamily: "var(--v2-font-heading, 'Fraunces', serif)", fontWeight: 900, fontSize: 26, color: "var(--v2-text-color, #1A1A1A)", marginBottom: 16 }}>
          Your page is live
        </div>
        <a
          href={publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)", fontSize: 18, fontWeight: 600, color: "var(--v2-primary-btn, #FF5B1D)", wordBreak: "break-all", padding: "14px 18px", border: "2px solid var(--v2-primary-btn, #FF5B1D)", borderRadius: 14, marginBottom: 18, textDecoration: "none" }}
        >
          {publishedUrl}
        </a>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(publishedUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
            style={{ padding: "12px 28px", borderRadius: 9999, border: "1.5px solid #CBD5E1", background: "#fff", fontFamily: "var(--v2-font-body, sans-serif)", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "12px 28px", borderRadius: 9999, background: "var(--v2-primary-btn, #FF5B1D)", color: "#fff", fontFamily: "var(--v2-font-body, sans-serif)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            View your page →
          </a>
        </div>

        {/* Edit flow — the coach can re-open any answered detail (typo, changed date, wrong answer). */}
        {answered.length > 0 && (
          <div style={{ marginTop: 28, textAlign: "left", borderTop: "1px solid #E2E8F0", paddingTop: 18 }}>
            <div style={{ fontFamily: "var(--v2-font-body, sans-serif)", fontWeight: 700, fontSize: 13, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
              Your details — edit any
            </div>
            {answered.map((f) => (
              <div key={f.token} style={{ padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                {editing?.token === f.token ? (
                  <div>
                    <div style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>{f.label}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && editValue.trim() && !busy) void saveEdit(f.token, editValue.trim()); }}
                        placeholder={`New ${f.label.toLowerCase()}…`}
                        style={{ flex: "1 1 180px", padding: "9px 12px", border: "1px solid #CBD5E1", borderRadius: 8, fontFamily: "var(--v2-font-body, sans-serif)", fontSize: 14 }}
                      />
                      <button type="button" disabled={busy || !editValue.trim()} onClick={() => void saveEdit(f.token, editValue.trim())} style={{ padding: "9px 18px", borderRadius: 9999, background: "var(--v2-primary-btn, #FF5B1D)", color: "#fff", border: 0, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: busy || !editValue.trim() ? 0.5 : 1 }}>Save</button>
                      <button type="button" onClick={() => setEditing(null)} style={{ padding: "9px 14px", borderRadius: 9999, background: "transparent", color: "#64748B", border: "1px solid #CBD5E1", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    </div>
                    {f.naBranches.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {f.naBranches.map((b) => (
                          <button key={b.sentinel} type="button" disabled={busy} onClick={() => void saveEdit(f.token, b.sentinel)} style={{ padding: "7px 14px", borderRadius: 9999, background: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{b.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: "#64748B" }}>{f.label}: </span>
                      <span style={{ fontFamily: "var(--v2-font-body, sans-serif)", fontSize: 14, fontWeight: 600, color: "#1A1A1A", wordBreak: "break-word" }}>{f.current}</span>
                    </div>
                    <button type="button" onClick={() => { setEditing(f); setEditValue(""); }} style={{ padding: "6px 14px", borderRadius: 9999, background: "transparent", color: "var(--v2-primary-btn, #FF5B1D)", border: "1px solid var(--v2-primary-btn, #FF5B1D)", fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <ChatThread
      messages={messages}
      onChipTap={onChipTap}
      onSendText={current ? onSendText : undefined}
      inputPlaceholder={current ? "Type your answer…" : "…"}
      inputDisabled={busy || !current}
    />
  );
}
