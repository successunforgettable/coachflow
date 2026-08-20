import type { DistilledMethod, MethodSourceTier } from "./methodExtractor";
import { BANNED_MECHANISM_NAMES } from "./copywritingRules";

/**
 * THE ZAP B2C MECHANISM STANDARD — the prompt-side expression of docs/mechanism-research/.
 *
 * Sits beside `offerStandard.ts` for the same reason: it is a STANDARD several surfaces judge
 * themselves against, not a private detail of one generator.
 *
 * 🔴 B2C ONLY. Solo practitioners selling to individuals. No procurement, no committee, no ROI case.
 * 📌 Positive framing (CLAUDE.md §14) — every block states the shape the output IS. The one
 *    exception is `validateMechanismName`, which is a deterministic rejecter, not a prompt.
 */

// ── The guided conversation ──────────────────────────────────────────────────────────────────
/**
 * THE WALKTHROUGH SCRIPT — canonical, server-side, so the chat surface and any future surface
 * (voice, import review) ask the same things in the same order.
 *
 * It is a CONVERSATION, never a form. There is deliberately no "describe your unique mechanism"
 * question anywhere in it: a coach asked that question either freezes or produces marketing
 * language, and marketing language is exactly what we already have too much of. Instead the coach
 * narrates one real client, which they can always do, and the extractor does the abstracting.
 *
 * The closing beat is a REFLECT-BACK: the coach only has to recognise or correct, never to
 * articulate from scratch. That is the same move the ICP ladder makes and the reason it works.
 */
export const METHOD_WALKTHROUGH = {
  opener: "Think of one client who got a great result. What did you actually have them do — first, then next, then after that?",
  /** Fired when an answer is thin. Cycled in order; never more than PROBE_LIMIT in one session. */
  probes: [
    "And once they've done that, what's next?",
    "What happens between those two — is there a step in the middle?",
    "When you say that, what does it look like in practice for them?",
  ],
  /** Optional and explicitly skippable. Never gates completion. */
  differentiator: "Last one, and skip it if nothing comes to mind — what do you do differently from most people in your field?",
  /** Rendered with the distilled steps interpolated. Recognition, not articulation. */
  reflectBackPrefix: "So it's basically these moves —",
  reflectBackSuffix: "have I got that right?",
  skipChip: "Skip this one",
  confirmChip: "That's it",
  correctChip: "Not quite",
} as const;

/** How many probes one session may fire before it stops pushing and works with what it has. */
export const PROBE_LIMIT = 3;

/**
 * ENDS ON SUBSTANCE, NOT ON A FIELD COUNT.
 *
 * The session closes when the extractor reports a method with two or more evidenced steps — or
 * when the probe budget is spent, whichever comes first. It never counts filled fields, because a
 * coach who gave three real moves in one sentence is finished and a coach who filled six boxes
 * with adjectives is not.
 */
export const SESSION_ENDS_ON = "substance" as const;

// ── The standard, as prompt blocks ───────────────────────────────────────────────────────────
export const MARKET_SOPHISTICATION_BLOCK = `
WHY A MECHANISM AT ALL — the market these people are selling into:

Every niche ZAP serves is a mature one. The reader has heard the direct claim, and then heard it
enlarged, and has stopped believing both. Making the promise bigger now moves the reader further
away, because they already know the underlying approach and know it did not work for them.

What still works at this stage is the HOW and the WHY: a specific, nameable reason this approach
produces a result when the ones they already tried did not. That reason is the mechanism, and it
is the only part of the message that is still doing work.
`;

export const UMP_UMS_BLOCK = `
THE TWO HALVES — a mechanism is a matched pair, and both halves are required:

UMP — the mechanism of the PROBLEM. The precise structural reason the usual approach fails these
people. Written as a property of the APPROACH: what it leaves out, what it was never built to
handle, the part of the situation it does not touch. It is never a property of the reader's
character, discipline, willpower or effort. This half does the heavy lifting: a reader who sees
that the vehicle was broken stops carrying the blame for having failed in it, and only then can
they consider trying again.

UMS — the mechanism of the SOLUTION. The specific countermeasure that answers the UMP, point for
point. If the UMP says the usual approach never addresses X, the UMS is the part of this method
that addresses X, named and described. A UMS that does not answer its own UMP is two disconnected
paragraphs rather than a mechanism.

Written as a pair they produce the effect the whole thing exists for: the reader can trace, by
cause and effect, why this would work where the last thing did not.
`;

