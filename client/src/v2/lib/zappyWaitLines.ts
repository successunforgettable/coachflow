/**
 * zappyWaitLines — single source of truth for Zappy's node-aware patience lines.
 *
 * Voice: confident, playful, warm — a brilliant marketing friend building your
 * campaign and enjoying it. Never names a technical process. Zappy is a fox,
 * not a server. Max one emoji per line, only where it adds warmth.
 *
 * Tiers per node:
 *   early[]  — fires immediately (node-flavour, states what's being built)
 *   mid[]    — fires ~15 s+ (entertainment, tease, insight, or a real joke)
 *   long[]   — fires ~40 s+ (warm reassurance, never apologetic)
 *   reveal[] — fires on success, just before the card appears
 *
 * Rotation rules (enforced by the picker below):
 *   - No repeat within one build (generation run).
 *   - Never repeat a joke in a session (jokes tagged isJoke).
 *   - Exhausted pool falls back to long calm lines, never jokes.
 *   - Reduced-motion / quiet mode = early + long only, no mid (no jokes).
 */

// ── Types ──

export interface WaitLine {
  text: string;
  isJoke?: boolean;
}

export interface NodeLines {
  early: string[];
  mid: WaitLine[];
  long: string[];
  reveal: string[];
}

// ── Line data — verbatim from ~/Downloads/Zappy_Wait_Lines.md ──

