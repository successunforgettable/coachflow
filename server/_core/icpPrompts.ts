/**
 * ICP prompt functions — the SINGLE source for every ICP generation path.
 *
 * Callers: icps.generate (sync), icps.generateAsync, icpEnrichment (import fill),
 * icpAngleSuggestions.generateICPs (angle-focused). Keeping them here prevents the
 * paths from drifting apart and removes the circular dependency risk of importing
 * from a router file.
 *
 * ── Angle focus (2026-07-26) ────────────────────────────────────────────────
 * icpAngleSuggestions previously carried its OWN near-verbatim copy of this
 * prompt. That copy silently missed every improvement made here (and ran without
 * the compliance filter). The angle is now a PARAMETER of this one prompt.
 *
 * ── Class A REMOVED (2026-07-26) ────────────────────────────────────────────
 * demographics, mediaConsumption and influencers are NO LONGER GENERATED. Three
 * reasons, in order of weight:
 *   1. No downstream generator reads any of them — verified across all twelve
 *      (adCopy, landingPage, email, whatsapp, headlines, offers, hvco,
 *      heroMechanisms, bonus, leadMagnetContent, concept, conceptScript).
 *   2. They are fossils of interest-based Meta targeting. Andromeda made the
 *      CREATIVE the targeting instrument, so a list of assumed interests and
 *      followed accounts no longer feeds anything.
 *   3. influencers/mediaConsumption invented NAMED REAL PEOPLE and publications
 *      and stated them as fact about a coach's audience — the highest fabrication
 *      risk in the system.
 *
 * The DB columns are kept (dormant, empty) so nothing breaks and a future
 * ICP-powered tool can populate them from real or coach-supplied data. The vivid
 * internal-monologue sections are UNCHANGED: a measured A/B on two real profiles
 * showed the "this is me" quality lives in that prose, never in these three.
 *
 * Removing them also dissolves a structural bug: the nested demographics object
 * was the thing the model kept flattening into seven extra top-level keys, which
 * no amount of prompt wording fixed. There is no nested object left to flatten.
 */

import { getGlobalNegativePrompts } from "../lib/complianceFilter";

export type ICPServiceInput = {
  name: string;
  category: string | null;
  description: string | null;
  targetCustomer: string | null;
  mainBenefit: string | null;
  /**
   * Per-field provenance map for the buyer-intel fields below, read straight from
   * `services.buyerIntelSource` (migration 0108). Absent or NULL resolves to `extracted`
   * — see resolveBuyerIntelTier for why that direction is deliberate.
   */
  buyerIntelSource?: unknown;
  /**
   * What the coach stated is NOT true of this buyer (migration 0109). Rendered as its own
   * block, ABOVE the buyer-intel blocks, because it constrains them: the intel is a
   * hypothesis and this is something the coach actually said.
   */
  buyerNegatives?: string | null;
  /**
   * Buyer intel about the buyer, carried on the `services` row. Historically described as
   * "what the coach typed"; measured 2026-09-02, these fields are written by expandProfile
   * on every path a coach actually takes, so provenance is now recorded per field rather
   * than assumed. Every field is optional and a blank field is OMITTED from the prompt
   * entirely, never rendered as a placeholder.
   *
   * Every
   * field is optional and most coaches leave several blank — a blank field is
   * OMITTED from the prompt entirely, never rendered as a placeholder.
   *
   * uniqueMechanismSuggestion is deliberately NOT here: it describes the
   * SOLUTION, Node 4 generates the method downstream, and feeding it in would
   * produce an ICP that assumes the buyer already knows the mechanism — R3's
   * "Aspirational Fantasy" awareness mismatch.
   */
  painPoints?: string | null;
  whyProblemExists?: string | null;
  failedSolutions?: string | null;
  falseBeliefsVsRealReasons?: string | null;
  hiddenReasons?: string | null;
  avatarName?: string | null;
  avatarTitle?: string | null;
};

/** Angle focus for the icpAngleSuggestions path. */
export type ICPAngleInput = {
  angleName: string;
  description: string | null;
  primaryPain: string | null;
  primaryBuyingTrigger: string | null;
};

/**
 * Laddered follow-up answers (R2 "5 Rings", translated coach→individual).
 * Every field is optional — a coach with no client history skips them and their
 * profile is legitimately mostly inferred. Keys mirror the intake question order.
 */