export const OLD_VEHICLE_BLOCK = `
THE OLD VEHICLE — where the blame goes:

Name what these people were doing before, using the name their field actually uses for it. Say
what that approach structurally leaves out. Then introduce this method as a different vehicle
that addresses exactly that gap.

The reader should finish the passage thinking "no wonder that didn't work — that was never built
for this." Describe the old approach accurately and without contempt: it is a tool that does not
fit this job, not a stupid thing that stupid people used. Contempt for the old vehicle reads as
contempt for the reader who chose it.
`;

export const THREE_CRITERIA_BLOCK = `
THE THREE TESTS every mechanism has to pass:

1. DIGESTIBLE — it can be explained in one or two sentences and repeated by someone who heard it
   once. A mechanism that needs a diagram does not survive contact with a scrolling reader.
2. INTERESTING — it reframes something the reader thought they understood, so they finish the
   sentence thinking "I had never thought about it that way." It should make them feel sharper
   for knowing it.
3. TRACEABLE — the reader can follow why it would work from what they already know about
   themselves and their own experience. Grounded in ordinary observable cause and effect, not in
   an authority they have to take on faith.
`;

export const OPERATIONAL_TWIST_BLOCK = `
THE OPERATIONAL TWIST — what makes a named method real rather than a relabelling:

Renaming an ordinary process and charging more for it is the oldest failure in this field, and a
sophisticated reader detects the gap between a dramatic name and a mundane reality immediately.
What separates an honest branded method from a relabelling is that something about the DELIVERY is
genuinely different — something the client physically experiences or can structurally trace:

- SEQUENCE   — the usual steps reordered, or one moved, to remove a snag or reach a result sooner.
- ISOLATION  — one narrow part of a general process pulled out and made the entire focus.
- SYNTHESIS  — two established disciplines genuinely combined into a single process.

Where the supplied method carries one of these, build the mechanism around it and say plainly what
the difference is in practice.

Where it carries NONE — where the process is a standard one, competently run — the honest and
still highly persuasive route is to tell the untold story of that ordinary process: the care, the
sequence, the specific things attended to that everyone in the field does and nobody ever
describes. Being the only one who explains it is enough to own it. Reach for that route rather
than asserting a twist the method does not have.
`;

export const NAMING_BLOCK = `
NAMING — describe the process, not the result:

A mechanism name that names the OUTCOME reads as a sales pitch and is rejected on sight by both
readers and ad review. A name that describes the PROCESS reads as a real thing that exists.

Build the name as: [what domain it works in] + [what it structurally does] + [what form it takes].

The name stays under six words, uses words a client in this field would recognise, and describes
something a person could picture happening. It carries no number, no timeframe, no outcome, and no
scientific-sounding vocabulary borrowed from a discipline this method does not belong to.

Test it twice. Say it to someone in the field: would they know roughly what happens? Then put it on
a competitor's page: does it still describe THEIR process? If it does, it is a category and not a
name.
`;

export const COMPLIANCE_PIVOT_BLOCK = `
HOW THE MECHANISM IS DESCRIBED — third person, about the process:

Describe how the method works as a general process. Do not address the reader's body, health,
finances or state of mind as though it were known — the description works on the mechanics, and
the reader recognises themselves in it without being told what is true of them.

Where the field touches health or money, describe what the process DOES rather than what it
resolves, and let the reader draw the conclusion. A description of mechanics is both the more
credible piece of writing and the one that survives review.
`;