export const ZAPPY_LINES: Record<string, NodeLines> = {
  service: {
    early: [
      "Getting the basics down. Two seconds.",
      "Setting your foundation. Here we go.",
      "Reading you in. Won't be a moment.",
    ],
    mid: [
      { text: "Just making sure I've really got you. No half-jobs here." },
    ],
    long: [
      "Still with you — I like to get the ground floor right.",
    ],
    reveal: [
      "\u2026locked in. Let's build.",
      "\u2026got it. Onward.",
    ],
  },

  icp: {
    early: [
      "Getting to know your future favourite client.",
      "Working out exactly what keeps them up at night.",
      "Climbing inside your dream customer's head. Comfy in here.",
    ],
    mid: [
      { text: "Ooh. Already spotting what they secretly want. You're going to like this." },
      { text: "Your people are tired of generic advice — we're going to use that." },
      { text: "Want a joke while I dig? Why did the marketer get lost? \u2026 They couldn't find their target audience. \uD83E\uDD8A", isJoke: true },
      { text: "Profiling your perfect buyer. Honestly? I already like them." },
    ],
    long: [
      "Still digging deep — this is the most important part of the whole campaign, so I'm being thorough.",
      "Taking my time here on purpose. Get this person right and everything after is easy.",
    ],
    reveal: [
      "\u2026and done. Meet your ideal customer.",
      "\u2026there they are. Now I know exactly who we're talking to.",
    ],
  },

  offer: {
    early: [
      "Cooking up your offer — the bit that makes people go 'wait, how much?' in the good way.",
      "Building something they'd feel silly saying no to.",
      "Stacking your value sky-high. Hang on.",
    ],
    mid: [
      { text: "Adding the guarantee on top. We're taking all the risk off their plate." },
      { text: "Ooh, I'd buy this. And I'm a fox with no wallet." },
      { text: "Want a joke? Why are sales offers like elevators? \u2026 The good ones don't drop you halfway. I'll stop. \uD83E\uDD8A", isJoke: true },
    ],
    long: [
      "Still cooking. An offer this good is worth the extra few seconds — trust me.",
      "Not rushing this one. The offer is the whole engine.",
    ],
    reveal: [
      "\u2026and there it is. The no-brainer.",
      "\u2026done. Try saying no to that. I'll wait.",
    ],
  },

  mechanism: {
    early: [
      "Mixing up your secret sauce. Let me cook.",
      "Giving your method a name people will actually remember.",
      "Bottling what makes you different. This is the fun part.",
    ],
    mid: [
      { text: "Throwing out the boring names. We want one that sticks in their head for a week." },
      { text: "Ooh, wait till you see what I'm calling this." },
    ],
    long: [
      "Still shaping it. A signature method worth its name takes a minute of real thought.",
    ],
    reveal: [
      "\u2026boom. Your signature method, named and ready.",
      "\u2026there. That's *yours* now.",
    ],
  },

  hvco: {
    early: [
      "Building the freebie that gets them raising their hands.",
      "Crafting the hook. The good kind of bait.",
    ],
    mid: [
      { text: "Making this so good they'll feel like they're getting away with something." },
      { text: "Free, but make it irresistible. That's the trick." },
    ],
    long: [
      "Polishing the titles — I want maximum hands-in-the-air on this one.",
    ],
    reveal: [
      "\u2026all set. Here's your magnet.",
      "\u2026done. Try scrolling past that.",
    ],
  },

  headlines: {
    early: [
      "Writing the lines that stop the scroll. Being picky on your behalf.",
      "Hunting for the perfect hook. Throwing back the small ones.",
    ],
    mid: [
      { text: "Ooh, this one's going to make your reader feel slightly attacked — in the good way." },
      { text: "Binning the boring ones. Only keeping gold." },
      { text: "Want a joke? What's a copywriter's favourite exercise? \u2026 Running headlines. Moving on. \uD83E\uDD8A", isJoke: true },
    ],
    long: [
      "Still writing. Good hooks take a few tries, and I'm writing a *lot* of them for you.",
    ],
    reveal: [
      "\u2026and we've got our hooks. Take a look.",
      "\u2026done. Go on, try not to click those.",
    ],
  },

  adCopy: {
    early: [
      "Making the case so they can't *not* click.",
      "Building the argument. This one's going to convert.",
    ],
    mid: [
      { text: "Weaving your method right into the pitch. They won't see it coming." },
      { text: "Adding just the right pinch of urgency. Ooh, I like where this is going." },
    ],
    long: [
      "Still refining — I'm making sure this persuades *and* stays clean for the ad police.",
    ],
    reveal: [
      "\u2026and there we go. Copy that converts.",
      "\u2026done. That's a closer.",
    ],
  },

  landingPage: {
    early: [
      "Laying out the page that turns 'maybe' into 'yes'.",
      "Building the room where the sale actually happens.",
    ],
    mid: [
      { text: "Placing the proof so they trust you in about four seconds flat." },
      { text: "Setting the page up so the eye goes exactly where we want it." },
    ],
    long: [
      "Still laying bricks. A page that converts is a proper build — nearly there.",
    ],
    reveal: [
      "\u2026done. Welcome to your new landing page.",
      "\u2026there it is. That page has one job, and it's good at it.",
    ],
  },

  emailSequence: {
    early: [
      "Writing the emails that do the following-up so you don't have to.",
      "Warming them up, one message at a time.",
    ],
    mid: [
      { text: "Building the story so it flows from day one to the 'okay, I'm in'." },
      { text: "Want a joke while I write? Why did the email break up with the inbox? \u2026 Too much spam in the relationship. \uD83E\uDD8A", isJoke: true },
    ],
    long: [
      "A full sequence takes a minute — I'm making sure each one earns the next open.",
    ],
    reveal: [
      "\u2026and it's ready to send. Your sequence is built.",
      "\u2026done. That'll do the chasing for you.",
    ],
  },

  whatsappSequence: {
    early: [
      "Writing the messages that land right in their pocket.",
      "Keeping it punchy. Nobody wants a novel in their texts.",
    ],
    mid: [
      { text: "Making us sound like a friend texting, not a brand broadcasting." },
      { text: "Short, warm, hard to ignore. That's the brief." },
    ],
    long: [
      "Still typing — getting the casual tone *exactly* right takes a sec.",
    ],
    reveal: [
      "\u2026ping. Your messages are ready.",
      "\u2026done. Straight to their pocket.",
    ],
  },

  adCreatives: {
    early: [
      "Making it look as good as it sounds.",
      "Adding the visual that stops the thumb mid-scroll.",
    ],
    mid: [
      { text: "Getting the colours loud enough to interrupt a feed." },
      { text: "Almost there — the part where it all starts looking like a *real* campaign." },
    ],
    long: [
      "Last stretch. Good design's worth the few extra seconds — you'll see.",
    ],
    reveal: [
      "\u2026and we've got visuals. Your campaign's complete. \uD83E\uDD8A",
      "\u2026done. Look at what we just built.",
    ],
  },
};

