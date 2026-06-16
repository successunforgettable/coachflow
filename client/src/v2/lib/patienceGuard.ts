/**
 * patienceGuard — shared dead-air protection for async waits.
 *
 * Wraps any Promise (typically a pollJob call) and posts patience
 * messages at timed intervals via the provided addMessage callback.
 * Works with V2TrailIntake's addMsg AND V2Trail's addLive — any
 * function that appends a ChatMessage-shaped object to a thread.
 *
 * The class-of-bug this prevents: a bare `await pollJob(...)` that
 * leaves the screen static for 2–4 minutes with no UI update.
 * Both wait-sites (intake ICP polls and the Trail narrator's
 * long-wait portion) run through this single utility.
 *
 * Patience lines are ephemeral (not transcript-worthy per the C3
 * rule) — the caller decides whether to persist them.
 *
 * Line data lives in zappyWaitLines.ts (single source of truth).
 * Respects prefers-reduced-motion (early + long only, no jokes).
 */

import { getNodePatienceSchedule } from "./zappyWaitLines";

export type PatienceMessage = { type: "zappy-bubble"; mood: "thinking"; text: string };

/**
 * Returns node-specific patience lines at the standard timing cadence.
 * Used by V2Trail's startNarration for the long-wait portion.
 */
export function getNodePatience(step: string): [number, string][] {
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;
  return getNodePatienceSchedule(step, { reducedMotion });
}

/**
 * Runs `promise` while posting patience bubbles at intervals.
 * Returns the promise result; clears all timers on resolution.
 *
 * @param promise  The async work (e.g. pollJob)
 * @param addMsg   A function that appends a message to the thread
 * @param schedule Optional custom schedule; defaults to ICP patience lines
 */
export function patienceGuard<T>(
  promise: Promise<T>,
  addMsg: (msg: PatienceMessage) => void,
  schedule?: [number, string][],
): Promise<T> {
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;

  const lines = schedule ?? getNodePatienceSchedule("icp", { reducedMotion });

  const timers: ReturnType<typeof setTimeout>[] = [];

  if (!reducedMotion || schedule) {
    for (const [ms, text] of lines) {
      timers.push(setTimeout(() => {
        addMsg({ type: "zappy-bubble", mood: "thinking", text });
      }, ms));
    }
  }

  const cleanup = () => timers.forEach(clearTimeout);

  return promise.then(
    (result) => { cleanup(); return result; },
    (err) => { cleanup(); throw err; },
  );
}
