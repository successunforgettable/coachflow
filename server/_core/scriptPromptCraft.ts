/**
 * scriptPromptCraft.ts — reusable video-script prompt-craft blocks, sourced from the paused generator
 * (server/routers/videoScripts.ts). Kept as shared exported consts so the Andromeda per-concept script
 * generator reuses the SAME craft library the paused generator uses. The paused generator is intentionally
 * left untouched (it keeps its own local copies) — the ICP grounding sprint can consolidate later.
 *
 * Content is the load-bearing craft: niche detection, hook rule, banned words, and the Meta-compliance
 * block. Render/pexels-oriented blocks (pexels queries, authority-scene, visual direction) are omitted —
 * this generator produces a script a human records, not a rendered asset.
 */

export const NICHE_DETECTION = `
NICHE DETECTION — universal, not a fixed list.
ZAP serves any coach, speaker, consultant, or educator on the planet. You will encounter niches you have
never seen before. Detect and write in their world:
- What does this person teach or help people do? Who specifically do they help — be specific.
- What does failure look like for that audience RIGHT NOW, today? What does success look like?
- What words does that audience use that an outsider would not? Use that insider language.
Write in their language, not yours. Every niche has specific fears — name them precisely. Every niche has
specific dreams — reference them concretely. If they say "yes, that's exactly how I feel" — correct world.
`;

export const HOOK_RULE = `
HOOK RULE — Scene 1 only, the first 3 seconds. One job: make the RIGHT person stop scrolling.
- Names something the viewer is LOSING or living right now — not something they could gain later.
- Creates an open loop — a tension that cannot be resolved until they watch the rest.
- Does NOT mention the product or the solution — only the reality that exists right now.
- Sounds like a real person said it, not a copywriter. If it sounds polished, it will be skipped;
  if it sounds like a truth someone finally said out loud, it stops the scroll. The reaction should be:
  "How did they know that?"
`;

export const BANNED_WORDS = `
BANNED WORDS — never use any of these. If you catch yourself writing one, rewrite using the specific
language of the niche instead:
- "proven frameworks/strategies/system/methods", "AI-powered", "leverage AI"
- "transform", "transformation", "transformative journey", "life-changing"
- "streamline", "optimize", "innovative", "cutting-edge", "empower", "unlock your potential"
- "scale your business", "next level", "elevate your brand", "overwhelmed", "pain points", "struggling with"
- "seamlessly", "effortlessly", "game-changer", "revolutionary", "holistic approach", "world-class"
- "journey", "passion/passionate", "countless/many/numerous" (use actual numbers from the profile)
- "individuals/people" (use the specific audience: traders, mothers, photographers, etc.)
- "loophole", "secret", "hack", "they don't want you to know" — these oversell AND trip Meta's policy filter;
  use "a new way" or "a different approach" instead.
These words appear in every ad on the internet; they trigger the part of the brain that skips ads.
`;

// STRUCTURE + BODY craft — the research-grounded 5-beat shape (Hook → Problem → Turn → Solution → CTA) and
// the ear-first body rules. Positive-framed (describes what the copy IS). Grounded in the 7 NotebookLM
// scriptwriting reports (Structure/Timing §2 five-beat; Hooks §5 intro <10w + bold; Messy Middle §1 one-idea;
// Natural Perf §5 story-before-stat; CTA §1 natural extension). The Turn's length is intentionally unspecified
// (reports: "no strong signal" on Turn duration).
export const SCRIPT_STRUCTURE_CRAFT = `
STRUCTURE — five beats: HOOK → PROBLEM → TURN → SOLUTION → CTA.
- HOOK (the opening, under ~10 words): lead with a bold, specific statement — the one truth that stops THIS
  person mid-scroll. (A clear, immediately-legible opener also works; a question is a weaker fallback.) Open a
  curiosity loop in the very first line, and resolve it on the very next beat.
- PROBLEM: name the one lived situation they're in right now — one idea, one breath.
- TURN: the shift from problem to solution — "here's the new way", "a different approach you haven't tried."
  Keep it short; it's the bridge, not a lecture.
- SOLUTION: the method as the way out — the benefit, not the feature.
- CTA: a natural next step, not an interruption. Sell the click — one clear, easy step — and say why it's worth it.

BODY — write for the ear:
- One idea per sentence. If a line has a comma, it probably holds two ideas — split them.
- Say it straight — no hedging ("maybe", "kind of", "sort of", "helps").
- Walk the So-What chain from the plain feature to the emotional payoff that actually matters to this person.
- Always set up a number or result with the story or benefit it belongs to — story first, then the number.
- Spell numbers the way you'd say them out loud ("thirty-one hundred", not "3,100") so they're easy on camera.
`;

