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

// Generic patience cadence — fallback for callers that don't specify a node.
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

// Node-aware patience lines — Zappy says things relevant to the node being
// built, not the same generic line every time. Same timing cadence as
// GENERIC_PATIENCE (early 14-30s, mid 42-70s, long 90s+).
const NODE_PATIENCE: Record<string, string[]> = {
  offer: [
    "Weighing up the guarantee wording…",
    "Making sure the price-to-value ratio hits right.",
    "Almost there — locking the bonuses in place.",
    "Pressure-testing the angle one more time.",
    "Good offers take a minute. This one's worth it.",
    "Finishing touches on the guarantee language.",
    "Nearly done — just tightening the CTA.",
    "Your offer stack is getting the final look.",
    "Hang tight — the best part is the close.",
  ],
  mechanism: [
    "Trying names until one earns a trademark.",
    "Your method needs to sound like only you could teach it.",
    "Checking it doesn't accidentally sound like someone else's.",
    "A good method name does half the selling for you.",
    "Still refining — the right name clicks instantly.",
    "Running it past the 'would I Google this?' test.",
    "Nearly there — this one has to stick in the memory.",
    "Testing how it sounds in a headline…",
    "The naming part always takes longest. Almost done.",
  ],
  hvco: [
    "The free thing has to be worth paying for — that's the bar.",
    "Making sure the title earns the click on its own.",
    "Checking it delivers a quick win, not just information.",
    "A great lead magnet makes the paid offer feel inevitable.",
    "Tightening the promise — one specific result, not a vague benefit.",
    "Almost there — the title has to stop the scroll.",
    "Your opt-in is doing double duty: value now, trust later.",
    "Refining the hook — it needs to feel urgent, not salesy.",
    "Final pass — making sure it connects back to your offer.",
  ],
  headlines: [
    "Each one targets a different nerve.",
    "Short enough for a thumb-scroll, sharp enough to stop one.",
    "Running every headline past the 38-character check.",
    "The best headline sounds like a conversation, not a pitch.",
    "Trying a few more angles — variety wins in split tests.",
    "Almost done — each one earns its spot.",
    "Making sure they hit curiosity, not clickbait.",
    "Checking they sound human out loud, not just on screen.",
    "Final headline polish — these are your first impression.",
  ],
  adCopy: [
    "Matching your voice, not a copywriter's voice.",
    "Hook has to earn the first three seconds.",
    "Checking every line passes Meta's ad policies.",
    "The story section is where people decide to keep reading.",
    "Making the CTA feel like the obvious next step.",
    "Tightening — every word that doesn't sell gets cut.",
    "Running the compliance check one more time.",
    "Almost there — this copy has to work in a feed full of noise.",
    "Final pass — reading it as if I'd never heard of you.",
  ],
  landingPage: [
    "Above-the-fold headline is doing the heavy lifting.",
    "Wiring the proof section — testimonials, stats, credibility.",
    "Every section answers the next objection in order.",
    "The page has to work even if they only skim the bold text.",
    "Building the mobile layout — most clicks come from phones.",
    "Connecting the CTA back to the exact promise in your ad.",
    "Landing pages are the longest build — almost through it.",
    "Checking the flow: hook, problem, solution, proof, action.",
    "Final section — making sure the close earns the click.",
  ],
  emailSequence: [
    "Subject lines are half the battle — nailing those first.",
    "Each email presses a different angle from your offer.",
    "Spacing them so they feel helpful, not hounding.",
    "The first email has to land within minutes of the opt-in.",
    "Checking the call-to-action in each one is crystal clear.",
    "Making sure the tone stays yours across all the emails.",
    "Almost done — writing the closer that converts.",
    "Linking every email back to the landing page.",
    "Final read-through — does each one earn the next open?",
  ],
  whatsappSequence: [
    "WhatsApp has to sound like a real person texted it.",
    "Keeping each message under thumb-scroll length.",
    "The first message has to earn a reply, not a block.",
    "Making the link drop feel natural, not forced.",
    "Checking the timing gaps feel human, not automated.",
    "Almost done — three messages, three different hooks.",
    "Reading them out loud to check the tone.",
    "Final message links everything back to your page.",
    "These are done — short, sharp, and reply-worthy.",
  ],
  adCreatives: [
    "Generating five different visual angles.",
    "Each image has to stop a scroll in under a second.",
    "Compositing headlines onto the renders now.",
    "Image generation runs a bit longer — worth the wait.",
    "Checking every headline fits inside the safe zone.",
    "The visuals have to match the energy of your copy.",
    "Almost done — final render pass on the last variations.",
    "Making sure they look sharp at every ad placement size.",
    "Your ad images are coming together — nearly there.",
  ],
};

/** Returns node-specific patience lines at the standard timing cadence. */
export function getNodePatience(step: string): [number, string][] {
  const lines = NODE_PATIENCE[step];
  if (!lines) return GENERIC_PATIENCE;
  const timings = [14_000, 22_000, 30_000, 42_000, 54_000, 70_000, 90_000, 110_000, 130_000];
  return timings.map((ms, i) => [ms, lines[i % lines.length]]);
}

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