/**
 * THE GUARDED FALLBACK — the floor when there is genuinely nothing to work from.
 *
 * This is not free invention. A coach who has given us nothing still gets a mechanism that is
 * plain, describes something recognisable, and could be said out loud without embarrassment.
 * The bar is the eye-roll test: a sceptical prospect in this niche reads the name and the
 * paragraph and does not roll their eyes.
 */
export const GUARDED_FALLBACK_BLOCK = `
YOU HAVE NOT BEEN GIVEN THIS PRACTITIONER'S ACTUAL PROCESS.

So build the plainest honest mechanism the situation supports, and keep it modest. Everything below
is a floor, not a target.

- NAME IT FOR WHAT HAPPENS. Ordinary words describing an ordinary sequence, in this field's
  vocabulary. Under six words. Someone in the field should be able to guess what it involves.
- NO BORROWED AUTHORITY. Keep out vocabulary from sciences this method does not belong to —
  neurological, quantum, cellular, frequency, energetic, DNA and their relatives. A name that
  sounds like a laboratory when the work is a conversation is the fastest way to lose a reader.
- NO NUMBERS OF ANY KIND. No durations, no counts, no percentages, no timeframes, no prices. Not
  in the name and not in the description.
- NO BEFORE-AND-AFTER. No client story, no named person, no described transformation, no result
  anyone has already had. Nothing has happened yet that you are entitled to describe.
- NO PROOF. No credentials, no track record, no "developed after working with", no research.
- BUILD IT FROM WHAT IS REAL: the pains and fears of this audience, which you have been given.
  The mechanism describes an approach that takes those specific pains seriously and addresses the
  specific fear about trying again. That is enough to be believable.
- DESCRIBE WHAT IT IS DESIGNED TO DO, in the present tense, as an intention rather than a promise.

THE TEST: a sceptical person in this field reads the name and the paragraph. They do not roll
their eyes, and they do not think "that's just coaching with a fancy name." If either happens,
make it plainer and more specific, never bigger.
`;

// ── Deterministic name validation ─────────────────────────────────────────────────────────────
/**
 * A prompt instruction is not a guard — this codebase has paid for that lesson repeatedly. These
 * are the checks that actually run, on the generated name, before the row is offered to the coach.
 */

/** Outcome/result words: a name carrying one of these names the RESULT, which is the faux-mechanism shape. */
const OUTCOME_WORDS = [
  "millionaire", "six-figure", "6-figure", "seven-figure", "7-figure", "wealth", "rich", "income",
  "profit", "revenue", "abundance", "manifestation", "manifest",
  "cure", "heal", "healing", "remedy", "fix", "eraser", "erase", "melt", "melting", "burn",
  "shred", "slim", "skinny", "weight-loss", "fat-loss", "anti-aging", "antiaging",
  "freedom", "success", "breakthrough", "transformation", "empowerment", "achievement",
];

/** Vocabulary borrowed from disciplines a coaching method does not belong to. */
const PSEUDO_SCIENCE_WORDS = [
  "quantum", "vibrational", "vibration", "frequency", "resonance", "dna", "genetic", "cellular",
  "neuro", "neural", "neurological", "subconscious-reprogramming", "brainwave", "theta", "alpha-wave",
  "biofield", "aura", "chakra-activation", "energetic-alignment", "metaphysical", "cosmic",
  "molecular", "epigenetic", "hormonal-reset", "detox", "cleanse",
];

export interface NameVerdict {
  ok: boolean;
  reasons: string[];
}

/**
 * Reject a mechanism name that names a result, borrows authority, carries a number, is one of the
 * known generic templates, or runs long. Applied to EVERY generated name regardless of tier —
 * the guarded fallback has the strictest prompt but the floor is the same for all three.
 */