// GOVERNING SAFETY — overrides every persuasion tactic above. Positive-framed (ground in real material).
// New this pass: contact-detail fabrication rule (CTA report) + honest "new opportunity" framing.
export const SCRIPT_SAFETY = `
GROUND EVERYTHING IN REAL MATERIAL — this overrides every persuasion tactic above:
- Every number, percentage, dollar figure, result, and guarantee is a REAL one from the coach's material above.
  If it isn't there, leave it out — never make one up.
- Round a number for the ear ONLY when it's real ("around six thousand"); never round an invented figure into being.
- A link, URL, phone, or email is the coach's real one or the placeholder [INSERT_LINK] — never invent a contact.
- Frame the method as a new opportunity — a different way they haven't tried — in plain, honest words.
- Name a real person or brand only if the coach's material named them first.
- Hold a ready-to-buy (Most-Aware) urgency script to the STRICTEST version of every rule above — that's where
  fabrication risk is highest.
`;

export const META_COMPLIANCE = `
⚠️ META COMPLIANCE — CRITICAL: ad-account suspension if violated. Your script is REJECTED if it violates any:
1. NEVER "you" + negative body/health language ("Are you exhausted?", "Feeling weak?", "Your body isn't yours?").
   SAFE: "Want more energy?", "Ready to feel strong again?"
2. NEVER call out personal attributes: age ("over 40", "postpartum"), race, religion, disability, financial
   status ("broke", "can't afford"), medical conditions ("have anxiety", "diagnosed with"). Focus on the
   desired outcome only.
3. NEVER "you are" + failure language ("You're failing/stuck/losing/broke"). SAFE: "Want to stop losing...?"
4. NEVER unrealistic/guaranteed outcomes ("Make $10K your first month", "Cure your anxiety", guaranteed income).
5. NEVER before/after body-transformation language. SAFE: "Build strength", "Feel energized".
KEY PRINCIPLE: describe a specific physical MOMENT, not a personal attribute. Moments are compliant
("the moment you go to pick up your toddler and your back says no"); attributes are violations.
`;

// SPOKEN REGISTER — the load-bearing fix (2026-07-25): restores the spoken-register standard the paused
// generator carried (CUSTOMER_LANGUAGE_RULE "read each line out loud" + globalRules "conversational —
// contractions, short sentences, spoken naturally"), ported into POSITIVE framing (no WRONG:/RIGHT: pairs,
// per §14) and scoped to the WHOLE script, not just the hook. Interim baseline — a deeper research-grounded
// scriptwriting standard (NotebookLM) layers on top of this in a second pass.
export const SPOKEN_REGISTER = `
SPOKEN REGISTER — every spokenLine is said OUT LOUD by the coach to their phone camera. Write each line the
way they would actually SAY it to one person across a table:
- Everyday contractions — you're, don't, it's, I've, that's, here's.
- Short, breath-length sentences — one idea per breath. Let a line end where a real person would pause.
- The rhythm of talking, not writing — plain spoken words a 13-year-old would use out loud.
- Every line passes the READ-ALOUD test: say it out loud and it sounds like a real person telling a friend
  the truth. If it sounds like a sentence off a landing page, it belongs to the page, not the mouth.
This applies to EVERY scene — the hook AND the body AND the CTA — not just the opening line.
`;

export const REAL_URGENCY_RULE = `
REAL-URGENCY RULE (only when the hook is direct_offer_urgency): express urgency ONLY from a genuine,
coach-supplied deadline or offer. NEVER invent scarcity — no "expires tonight", "gone forever", "price
doubles at midnight", fake countdowns, or guaranteed-income claims. If no real deadline exists, use a
non-urgency close instead. This copy is screened by Meta ad-policy filters.
`;
