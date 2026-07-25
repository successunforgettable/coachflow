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
These words appear in every ad on the internet; they trigger the part of the brain that skips ads.
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

export const REAL_URGENCY_RULE = `
REAL-URGENCY RULE (only when the hook is direct_offer_urgency): express urgency ONLY from a genuine,
coach-supplied deadline or offer. NEVER invent scarcity — no "expires tonight", "gone forever", "price
doubles at midnight", fake countdowns, or guaranteed-income claims. If no real deadline exists, use a
non-urgency close instead. This copy is screened by Meta ad-policy filters.
`;
