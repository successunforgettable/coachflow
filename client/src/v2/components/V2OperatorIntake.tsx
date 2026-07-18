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
  const publish = trpc.landingPages.publishToCloudflare.useMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState<OperatorQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    const { questions, remaining, ready, publicUrl } = readiness.data as any;
    if (ready && publicUrl) {
      setPublishedUrl(publicUrl);
      return;
    }
    void askNext(questions, remaining, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness.data]);

  const submit = async (token: string, rawAnswer: string, echo: string) => {
    if (busy) return;
    setBusy(true);
    setCurrent(null);
    push({ type: "user-bubble", text: echo });
    try {
      const res = await answer.mutateAsync({ id: landingPageId, token, answer: rawAnswer });
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