export type ICPLadderAnswers = {
  /** Priority Initiative — what was going on when the last client reached out. */
  trigger?: string | null;
  /** Prior attempts / market sophistication — what they already tried. */
  priorAttempts?: string | null;
  /** Perceived barrier — what nearly stopped them saying yes. */
  hesitation?: string | null;
  /** Success factor — what made it worth it, in their words. */
  successMoment?: string | null;
};

export type ICPPromptOptions = {
  angle?: ICPAngleInput | null;
  ladder?: ICPLadderAnswers | null;
  /** Extra authoritative content (imported ICP fields) appended verbatim. */
  seedBlock?: string | null;
};

export const ICP_LADDER_KEYS = ["trigger", "priorAttempts", "hesitation", "successMoment"] as const;

/** Human-readable labels for the laddered answers, used in the prompt block. */
const LADDER_LABELS: Record<keyof ICPLadderAnswers, string> = {
  trigger: "What was happening in this person's life right before they reached out",
  priorAttempts: "What they had already tried that did not work",
  hesitation: "What nearly stopped them from going ahead",
  successMoment: "What made them say it was worth it",
};

/** True when at least one laddered answer carries content. */
export function hasLadderContent(ladder?: ICPLadderAnswers | null): boolean {
  if (!ladder) return false;
  return ICP_LADDER_KEYS.some((k) => typeof ladder[k] === "string" && (ladder[k] as string).trim().length > 0);
}

/**
 * The coach's own words, marked authoritative. Mirrors the phrasing proven on the
 * import path (icpEnrichment) so both paths ground the same way.
 */
export function buildLadderBlock(ladder?: ICPLadderAnswers | null): string {
  if (!hasLadderContent(ladder)) return "";
  const lines: string[] = [];
  for (const k of ICP_LADDER_KEYS) {
    const v = ladder?.[k];
    if (typeof v === "string" && v.trim().length > 0) {
      lines.push(`${LADDER_LABELS[k]}: ${v.trim()}`);
    }
  }
  return `

WHAT THE COACH TOLD US ABOUT REAL CLIENTS — treat this as authoritative. It comes from people they have actually worked with, so it outranks anything you would otherwise assume, including the coach's general description of this buyer above. Build the sections below on these specifics, keep the coach's own wording where it is vivid, and stay consistent with this account of the customer.

${lines.join("\n")}`;
}

/**
 * The coach's own buyer intel, in ONE ordered list.
 *
 * ⚠️ THE PROMPT AND THE GROUNDING CORPUS BOTH READ THIS LIST — buildBuyerIntelBlock
 * here, and buildIcpInputCorpus in icpGrounding.ts. Never inline a second copy.
 *
 * A field the prompt shows but the corpus does not know about is worse than a
 * field nobody reads: the model faithfully repeats the coach's own words, and
 * `unsupportedProperNouns` then flags them as `icp_named_third_party` — a Class-A
 * hit which is RETRYABLE, so the coach's own facts burn all three generation
 * attempts. The two lists drifting apart is the failure mode, so there is one list.
 */
export const ICP_BUYER_INTEL_FIELDS: ReadonlyArray<{ key: keyof ICPServiceInput; label: string }> = [
  { key: "painPoints", label: "Pain points the coach says this buyer feels daily" },
  { key: "whyProblemExists", label: "Why the coach says this problem exists at all" },
  { key: "failedSolutions", label: "What this buyer already tried, and why it did not work" },
  { key: "falseBeliefsVsRealReasons", label: "What the buyer believes is stopping them, versus what actually is" },
  { key: "hiddenReasons", label: "Reasons behind the problem this buyer would never admit out loud" },
  { key: "avatarName", label: "What the coach calls this buyer" },
  { key: "avatarTitle", label: "This buyer's role or situation" },
];