export function validateMechanismName(name: string): NameVerdict {
  const reasons: string[] = [];
  const raw = (name ?? "").trim();
  if (!raw) return { ok: false, reasons: ["empty name"] };

  const lower = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean);

  if (words.length > 6) reasons.push(`${words.length} words — a name stays under six`);

  if (/\d/.test(raw)) reasons.push("carries a number");

  for (const w of OUTCOME_WORDS) {
    if (lower.includes(w)) { reasons.push(`names a result ("${w}") rather than a process`); break; }
  }
  for (const w of PSEUDO_SCIENCE_WORDS) {
    if (lower.includes(w)) { reasons.push(`borrows authority from an unrelated discipline ("${w}")`); break; }
  }

  // The existing literal list, matched loosely so near-misses are caught too. The old prompt-only
  // ban let "The Growth Framework" through while banning "The Growth System".
  const canon = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z]/g, "");
  const bannedCanon = new Set(BANNED_MECHANISM_NAMES.map(canon));
  if (bannedCanon.has(canon(raw))) reasons.push("is one of the known generic names");

  // Generic-template shape: <generic adjective/noun> + <container>, with nothing from a field in it.
  const GENERIC_HEADS = ["success", "growth", "mindset", "achievement", "breakthrough", "empowerment", "results", "transformation", "confidence", "clarity", "abundance"];
  const CONTAINERS = ["system", "method", "framework", "blueprint", "protocol", "formula", "process", "programme", "program"];
  const head = words[0]?.toLowerCase().replace(/^the$/, "") || words[1]?.toLowerCase() || "";
  const tail = words[words.length - 1]?.toLowerCase() ?? "";
  if (GENERIC_HEADS.includes(head) && CONTAINERS.includes(tail)) {
    reasons.push("is a generic template name — nothing in it comes from this field");
  }

  return { ok: reasons.length === 0, reasons };
}

// ── Assembly ──────────────────────────────────────────────────────────────────────────────────
/** The full standard for a run. `null` method → the guarded-fallback floor. */
export function mechanismStandardBlock(method: DistilledMethod | null): string {
  const core = [
    MARKET_SOPHISTICATION_BLOCK,
    UMP_UMS_BLOCK,
    OLD_VEHICLE_BLOCK,
    THREE_CRITERIA_BLOCK,
    NAMING_BLOCK,
    COMPLIANCE_PIVOT_BLOCK,
  ];
  if (!method) return [...core, GUARDED_FALLBACK_BLOCK].join("\n");
  return [...core, OPERATIONAL_TWIST_BLOCK, methodBlock(method)].join("\n");
}

/** The coach's real method, rendered into the prompt as the thing to build the mechanism ON. */
export function methodBlock(m: DistilledMethod): string {
  const lines: string[] = [
    "THIS PRACTITIONER'S ACTUAL METHOD — build the mechanism on THIS, and add nothing to it:",
    "",
    "The moves, in order:",
    ...m.steps.map((s, i) => `  ${i + 1}. ${s.name} — ${s.whatHappens}`),
  ];
  if (m.operationalTwist && m.operationalTwist.kind !== "none") {
    lines.push("", `What is genuinely different about how this is delivered (${m.operationalTwist.kind}): ${m.operationalTwist.description}`);
  } else if (m.operationalTwist?.kind === "none") {
    lines.push("", "This is a standard process run with care. Tell the untold story of it rather than asserting a twist it does not have.");
  }
  if (m.oldVehicle) lines.push("", `What these people were doing before: ${m.oldVehicle}`);
  if (m.ump) lines.push(`Why that structurally fails them: ${m.ump}`);
  if (m.ums) lines.push(`What this method does about it: ${m.ums}`);
  if (m.differentiator) lines.push("", `What the practitioner says they do differently: ${m.differentiator}`);
  lines.push(
    "",
    `Source: ${sourceLine(m.sourceTier)} (confidence: ${m.confidence}).`,
    "Everything above came from the practitioner. Do not extend it, and do not add steps, figures,",
    "timeframes or results that are not written here.",
  );
  return lines.join("\n");
}

function sourceLine(t: MethodSourceTier): string {
  switch (t) {
    case "coach_stated": return "the practitioner described this directly, in conversation";
    case "extracted": return "mined from material the practitioner supplied";
    case "guarded_fallback": return "no method material was available";
  }
}
