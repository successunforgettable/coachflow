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
 * Respects prefers-reduced-motion (fewer messages, no timing games).
 */

const ICP_PATIENCE_LINES: [number, string][] = [
  [12_000, "Mapping what keeps them up at night."],
  [24_000, "This part takes a moment — I'm reading everything you gave me."],
  [45_000, "Still building your profile… almost there."],
  [70_000, "Taking longer than usual — still on it, nothing's stuck."],
  [95_000, "Worth the wait, promise."],
  [120_000, "Polishing the edges…"],
  [150_000, "Still cooking — good things, slow oven."],
  [180_000, "Taking longer than usual — still on it, nothing's stuck."],
];

// Generic patience cadence reusable by any wait (V2Trail narrator uses this
// for its >14s portion instead of hardcoding its own timer chain).
export const GENERIC_PATIENCE: [number, string][] = [
  [14_000, "Still cooking — good things, slow oven."],
  [22_000, "Worth the wait, promise."],
  [30_000, "Taking longer than usual — still on it, nothing's stuck."],
  [42_000, "Polishing the edges…"],
  [54_000, "Still cooking — good things, slow oven."],
  [70_000, "Worth the wait, promise."],
  [90_000, "Taking longer than usual — still on it, nothing's stuck."],
  [110_000, "Polishing the edges…"],
  [130_000, "Still cooking — good things, slow oven."],
];

export type PatienceMessage = { type: "zappy-bubble"; mood: "thinking"; text: string };

/**
 * Runs `promise` while posting patience bubbles at intervals.
 * Returns the promise result; clears all timers on resolution.
 *
 * @param promise  The async work (e.g. pollJob)
 * @param addMsg   A function that appends a message to the thread
 * @param schedule Optional custom schedule; defaults to ICP_PATIENCE_LINES
 */
export function patienceGuard<T>(
  promise: Promise<T>,
  addMsg: (msg: PatienceMessage) => void,
  schedule: [number, string][] = ICP_PATIENCE_LINES,
): Promise<T> {
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    : false;

  const timers: ReturnType<typeof setTimeout>[] = [];

  if (!reducedMotion) {
    for (const [ms, text] of schedule) {
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
