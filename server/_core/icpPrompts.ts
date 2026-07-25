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
 * ── Class A grounding (2026-07-26) ──────────────────────────────────────────
 * Sections 4 (demographics), 12 (media consumption) and 13 (influencers) state
 * verifiable facts about real people and named real entities. They carry only what
 * the coach's own information supports. The vivid internal-monologue sections are
 * deliberately UNCHANGED — a measured A/B on two real profiles showed the
 * "this is me" quality lives in that prose, not in invented income brackets.
 *
 * The grounding rules are written INTO sections 4/12/13 in place. An earlier draft
 * appended a second block that re-numbered "4. DEMOGRAPHICS"; the duplicate section
 * number garbled the tool-call and flattened the demographics object into six
 * top-level keys on 1 of 2 runs. One numbered section, stated once.
 */

import { getGlobalNegativePrompts } from "../lib/complianceFilter";

export type ICPServiceInput = {
  name: string;
  category: string | null;
  description: string | null;
  targetCustomer: string | null;
  mainBenefit: string | null;
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

WHAT THE COACH TOLD US ABOUT REAL CLIENTS — treat this as authoritative. It comes from people they have actually worked with, so it outranks anything you would otherwise assume. Build the sections below on these specifics, keep the coach's own wording where it is vivid, and stay consistent with this account of the customer.

${lines.join("\n")}`;
}

export function ICP_SYSTEM_PROMPT(): string {
  return `You are an expert direct response copywriter who writes Ideal Customer Profiles from inside the customer's head — using their internal monologue, not a textbook description. You write in the specific language of this niche, not generic marketing language. Every answer must be so specific that the customer reads it and thinks "this is about me." Always respond with valid JSON. Never produce content containing: ${getGlobalNegativePrompts().join(", ")}.`;
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

All 17 sections must reflect this specific type of person — not a generic customer. Every answer must be so specific that this person reads it and thinks "this is about me."`
    : "";

  const angleIntroSuffix = angle ? ` Reference the angle: ${angle.angleName}.` : "";
  const angleTriggerSuffix = angle?.primaryBuyingTrigger
    ? ` Reference the angle's buying trigger: ${angle.primaryBuyingTrigger}.`
    : "";
  const angleDemoSuffix = angle ? ` for this angle: ${angle.angleName}` : " for this exact niche";
  const anglePsychoSuffix = angle ? " and angle-specific" : "";

  return `Create a detailed Ideal Customer Profile (ICP) for the following service. Write from INSIDE the customer's head — use their internal monologue, not a textbook description of them.

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}${angleBlock}${buildLadderBlock(opts?.ladder)}${opts?.seedBlock ?? ""}

VOICE RULES — apply to every section:
- Write as if you are narrating the customer's internal experience, not describing them from the outside
- Use specific situations, not generic emotions ("It's 2am and I'm refreshing my inbox again" not "they feel anxious")
- Every bullet point must be niche-specific — if it could appear in any coach's ICP, rewrite it
- Use the language they use with a close friend, not the language they'd use in a job interview

GROUNDING — applies to sections 4, 12 and 13 only:
Those three sections state checkable facts about real people and name real public figures, so they carry what the information above supports. The information above is what you know about this audience; where it settles a detail, use it, and where it does not, say so plainly using the wording given in those sections. Every other section keeps the voice rules above in full — same specificity, same internal monologue, same lived detail.

Generate a comprehensive ICP with ALL 17 sections:

1. INTRODUCTION: 2-3 paragraphs. Who is this person right now — their current situation, their daily life, their stuck state. Use their internal voice. Name their niche, their role, their specific problem.${angleIntroSuffix}

2. FEARS: 5-7 fears. Each fear = the 3am version — the thought that wakes them at 3am, not the polite daytime version. Format: "I lie awake worrying that [specific fear]..." Not: "They fear failure."

3. HOPES & DREAMS: 5-7 hopes. Each must name a SPECIFIC desired situation — what their life looks like on the day everything has worked. Not feelings. Situations.

4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status${angleDemoSuffix}. Each value carries what the information above states or directly implies about this audience. Where the information above leaves a value open, that value is the exact text "Not specified" — the coach fills it in later from what they know about their own clients.

5. PSYCHOGRAPHICS: 3-4 paragraphs. Personality traits, lifestyle, attitudes, interests — all niche-specific${anglePsychoSuffix}. How do they spend the hours they are not working? What do they turn to when they want to switch off? What opinions do they hold strongly in this space?

6. PAINS: 7-10 pains. Each pain = a specific daily situation, not an emotion. Format: "Every [day/week/month], [specific situation that happens to them]." Not: "They struggle with marketing."

7. FRUSTRATIONS: 5-7 frustrations. The things that make them say "WHY does this always happen to me?" — niche-specific, situational, specific enough to recognise themselves in.

8. GOALS: 6-8 goals. Each goal = a specific outcome they can picture — a number, a situation, a moment. Not "grow their business." What does it look and feel like when they've succeeded?

9. VALUES: 5-7 values. Not generic values (hard work, family). The values that CONFLICT with what they need to do to solve their problem — the values that make them resist buying or taking action.

10. OBJECTIONS: 5-7 objections. Each objection = the REAL reason they won't buy — not the polite reason they'd tell a salesperson. Format: "What they say: [polite objection]. What they mean: [real objection]."

11. BUYING TRIGGERS: 5-7 triggers. Each trigger = the SPECIFIC MOMENT that breaks the dam — the event, conversation, or realisation that pushes them from considering to buying. "The moment I knew I had to do something was when..."${angleTriggerSuffix}

12. MEDIA CONSUMPTION: The KINDS of places this person looks for help — the format they reach for (a long forum thread, a short video, a podcast episode on a commute, a newsletter they actually open), the moment they reach for it, and what they are searching for when they do. Name a specific show, newsletter, publication or community only where the information above names it.

13. INFLUENCERS: The KINDS of voices this person already trusts — the role that gives someone credibility with them (a clinician, a peer one step ahead, a practitioner who shows their working), what earns that trust in the first thirty seconds, and what makes them dismiss someone instantly. Name a specific individual only where the information above names them.

14. COMMUNICATION STYLE: How they prefer to communicate — specific to their niche and situation. What turns them off? What makes them trust someone?

15. DECISION MAKING: How they actually make purchasing decisions — who they consult, how long they take, what triggers action vs paralysis.

16. SUCCESS METRICS: How they measure whether something has worked — their specific KPIs, the numbers they track, the feeling they're chasing.

17. IMPLEMENTATION BARRIERS: What stops them from taking action AFTER they've decided to buy — the real friction points, niche-specific.

Format as JSON with these exact keys (use bullet points • for lists where appropriate):
{
  "introduction": "...",
  "fears": "• Fear 1\\n• Fear 2\\n...",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n...",
  "demographics": { ... },
  "psychographics": "...",
  "pains": "• Pain 1\\n• Pain 2\\n...",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n...",
  "goals": "• Goal 1\\n• Goal 2\\n...",
  "values": "• Value 1\\n• Value 2\\n...",
  "objections": "• Objection 1\\n• Objection 2\\n...",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n...",
  "mediaConsumption": "...",
  "influencers": "...",
  "communicationStyle": "...",
  "decisionMaking": "...",
  "successMetrics": "...",
  "implementationBarriers": "..."
}`;
}

/** The 16 text section keys (demographics handled separately). */
export const ICP_TEXT_SECTION_KEYS = [
  "introduction", "fears", "hopesDreams", "psychographics", "pains", "frustrations",
  "goals", "values", "objections", "buyingTriggers", "mediaConsumption", "influencers",
  "communicationStyle", "decisionMaking", "successMetrics", "implementationBarriers",
] as const;

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
    properties: {
      ...Object.fromEntries(ICP_TEXT_SECTION_KEYS.map((k) => [k, { type: "string" }])),
      demographics: {
        type: "object",
        properties: Object.fromEntries(ICP_DEMOGRAPHIC_KEYS.map((k) => [k, { type: "string" }])),
        required: [...ICP_DEMOGRAPHIC_KEYS],
        additionalProperties: false,
      },
    },
    required: [...ICP_TEXT_SECTION_KEYS, "demographics"],
    additionalProperties: false,
  },
};
