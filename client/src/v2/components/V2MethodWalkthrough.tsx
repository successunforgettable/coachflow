/**
 * V2MethodWalkthrough — "tell me how you actually work" as a conversation.
 *
 * Modelled on V2OperatorIntake (the Node-11 push flow): Zappy asks one thing at a time, the answer
 * echoes back as a user bubble, and the SERVER decides what comes next. The coach is never shown a
 * form and is never asked to describe their "unique mechanism" — they narrate one real client,
 * which anyone can do, and the server-side extractor does the abstracting.
 *
 * 🔑 THIS FILE HARDCODES NO QUESTION TEXT. Every line Zappy says arrives as `text` from
 * `methods.walkthroughTurn`, and every chip label arrives as `chips`. `METHOD_WALKTHROUGH` in
 * `server/_core/mechanismStandard.ts` is the only place the script exists.
 *
 * TWO RENDERINGS, ONE STATE MACHINE. `useMethodWalkthrough` is the machine; the default export is
 * a thin standalone wrapper that owns a ChatThread (parity with V2OperatorIntake). V2Trail uses the
 * HOOK instead and pushes into its own thread, so the trail keeps one continuous conversation
 * rather than swapping to a second one. Two copies of the loop would drift; this way there is one.
 */
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import ChatThread, { type ChatMessage } from "./ChatThread";

type Role = "zappy" | "coach";
export interface WalkthroughTurn { role: Role; text: string }

/** Mirrors the server's WalkthroughNext union. */
type Next = "opener" | "probe" | "differentiator" | "reflect" | "insufficient";

export interface WalkthroughEmit {
  /** Zappy says something. */
  zappy: (text: string, mood: "idle" | "thinking" | "celebrating") => void;
  /** The coach's answer echoes back. */
  user: (text: string) => void;
  /** Chip row. */
  chips: (chips: string[]) => void;
  /** A beat marker. */
  divider: (text: string) => void;
}

export interface UseMethodWalkthroughOptions {
  serviceId: number;
  emit: WalkthroughEmit;
  /** Fired once the method is saved — the caller regenerates the mechanism in place. */
  onSaved: () => void | Promise<void>;
  /** Fired when the conversation ends without a usable method, or the coach backs out. */
  onEnded?: (reason: "insufficient" | "dismissed") => void;
}

/** How many "Not quite" rounds before we stop re-reflecting and just work with what we have. */
const CORRECTION_LIMIT = 2;