// ── Rotation picker ──

// Session-level: tracks jokes already shown (survives across builds).
const usedJokesThisSession = new Set<string>();

// Build-level: tracks all lines shown in the current generation run.
let buildUsed = new Set<string>();

/** Call at the start of each new generation run (auto-cascade, regen, etc). */
export function resetBuild(): void {
  buildUsed = new Set();
}

/** Pick a random line from a pool, respecting rotation rules. */
function pickFrom(
  pool: (string | WaitLine)[],
  opts: { noJokes?: boolean } = {},
): string | null {
  const candidates = pool
    .map(l => (typeof l === "string" ? { text: l } : l))
    .filter(l => {
      if (buildUsed.has(l.text)) return false;
      if (l.isJoke && opts.noJokes) return false;
      if (l.isJoke && usedJokesThisSession.has(l.text)) return false;
      return true;
    });
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  buildUsed.add(pick.text);
  if (pick.isJoke) usedJokesThisSession.add(pick.text);
  return pick.text;
}

/** Returns the early narration lines for a node (up to 3). */
export function getEarlyLines(step: string): string[] {
  const node = ZAPPY_LINES[step];
  if (!node) return ["Still cooking — good things, slow oven."];
  // Pick without replacement from early pool
  const out: string[] = [];
  for (let i = 0; i < Math.min(3, node.early.length); i++) {
    const line = pickFrom(node.early);
    if (line) out.push(line);
  }
  return out.length > 0 ? out : [node.early[0]];
}

/**
 * Returns a timed patience schedule (mid + long) for the long-wait portion.
 * Reduced-motion mode: returns only long lines (calm, no jokes/teases).
 */
export function getNodePatienceSchedule(
  step: string,
  opts: { reducedMotion?: boolean } = {},
): [number, string][] {
  const node = ZAPPY_LINES[step];
  if (!node) return [[14_000, "Still cooking — good things, slow oven."]];

  const schedule: [number, string][] = [];
  const noJokes = opts.reducedMotion;

  if (!opts.reducedMotion) {
    // Mid lines at ~14s, 22s, 30s
    const midTimings = [14_000, 22_000, 30_000];
    for (const ms of midTimings) {
      const line = pickFrom(node.mid, { noJokes });
      if (line) schedule.push([ms, line]);
    }
  }

  // Long lines at 42s+ (cycling if needed, up to 130s)
  const longTimings = opts.reducedMotion
    ? [14_000, 30_000, 50_000, 70_000, 90_000, 110_000, 130_000]
    : [42_000, 60_000, 80_000, 100_000, 120_000, 140_000];
  let longCycleIdx = 0;
  for (const ms of longTimings) {
    // Pick from long; if exhausted, cycle (calm lines are safe to repeat)
    let line = pickFrom(node.long);
    if (!line) {
      line = node.long[longCycleIdx % node.long.length];
      longCycleIdx++;
    }
    if (line) schedule.push([ms, line]);
  }

  return schedule;
}

/** Returns a random reveal line for a node. */
export function getRevealLine(step: string): string | null {
  const node = ZAPPY_LINES[step];
  if (!node || node.reveal.length === 0) return null;
  return node.reveal[Math.floor(Math.random() * node.reveal.length)];
}