/** True when the coach filled at least one buyer-intel field. */
export function hasBuyerIntel(service: ICPServiceInput): boolean {
  return ICP_BUYER_INTEL_FIELDS.some(({ key }) => {
    const v = service[key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/**
 * The coach's own buyer intel, marked as ground truth about the person.
 * Blank fields are omitted entirely — never printed as "Not specified", which
 * is noise the model treats as content and which the prompt tests forbid.
 */
export type BuyerIntelTier = "coach_stated" | "extracted" | "guarded_fallback";

/**
 * Per-field provenance for the seven buyer-intel fields, as stored in
 * `services.buyerIntelSource` (migration 0108).
 *
 * ⚠️ NULL / ABSENT RESOLVES TO `extracted`, NOT to `coach_stated`. That direction is the whole
 * point of this fix: measured 2026-09-02, 4 of 35 completed kits carried enrichment output that
 * CONTRADICTED the coach's own typed description — three of them profiling an entirely different
 * business — and every buyer-intel field on every pre-tagging row was written by expandProfile,
 * never by a coach. Defaulting an unknown to "the coach said this" is the claim that caused the
 * damage; defaulting it to "generated" is merely conservative.
 */
export function resolveBuyerIntelTier(
  source: unknown,
  key: string,
): BuyerIntelTier {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const v = (source as Record<string, unknown>)[key];
    if (v === "coach_stated" || v === "extracted" || v === "guarded_fallback") return v;
  }
  return "extracted";
}

/**
 * The coach's stated negative. Emitted ABOVE the buyer-intel blocks so the model reads the
 * constraint before the sketch it constrains, and phrased so a "not" is treated as a fact the
 * coach supplied rather than as a gap to be filled.
 */
export function buildBuyerNegativesBlock(service: ICPServiceInput): string {
  const v = typeof service.buyerNegatives === "string" ? service.buyerNegatives.trim() : "";
  if (!v) return "";
  return `

NOT TRUE OF THIS BUYER — the coach stated this explicitly, and it is ground truth about the person. It outranks anything below that would describe them otherwise. Where a section would otherwise assume experience, behaviour or intent that this rules out, write the section for the person the coach actually described.

${v}`;
}

export function buildBuyerIntelBlock(service: ICPServiceInput): string {
  if (!hasBuyerIntel(service)) return "";

  const source = (service as { buyerIntelSource?: unknown }).buyerIntelSource;
  const coachLines: string[] = [];
  const generatedLines: string[] = [];

  for (const { key, label } of ICP_BUYER_INTEL_FIELDS) {
    const v = service[key];
    if (typeof v === "string" && v.trim().length > 0) {
      const line = `${label}: ${v.trim()}`;
      if (resolveBuyerIntelTier(source, String(key)) === "coach_stated") coachLines.push(line);
      else generatedLines.push(line);
    }
  }

  // The coach's own material keeps its authority, and is emitted FIRST so that the generated
  // sketch below is read against it rather than the other way round.
  const coachBlock = coachLines.length
    ? `

WHAT THE COACH ALREADY TOLD US ABOUT THIS BUYER — treat this as ground truth about the person, not as background colour. These are the coach's own words about the buyer they actually serve. Build the sections below on these specifics and keep their phrasing wherever it is vivid. Where this conflicts with what you would otherwise assume, this wins.

${coachLines.join("\n")}`
    : "";

  // Generated material is named as generated, and is subordinated to the coach's own words.
  // Wording is the product-owner's, verbatim (2026-09-02) — do not paraphrase it.
  const generatedBlock = generatedLines.length
    ? `

A WORKING HYPOTHESIS ABOUT THIS BUYER — GENERATED, NOT SUPPLIED BY THE COACH.

The lines below were produced by an earlier automated pass over the same service description shown above. They are one plausible sketch of the buyer, useful for specificity wherever they agree with what the coach actually wrote.

The coach's own words above — Description, Target Customer and Main Benefit — are the authority here. Anything you carry forward from this sketch must describe the same person, the same experience level and the same business those words describe. Where the sketch points somewhere else, follow the coach's words and leave the sketch behind.

${generatedLines.join("\n")}`
    : "";

  return `${coachBlock}${generatedBlock}`;
}

export function ICP_SYSTEM_PROMPT(): string {
  return `You are an expert direct response copywriter who writes Ideal Customer Profiles from inside the customer's head — using their internal monologue, not a textbook description. You write in the specific language of this niche, not generic marketing language. Every answer must be so specific that the customer reads it and thinks "this is about me."

You profile the DECISION, not the person: what makes this buyer act, what makes them hesitate, and what they have to believe before they can say yes. Everything the coach has told you is ground truth — build on their exact words wherever they gave you any. Where they told you nothing, you are writing a hypothesis about one specific person, so keep it inside that person's own voice and uncertainty; never state an outside fact you were not given. Never name a real person, brand, publication, product or competitor the coach did not name.

Always respond with valid JSON. Never produce content containing: ${getGlobalNegativePrompts().join(", ")}.`;
}

export function ICP_USER_PROMPT(service: ICPServiceInput, opts?: ICPPromptOptions): string {
  const angle = opts?.angle ?? null;

  const angleBlock = angle
    ? `

FOCUS THIS ICP ON THIS SPECIFIC AUDIENCE ANGLE:
Angle name: ${angle.angleName}
Who this person is: ${angle.description ?? ""}
Their primary pain: ${angle.primaryPain ?? ""}
What would make them buy: ${angle.primaryBuyingTrigger ?? ""}

All 14 sections must reflect this specific type of person — not a generic customer. Every answer must be so specific that this person reads it and thinks "this is about me."`
    : "";

  const angleIntroSuffix = angle ? ` Reference the angle: ${angle.angleName}.` : "";
  const angleTriggerSuffix = angle?.primaryBuyingTrigger
    ? ` Reference the angle's buying trigger: ${angle.primaryBuyingTrigger}.`
    : "";
  const anglePsychoSuffix = angle ? " and angle-specific" : "";

  return `Create a detailed Ideal Customer Profile (ICP) for the following service. Write from INSIDE the customer's head — use their internal monologue, not a textbook description of them.

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}${angleBlock}${buildBuyerNegativesBlock(service)}${buildBuyerIntelBlock(service)}${buildLadderBlock(opts?.ladder)}${opts?.seedBlock ?? ""}

VOICE RULES — apply to every section:
- Write as if you are narrating the customer's internal experience, not describing them from the outside
- Use specific situations, not generic emotions ("It's 2am and I'm refreshing my inbox again" not "they feel anxious")
- Every bullet point must be niche-specific — if it could appear in any coach's ICP, rewrite it
- Use the language they use with a close friend, not the language they'd use in a job interview

CALIBRATE BEFORE YOU WRITE — these four judgements shape every section below. Do not output them as sections; they decide the content of the 14.

• AWARENESS. Decide where this buyer's head actually is today, and write every section from that point — not from where the coach wishes they were. Unaware: does not yet name this as a problem. Problem-aware: feels the pain, does not know help like this exists. Solution-aware: knows this kind of help exists, has not chosen who. Product-aware: comparing specific people and offers. Most-aware: ready, waiting on a reason to act now. A profile written a stage ahead of the buyer reads as fantasy to them.

• SOPHISTICATION. Decide how many times this buyer has already been sold to in this niche. The more they have heard, the more a plain claim bounces off, and the more the specific mechanism and the specific situation carry the weight. Their scepticism is a fact about them — write it into their voice.

• PRIOR ATTEMPTS. What has this person already tried, and what did it cost them in money, time and self-belief when it did not work? A buyer on their fourth attempt is a different person from one on their first, and everything below changes with it.

• IDENTITY AND THE REAL JOB. Name who they are trying to become, not only what they want to get. People buy the version of themselves the purchase makes possible, and they hire an offer to do one specific job in their life. Say what that job is.

WHO THIS IS NOT — write the profile narrowly enough that it excludes people. If it would fit most of this coach's possible customers, it is too broad to be useful; narrow it to the single most specific person the coach's information supports. Precision is disciplined exclusion, not a bigger net.

Generate a comprehensive ICP with ALL 14 sections:

1. INTRODUCTION: 2-3 paragraphs. Who is this person right now — their current situation, their daily life, their stuck state. Use their internal voice. Name their niche, their role, their specific problem.${angleIntroSuffix}

2. FEARS: 5-7 fears. Each fear = the 3am version — the thought that wakes them at 3am, not the polite daytime version. Format: "I lie awake worrying that [specific fear]..." Not: "They fear failure." Cover the four risks that actually stall a decision: the effort and capacity it will take, what the people close to them will think if it fails, what they lose by abandoning the way they do things now, and the money itself.

3. HOPES & DREAMS: 5-7 hopes. Each must name a SPECIFIC desired situation — what their life looks like on the day everything has worked. Not feelings. Situations. At least two must name the person they become in that situation, not only what they get — the identity they are buying their way into.


4. PSYCHOGRAPHICS: 3-4 paragraphs. Personality traits, lifestyle, attitudes, interests — all niche-specific${anglePsychoSuffix}. How do they spend the hours they are not working? What do they turn to when they want to switch off? What opinions do they hold strongly in this space?

5. PAINS: 7-10 pains. Each pain = a specific daily situation, not an emotion. Write every one in the FIRST PERSON, in this buyer's own voice, the same way the fears and buying triggers are written — one profile, one voice throughout. Format: "Every [day/week/month], I [specific situation that happens to me]." Not: "They struggle with marketing." Write the lived situation that makes the problem urgent and expensive to ignore, not the category it belongs to — name what it is costing me this week, in a way I can picture.

6. FRUSTRATIONS: 5-7 frustrations. The things that make them say "WHY does this always happen to me?" — niche-specific, situational, specific enough to recognise themselves in.

7. GOALS: 6-8 goals. Each goal = a specific outcome they can picture — a number, a situation, a moment. Not "grow their business." What does it look and feel like when they've succeeded?

8. VALUES: 5-7 values. Not generic values (hard work, family). The values that CONFLICT with what they need to do to solve their problem — the values that make them resist buying or taking action.

9. OBJECTIONS: 5-7 objections. Each objection = the REAL reason they won't buy — not the polite reason they'd tell a salesperson. Format: "What they say: [polite objection]. What they mean: [real objection]."

10. BUYING TRIGGERS: 5-7 triggers. Each trigger = the SPECIFIC MOMENT that breaks the dam — the event, conversation, or realisation that pushes them from considering to buying. "The moment I knew I had to do something was when..."${angleTriggerSuffix}



11. COMMUNICATION STYLE: How they prefer to communicate — specific to their niche and situation. What turns them off? What makes them trust someone?

12. DECISION MAKING: How they actually make purchasing decisions — who they consult, how long they take, what triggers action vs paralysis.

13. SUCCESS METRICS: How they measure whether something has worked — their specific KPIs, the numbers they track, the feeling they're chasing.

14. IMPLEMENTATION BARRIERS: What stops them from taking action AFTER they've decided to buy — the real friction points, niche-specific.

Format as JSON with these exact keys (use bullet points • for lists where appropriate):
{
  "introduction": "...",
  "fears": "• Fear 1\\n• Fear 2\\n...",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n...",
  "psychographics": "...",
  "pains": "• Pain 1\\n• Pain 2\\n...",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n...",
  "goals": "• Goal 1\\n• Goal 2\\n...",
  "values": "• Value 1\\n• Value 2\\n...",
  "objections": "• Objection 1\\n• Objection 2\\n...",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n...",
  "communicationStyle": "...",
  "decisionMaking": "...",
  "successMetrics": "...",
  "implementationBarriers": "..."
}`;
}

/** The 16 text section keys (demographics handled separately). */
/**
 * The 14 generated sections. demographics / mediaConsumption / influencers are
 * deliberately absent — see the Class A REMOVED note at the top of this file.
 */
export const ICP_TEXT_SECTION_KEYS = [
  "introduction", "fears", "hopesDreams", "psychographics", "pains", "frustrations",
  "goals", "values", "objections", "buyingTriggers",
  "communicationStyle", "decisionMaking", "successMetrics", "implementationBarriers",
] as const;

/** No longer generated. Kept so a future tool can populate the dormant columns. */
export const ICP_RETIRED_SECTION_KEYS = ["demographics", "mediaConsumption", "influencers"] as const;

export const ICP_DEMOGRAPHIC_KEYS = [
  "age_range", "gender", "income_level", "education", "occupation", "location", "family_status",
] as const;

/**
 * The ONE json_schema for ICP generation. Previously duplicated verbatim in four
 * places (icps.generate, icps.generateAsync, icpEnrichment, icpAngleSuggestions).
 */
export const ICP_JSON_SCHEMA: { name: string; schema: Record<string, unknown>; strict?: boolean } = {
  name: "ideal_customer_profile_17_tabs",
  strict: true,
  schema: {
    type: "object",
    properties: Object.fromEntries(ICP_TEXT_SECTION_KEYS.map((k) => [k, { type: "string" }])),
    required: [...ICP_TEXT_SECTION_KEYS],
    additionalProperties: false,
  },
};