export function useMethodWalkthrough({ serviceId, emit, onSaved, onEnded }: UseMethodWalkthroughOptions) {
  const turnMutation = trpc.methods.walkthroughTurn.useMutation();
  const saveMutation = trpc.methods.saveMethod.useMutation();

  const turns = useRef<WalkthroughTurn[]>([]);
  const corrections = useRef(0);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  /** True while the reflect-back chips are up — a chip means confirm/correct, not an answer. */
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const chipLabels = useRef<{ confirm?: string; correct?: string; skip?: string }>({});

  /** Render one server step. Zappy's own line is recorded as a turn so the server can read the transcript. */
  const render = useCallback((res: { next: Next; text?: string; chips?: string[] }) => {
    if (res.text) {
      emit.zappy(res.text, res.next === "reflect" ? "idle" : "idle");
      turns.current.push({ role: "zappy", text: res.text });
    }
    if (res.chips?.length) {
      emit.chips(res.chips);
      // The server owns the labels; remember which is which so a tap can be interpreted without
      // the client ever knowing what they say.
      if (res.next === "reflect") {
        chipLabels.current.confirm = res.chips[0];
        chipLabels.current.correct = res.chips[1];
      } else if (res.next === "differentiator") {
        chipLabels.current.skip = res.chips[0];
      }
    }
    setAwaitingConfirm(res.next === "reflect");
  }, [emit]);

  const step = useCallback(async () => {
    setBusy(true);
    try {
      const res = await turnMutation.mutateAsync({ serviceId, turns: turns.current });
      if (res.next === "insufficient") {
        emit.zappy(
          "I haven't quite got enough to rebuild it from — no problem, I'll work with what's already on file.",
          "idle",
        );
        setActive(false);
        setAwaitingConfirm(false);
        onEnded?.("insufficient");
        return;
      }
      render(res as { next: Next; text?: string; chips?: string[] });
    } catch {
      emit.zappy("That didn't go through — want to try again in a moment?", "idle");
      setActive(false);
      onEnded?.("dismissed");
    } finally {
      setBusy(false);
    }
  }, [serviceId, turnMutation, render, emit, onEnded]);

  /** Open the conversation. */
  const start = useCallback(async () => {
    turns.current = [];
    corrections.current = 0;
    setActive(true);
    await step();
  }, [step]);

  const save = useCallback(async () => {
    setBusy(true);
    emit.zappy("Got it — rebuilding your method from that…", "celebrating");
    try {
      const res = await saveMutation.mutateAsync({ serviceId, turns: turns.current });
      if (res.saved) {
        emit.divider("Method saved");
        setActive(false);
        setAwaitingConfirm(false);
        await onSaved();
      } else {
        emit.zappy(`I couldn't save that one (${res.reason ?? "please try again"}).`, "idle");
        setActive(false);
        onEnded?.("insufficient");
      }
    } catch {
      emit.zappy("That didn't save — I'll carry on with what's already on file.", "idle");
      setActive(false);
      onEnded?.("dismissed");
    } finally {
      setBusy(false);
    }
  }, [serviceId, saveMutation, emit, onSaved, onEnded]);

  /** A free-text answer from the coach. */
  const submitText = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || busy || !active) return;
    emit.user(t);
    turns.current.push({ role: "coach", text: t });
    setAwaitingConfirm(false);
    await step();
  }, [busy, active, emit, step]);

  /** A chip tap. Interpreted against the labels the SERVER supplied, never against literals. */
  const submitChip = useCallback(async (chip: string) => {
    if (busy || !active) return;
    emit.user(chip);

    if (awaitingConfirm && chip === chipLabels.current.confirm) {
      await save();
      return;
    }
    if (awaitingConfirm && chip === chipLabels.current.correct) {
      corrections.current += 1;
      setAwaitingConfirm(false);
      if (corrections.current > CORRECTION_LIMIT) {
        // Stop re-reflecting rather than looping a coach who is not converging.
        await save();
        return;
      }
      emit.zappy("What did I get wrong?", "idle");
      turns.current.push({ role: "zappy", text: "What did I get wrong?" });
      return;
    }
    if (chip === chipLabels.current.skip) {
      turns.current.push({ role: "coach", text: "__SKIP__" });
      await step();
      return;
    }
    // Any other chip is treated as a typed answer.
    turns.current.push({ role: "coach", text: chip });
    await step();
  }, [busy, active, awaitingConfirm, emit, save, step]);

  return {
    /** True while the conversation owns the text bar. */
    active,
    busy,
    /** True while chips are up and a tap is a confirm/correct rather than an answer. */
    awaitingConfirm,
    start,
    submitText,
    submitChip,
    stop: () => { setActive(false); setAwaitingConfirm(false); onEnded?.("dismissed"); },
  };
}

/**
 * Standalone rendering — its own ChatThread, mirroring V2OperatorIntake. Used anywhere the
 * walkthrough is the whole surface. V2Trail does NOT use this; it uses the hook above.
 */
export default function V2MethodWalkthrough({
  serviceId,
  onSaved,
}: {
  serviceId: number;
  onSaved?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seq = useRef(0);
  const push = (m: Omit<ChatMessage, "id">) =>
    setMessages((prev) => [...prev, { id: `mw-${++seq.current}`, ...m }]);

  const emit: WalkthroughEmit = {
    zappy: (text, mood) => push({ type: "zappy-bubble", mood, text }),
    user: (text) => push({ type: "user-bubble", text }),
    chips: (chips) => push({ type: "chip-row", chips }),
    divider: (text) => push({ type: "system-divider", text }),
  };

  const wt = useMethodWalkthrough({ serviceId, emit, onSaved: () => onSaved?.() });
  const started = useRef(false);
  if (!started.current) { started.current = true; void wt.start(); }

  const onChipTap = (messageId: string, chip: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    void wt.submitChip(chip);
  };

  return (
    <ChatThread
      messages={messages}
      onChipTap={onChipTap}
      onSendText={wt.active && !wt.awaitingConfirm ? (t) => void wt.submitText(t) : undefined}
      inputPlaceholder="Type your answer…"
      inputDisabled={wt.busy || !wt.active || wt.awaitingConfirm}
    />
  );
}
