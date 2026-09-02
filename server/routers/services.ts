import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { filterRecord, getGlobalNegativePrompts } from "../lib/complianceFilter";
import { BANNED_COPYWRITING_WORDS, BANNED_MECHANISM_NAMES } from "../_core/copywritingRules";

const createServiceSchema = z.object({
  // ⚠️ DELIBERATELY NO `.min(1)` — REMOVED, NOT OMITTED. 298c6c6 added one here to mirror
  // updateServiceSchema. It is removed again by the name ladder below, and the reason is
  // worth keeping so nobody restores it as an obvious missing guard:
  //
  //   `.min(1)` REJECTS a blank name. The ladder GUARANTEES a blank never survives.
  //   Both cannot run — `.min(1)` throws at input validation, before the ladder could
  //   resolve anything, and the throw lands in V2TrailIntake's bare `catch` (~L283) whose
  //   "Try again" chip replays the identical empty payload. A coach who describes their
  //   business without naming their programme would loop there forever.
  //
  // `.min(1)` was also never sufficient: it accepts "   ", which sanitizePlaceholder then
  // converts to "". The ladder covers that case and every other client call site.
  // See resolveServiceName below. Arfeen's ruling, 2026-08-30 (CHECKPOINT §"THE DECIDED FIX").
  name: z.string().max(255),
  category: z.enum(["coaching", "speaking", "consulting"]),
  description: z.string(),
  targetCustomer: z.string().max(500),
  mainBenefit: z.string().max(500),
  // The coach's stated negative (0109). Optional: most coaches state none, and an absent
  // negative is a legitimate answer, never a gap.
  buyerNegatives: z.string().max(1000).optional(),
  price: z.number().optional(),
});

// Defense-in-depth: strip stale client placeholder strings so they never persist as real data.
// Covers cached pre-d38437a bundles that still send old defaults.
export const PLACEHOLDER_DEFAULTS = new Set([
  "new campaign",
  "my ideal client",
  "transform their results",
  "to be defined",
]);

export const sanitizePlaceholder = (v: string | null | undefined): string =>
  !v || !v.trim() || PLACEHOLDER_DEFAULTS.has(v.trim().toLowerCase()) ? "" : v;

// ── THE SERVICE-NAME LADDER (increment two — Arfeen's ruling, 2026-08-30) ───────────
//
// "Never blank. Always tagged with which tier it came from."
//
// Vocabulary is deliberately IDENTICAL to Node 4's `heroMechanisms.sourceTier`
// (drizzle/0104_coach_method.sql) — the ruling was "Node 4's sourceTier ladder,
// generalised", and one vocabulary across both ladders makes a later audit one query.
//
//   coach_stated     — the coach typed it
//   extracted        — built from the coach's own supplied words (category + who they help)
//   guarded_fallback — nothing to build from; a deterministic, category-shaped name
//
// 🔴 TIER 2 IS DETERMINISTIC. NO LLM CALL, BY RULING, NOT BY CONVENIENCE:
//   "Defer makes the product name another generated field, and the finding of today is
//    that GENERATED FIELDS GROUND GENERATED FIELDS. Filling this blank with generated
//    text is THE DISEASE APPLIED TO THE CURE."
// Anything added here that calls a model reintroduces exactly what that ruling rejected.
export type ServiceNameSource = "coach_stated" | "extracted" | "guarded_fallback";

const CATEGORY_NOUN: Record<string, string> = {
  coaching: "Coaching",
  speaking: "Speaking",
  consulting: "Consulting",
};

// Tier 3 only. Reached when the coach supplied neither a name nor a target customer.
const CATEGORY_FALLBACK_NAME: Record<string, string> = {
  coaching: "Coaching Programme",
  speaking: "Speaking Engagement",
  consulting: "Consulting Engagement",
};

/** Cut to a word boundary at or under `max`, so tier 2 never ends mid-word. */
const cutToWord = (v: string, max: number): string => {
  const flat = v.trim().replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  const clipped = flat.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  // No space in the window means one very long token — hard-cut rather than return "".
  return (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\-–—]+$/, "");
};

/**
 * Resolve the name that will be written, and the tier it came from.
 *
 * Called AFTER sanitizePlaceholder, so "", "   " and "To be defined" all arrive here as
 * "" and are treated identically — that is deliberate, and it is what makes this cover
 * every client call site rather than only the ones with a blank-name bug.
 *
 * Total by construction: `category` is a non-optional enum on both the create schema and
 * the DB, so CATEGORY_FALLBACK_NAME always resolves. The `?? ` defaults are belt-and-braces
 * for a category that somehow arrives outside the enum — a free runtime check, kept on
 * purpose (§15j), not dead code awaiting cleanup.
 */
export function resolveServiceName(input: {
  name: string;
  category: string;
  targetCustomer: string;
}): { name: string; nameSource: ServiceNameSource } {
  // ── Tier 1 — the coach typed it ──
  const stated = input.name.trim();
  if (stated) return { name: stated.slice(0, 255), nameSource: "coach_stated" };

  // ── Tier 2 — built from the coach's own words: what they do, and who for ──
  // "Coaching for overwhelmed founders". Grounded in targetCustomer, which the coach
  // supplied (or which the extractor read back from what they typed).
  //
  // Rejected alternative, recorded so it is not re-proposed: chopping the first clause
  // off `description`. It is the more literal reading of "derived from their own typed
  // description" and it produces fragments — "Helping Overwhelmed Founders Get Their" —
  // which then propagate into landing-page brand slots and `Product:` title prompts.
  const who = cutToWord(sanitizePlaceholder(input.targetCustomer), 60);
  if (who) {
    const noun = CATEGORY_NOUN[input.category] ?? "Coaching";
    return { name: `${noun} for ${who}`.slice(0, 255), nameSource: "extracted" };
  }

  // ── Tier 3 — nothing to build from ──
  return {
    name: CATEGORY_FALLBACK_NAME[input.category] ?? "Coaching Programme",
    nameSource: "guarded_fallback",
  };
}

/**
 * The seven buyer-intel fields whose provenance `services.buyerIntelSource` records.
 * Exported so the edit-detector and its tests read ONE list — a second copy would drift.
 */
export const BUYER_INTEL_KEYS = [
  "painPoints", "whyProblemExists", "failedSolutions",
  "falseBeliefsVsRealReasons", "hiddenReasons", "avatarName", "avatarTitle",
] as const;

/** Trim + collapse internal whitespace, so a cosmetic round-trip is not mistaken for authorship. */
const normaliseForCompare = (v: unknown): string =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";

/**
 * WHICH BUYER-INTEL FIELDS DID THE COACH ACTUALLY EDIT?
 *
 * ── THE DEFECT THIS REPLACES (2026-09-03) ───────────────────────────────────────────────────
 * The previous test was `typeof updateData[k] === "string"` — i.e. "the key is present in the
 * payload". PRESENCE IS NOT AUTHORSHIP. Every client form resends the fields it rendered:
 * `CreateServiceStep.tsx:183` resends ALL SEVEN, loaded straight from `result.expanded`, so a
 * coach who clicked through the review screen without touching a character had the ENTIRE
 * enrichment stamped `coach_stated` — and the ICP prompt then presented an invention as
 * "the coach's own words about the buyer they actually serve … this wins."
 * `V2GeneratorWizard.tsx:1098` resends painPoints; `ServiceDetail.tsx` resends three on any save,
 * including a category-only change.
 *
 * ── THE TEST NOW ────────────────────────────────────────────────────────────────────────────
 * A field is edited when the SUBMITTED value DIFFERS from the STORED value. The stored row is
 * already loaded for the ownership check, so this costs nothing. A diff is a demonstration of
 * authorship; a key in a payload is not (§15m).
 *
 * Both sides are normalised (trim, collapse internal whitespace) so a form that round-trips a
 * line ending or a trailing space does not manufacture authorship out of nothing.
 *
 * 🔴 FAILS IN THE SAFE DIRECTION. If this under-detects, a genuine coach edit stays tagged
 * `extracted` and the ICP treats real coach words as a hypothesis — a small loss of authority.
 * If it over-detects, invention is published as testimony. Those costs are not symmetrical.
 */
export function detectEditedIntelKeys(
  incoming: Record<string, unknown>,
  stored: Record<string, unknown>,
): string[] {
  return BUYER_INTEL_KEYS.filter((k) => {
    const sent = incoming[k];
    if (typeof sent !== "string") return false;      // not submitted at all
    return normaliseForCompare(sent) !== normaliseForCompare(stored[k]);
  });
}

const updateServiceSchema = z.object({
  id: z.number(),
  // `.trim()` before `.min(1)` — the same defect at a different door. `.min(1)` alone
  // accepts "   " (length 3), which is how a rename could still blank a name that the
  // create ladder had just guaranteed. Verified against the installed zod 4.3.6:
  // "   " is REJECTED and "  Hi " is stored as "Hi".
  name: z.string().trim().min(1).max(255).optional(),
  category: z.enum(["coaching", "speaking", "consulting"]).optional(),
  description: z.string().min(1).optional(),
  targetCustomer: z.string().min(1).max(500).optional(),
  mainBenefit: z.string().min(1).max(500).optional(),
  buyerNegatives: z.string().max(1000).optional(),
  price: z.number().optional(),
  // Social proof fields (Issue 2 fix)
  totalCustomers: z.number().optional(),
  averageRating: z.number().optional(),
  totalReviews: z.number().optional(),
  testimonial1Name: z.string().max(255).optional(),
  testimonial1Title: z.string().max(255).optional(),
  testimonial1Quote: z.string().max(1000).optional(),
  testimonial2Name: z.string().max(255).optional(),
  testimonial2Title: z.string().max(255).optional(),
  testimonial2Quote: z.string().max(1000).optional(),
  testimonial3Name: z.string().max(255).optional(),
  testimonial3Title: z.string().max(255).optional(),
  testimonial3Quote: z.string().max(1000).optional(),
  pressFeatures: z.string().max(1000).optional(),
  // Video authority badge stat
  socialProofStat: z.string().max(255).optional(),
  // AutoPop fields (Phase 39 FIX 2)
  whyProblemExists: z.string().optional(),
  hvcoTopic: z.string().max(300).optional(),
  mechanismDescriptor: z.enum(["AI", "System", "Framework", "Method", "Blueprint", "Process"]).optional(),
  applicationMethod: z.string().max(150).optional(),
  avatarName: z.string().max(100).optional(),
  avatarTitle: z.string().max(100).optional(),
  // AI-expanded onboarding fields (Item 1.1 — Build Plan March 1 2026)
  falseBeliefsVsRealReasons: z.string().optional(),
  failedSolutions: z.string().optional(),
  hiddenReasons: z.string().optional(),
  riskReversal: z.string().optional(),
  uniqueMechanismSuggestion: z.string().optional(),
  painPoints: z.string().optional(),
});

export const servicesRouter = router({
  // List all services for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    return await db
      .select()
      .from(services)
      .where(eq(services.userId, ctx.user.id))
      .orderBy(desc(services.createdAt));
  }),

  // Get single service by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!service) {
        throw new Error("Service not found");
      }
      
      return service;
    }),

  // Create new service
  create: protectedProcedure
    .input(createServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Sanitize known placeholder defaults from stale client bundles
      const sanitizedName = sanitizePlaceholder(input.name);
      const sanitizedTargetCustomer = sanitizePlaceholder(input.targetCustomer);

      // THE LADDER. Runs after sanitize, so "", "   " and "To be defined" are all
      // already "" by here and resolve identically. This is the guarantee that
      // `services.name` is never written blank, and it holds for ALL SEVEN client
      // call sites, not only the two that could send an empty string.
      const { name: resolvedName, nameSource } = resolveServiceName({
        name: sanitizedName,
        category: input.category,
        targetCustomer: sanitizedTargetCustomer,
      });

      const insertData: any = {
        userId: ctx.user.id,
        ...input,
        name: resolvedName,
        nameSource,
        description: sanitizePlaceholder(input.description),
        targetCustomer: sanitizedTargetCustomer,
        mainBenefit: sanitizePlaceholder(input.mainBenefit),
      };

      // PROOF THE LADDER RAN, and which rung answered. Without this, a non-blank name
      // cannot distinguish "the coach typed one" from "tier 3 caught a blank" — the
      // two outcomes are identical in the row until `nameSource` is read back, and
      // identical in the logs entirely. `sourceOfTruth`-style absence is not evidence.
      console.log(
        `[services.create] nameLadder userId=${ctx.user.id} tier=${nameSource} ` +
        `suppliedBlank=${sanitizedName === ""} nameLen=${resolvedName.length}`,
      );
      // Convert price to string for decimal field
      if (insertData.price !== undefined) {
        insertData.price = insertData.price.toString();
      }
      
      const result: any = await db.insert(services).values(insertData);
      
      // MySQL doesn't support RETURNING, fetch the inserted record
      const [newService] = await db
        .select()
        .from(services)
        .where(eq(services.id, result[0].insertId))
        .limit(1);
      
      return newService;
    }),

  /**
   * AI Profile Expansion — Item 1.1 (Build Plan March 1 2026)
   *
   * Called immediately after services.create during onboarding.
   * Uses the exact LLM prompt specified in the build plan.
   * Saves all 10 expanded fields to the service record BEFORE returning,
   * so values are persisted even if the user skips the review screen.
   */
  expandProfile: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership and get the service record
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!service) throw new Error("Service not found");

      // Determine which fields need to be generated vs already filled
      // Treat placeholder values ("To be defined") as empty — same logic as frontend
      const isPlaceholder = (v: string | null | undefined) =>
        !v?.trim() || v.trim().toLowerCase() === 'to be defined';
      const needsName = isPlaceholder(service.name);
      const needsDescription = isPlaceholder(service.description);
      const needsTargetCustomer = isPlaceholder(service.targetCustomer);
      const needsMainBenefit = isPlaceholder(service.mainBenefit);

      // OBSERVABILITY. Every one of the four client call sites swallows a failure here
      // (V2TrailIntake 439/544/992, V2AutoModeIntakeConfirm 303), and there is no central
      // tRPC error logger, so a failed enrichment was previously INVISIBLE. Without this
      // pair, `blank = 0` on the verification query cannot distinguish the name backfill
      // WORKING from enrichment NEVER RUNNING — the same shape as a check that cannot fire.
      // Failure count = (start lines) - (done lines). Logging only: the non-fatal client
      // behaviour is deliberately unchanged.
      console.log(
        `[expandProfile] start serviceId=${input.serviceId} userId=${ctx.user.id} ` +
        `needsName=${needsName} needsDescription=${needsDescription} ` +
        `needsTargetCustomer=${needsTargetCustomer} needsMainBenefit=${needsMainBenefit}`,
      );

      const prompt = `You are a world-class direct response copywriter and market researcher applying the Jobs-To-Be-Done framework.

A coach/consultant has described their service:
- Name: ${service.name}${service.description?.trim() ? `\n- Description: ${service.description}` : ""}${service.targetCustomer?.trim() ? `\n- Target Customer: ${service.targetCustomer}` : ""}${service.mainBenefit?.trim() ? `\n- Main Benefit: ${service.mainBenefit}` : ""}
${service.buyerNegatives?.trim() ? `
NOT TRUE OF THIS BUYER — the coach stated this explicitly. Every field below must be consistent with it. Where a plausible pain point or failed solution would require something this rules out, write one that does not.
${service.buyerNegatives.trim()}
` : ""}
Generate a complete marketing intelligence profile for a coach in this niche.

SPECIFICITY RULES — every field must pass this test:
- Find ONE word or phrase that is niche-specific (an industry term, a role title, a platform name, a specific frustration) and build each answer around it
- If the answer could apply to any coach in any niche, it is too generic — rewrite it
- Use the language the customer uses when talking to a friend, not polished marketing language

BANNED PHRASES — never use in any field: ${BANNED_COPYWRITING_WORDS.join(', ')}

JTBD FRAMEWORK — for each field, answer the question: what is this person really hiring this service to do? What is the functional job (the task they're trying to complete)? What is the emotional job (how they want to feel)? What is the social job (how they want to be perceived)?

Return JSON with these exact fields:
{
  "serviceName": "A short, concrete name for this service as the coach would put it on a landing page — 2-5 words, niche-specific, no tagline and no colon. Not a slogan.",
  "description": "1-2 sentences. Name what this service does and who it's for using niche-specific language. Include a concrete outcome (number, timeframe, or named result). Must NOT be interchangeable with any other coaching service.",
  "targetCustomer": "Specific demographic and psychographic description. Name their job title or life situation, their current stuck state, and the specific thing they want — all in niche-specific language.",
  "mainBenefit": "The single functional outcome the customer hires this service to deliver. Must contain a concrete result — a number, a timeframe, or a named change in situation. Not a feeling. Not a journey.",
  "painPoints": "3-5 pains. Each must name a SPECIFIC situation this person faces — not 'feeling overwhelmed' but 'posting every day for 3 months with zero client enquiries'. Use their internal monologue language.",
  "falseBeliefsVsRealReasons": "3-5 pairs. Format: [what customer believes is stopping them] | [what is actually stopping them]. Each pair must be niche-specific. The false belief must sound plausible. The real reason must be surprising.",
  "failedSolutions": "3-5 things this specific audience has tried. Name the actual product, approach, or platform (e.g. 'cold outreach on LinkedIn', 'hiring a VA', 'buying a $2k course on Instagram ads'). Explain exactly why each failed for THIS audience specifically.",
  "hiddenReasons": "3-5 real reasons behind their problem that they would never admit out loud or have never considered. These must be uncomfortable truths specific to this niche — not generic psychology.",
  "whyProblemExists": "The systemic or structural root cause of this problem. Not the symptom. Not 'lack of mindset'. The actual mechanism that keeps people stuck in this niche.",
  "uniqueMechanismSuggestion": "A proprietary-sounding name for how this service solves the problem. Must contain a specific process word or metaphor from this niche. BANNED names: ${BANNED_MECHANISM_NAMES.join(', ')}. Good names contain a word from the niche itself.",
  "hvcoTopicSuggestion": "A lead magnet title that would make someone in this niche stop scrolling. Must contain a specific number or timeframe, a named enemy or obstacle, and a concrete promised insight.",
  "riskReversalSuggestion": "A guarantee that makes the risk of not buying feel greater than the risk of buying. Must include: specific duration, specific result guaranteed, and exact refund process.",
  "avatarName": "A realistic first name for the ideal customer (match cultural context of the niche).",
  "avatarTitle": "Their job title or life situation in 3-5 words. Must be niche-specific."
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a world-class direct response copywriter and Jobs-To-Be-Done researcher. You write in the language real people use — not marketing language. Always return valid JSON only, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
            json_schema: {
            name: "service_profile_expansion",
            strict: true,
            schema: {
              type: "object",
              properties: {
                serviceName: { type: "string" },
                description: { type: "string" },
                targetCustomer: { type: "string" },
                mainBenefit: { type: "string" },
                painPoints: { type: "string" },
                falseBeliefsVsRealReasons: { type: "string" },
                failedSolutions: { type: "string" },
                hiddenReasons: { type: "string" },
                whyProblemExists: { type: "string" },
                uniqueMechanismSuggestion: { type: "string" },
                hvcoTopicSuggestion: { type: "string" },
                riskReversalSuggestion: { type: "string" },
                avatarName: { type: "string" },
                avatarTitle: { type: "string" },
              },
              required: [
                "serviceName",
                "description",
                "targetCustomer",
                "mainBenefit",
                "painPoints",
                "falseBeliefsVsRealReasons",
                "failedSolutions",
                "hiddenReasons",
                "whyProblemExists",
                "uniqueMechanismSuggestion",
                "hvcoTopicSuggestion",
                "riskReversalSuggestion",
                "avatarName",
                "avatarTitle",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0].message.content;
      let expanded: Record<string, unknown>;

      // Helper: try to parse JSON from a string, stripping markdown fences first
      const tryParse = (s: string): Record<string, unknown> | null => {
        try {
          const stripped = s
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();
          return JSON.parse(stripped);
        } catch {
          return null;
        }
      };

      if (typeof rawContent !== "string") {
        // Already a parsed object (some LLM backends return objects directly)
        expanded = rawContent as unknown as Record<string, string>;
      } else {
        const parsed = tryParse(rawContent);
        if (parsed) {
          expanded = parsed;
        } else {
          // Claude sometimes wraps JSON in a preamble — find the first '{' and parse from there
          const firstBrace = rawContent.indexOf('{');
          const lastBrace = rawContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonSlice = rawContent.slice(firstBrace, lastBrace + 1);
            const sliceParsed = tryParse(jsonSlice);
            if (sliceParsed) {
              expanded = sliceParsed;
            } else {
              console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
              throw new Error("AI returned invalid JSON during profile expansion");
            }
          } else {
            console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
            throw new Error("AI returned invalid JSON during profile expansion");
          }
        }
      }

      // Helper to normalize a field: join arrays to newline-separated string, then truncate
      const normalize = (v: unknown, max: number): string => {
        if (Array.isArray(v)) return v.map(String).join('\n').slice(0, max);
        if (typeof v === 'string') return v.slice(0, max);
        if (v == null) return '';
        return String(v).slice(0, max);
      };
      const trunc = normalize; // alias for clarity

      // Compliance pre-filter on AI-generated service fields before DB write
      const SERVICE_FILTER_FIELDS = ["painPoints", "targetCustomer", "description", "mainBenefit", "falseBeliefsVsRealReasons", "failedSolutions", "hiddenReasons"];
      const { cleaned: cleanedServiceData, classification: serviceClassification, allFlaggedTerms: serviceFlaggedTerms } = filterRecord(expanded, SERVICE_FILTER_FIELDS);
      if (serviceClassification === "REJECTED") {
        console.error(
          `[expandProfile] FAILED serviceId=${input.serviceId} reason=compliance_rejected ` +
          `flagged=[${serviceFlaggedTerms.join(",")}]`,
        );
        throw new Error(`Generated service content contained prohibited language. Please regenerate. Flagged: ${serviceFlaggedTerms.join("; ")}`);
      }
      const filteredExpanded = { ...expanded, ...cleanedServiceData };

      // Map LLM field names to DB column names.
      // Only overwrite fields that were empty — never overwrite user-filled content.
      // Truncate to column limits: text = 65535, varchar(300) = 300, varchar(100) = 100
      // PROVENANCE, TAGGED AT WRITE TIME (migration 0108). Every field this block writes is
      // MODEL OUTPUT, so every one of them is tagged `extracted` — never `coach_stated`.
      //
      // Measured 2026-09-02 across the 35 completed kits: 4 carried enrichment that
      // CONTRADICTED the coach's own typed description (services 232, 248, 249, 250; three of
      // them profiling an entirely different business). The ICP prompt was handing this text to
      // the model labelled "the coach's own words about the buyer they actually serve" with
      // explicit override authority. The text is often useful; the label was false, and the
      // label is what this records.
      const BUYER_INTEL_KEYS = [
        "painPoints", "whyProblemExists", "failedSolutions",
        "falseBeliefsVsRealReasons", "hiddenReasons", "avatarName", "avatarTitle",
      ] as const;
      const existingIntelSource =
        service.buyerIntelSource && typeof service.buyerIntelSource === "object" && !Array.isArray(service.buyerIntelSource)
          ? (service.buyerIntelSource as Record<string, string>)
          : {};
      // Merge, never replace: a field a coach edited stays `coach_stated` unless THIS run
      // rewrites it, and this run only rewrites the keys below.
      const buyerIntelSource: Record<string, string> = { ...existingIntelSource };
      for (const k of BUYER_INTEL_KEYS) buyerIntelSource[k] = "extracted";

      // NOTE: buyerIntelSource is deliberately NOT a member of `updateFields`. That object is
      // the STRING field map, and its member types flow all the way out through the mutation's
      // return value into CreateServiceStep's review form. Widening it to `unknown` to carry
      // one JSON map cost 10 TS errors there. The provenance map is merged into the DB payload
      // at the .set() call instead, where it belongs.
      const updateFields: Record<string, string> = {
        // Always overwrite deep-research fields (not user-editable in the form)
        painPoints: trunc(filteredExpanded.painPoints, 65535),
        falseBeliefsVsRealReasons: trunc(filteredExpanded.falseBeliefsVsRealReasons, 65535),
        failedSolutions: trunc(filteredExpanded.failedSolutions, 65535),
        hiddenReasons: trunc(filteredExpanded.hiddenReasons, 65535),
        whyProblemExists: trunc(filteredExpanded.whyProblemExists, 65535),
        riskReversal: trunc(filteredExpanded.riskReversalSuggestion, 65535),
        avatarName: trunc(filteredExpanded.avatarName, 100),
        avatarTitle: trunc(filteredExpanded.avatarTitle, 100),
        // Only overwrite user-visible fields if they were empty
        // LEGACY BACKFILL ONLY — and it now tags what it writes.
        //
        // New rows can never reach here needing a name: the create ladder resolves one
        // before the row exists. This fires for the 131 rows that PREDATE the ladder —
        // the 38 measured blank — where a re-run of expandProfile is the only repair path.
        // Kept for exactly that reason, not because create still depends on it.
        //
        // Tagged `extracted`: this value came from a model reading the coach's own
        // description. That is weaker than `coach_stated` and must never be able to
        // masquerade as it — an untagged generated name is the thing the 2026-08-30
        // ruling rejected.
        ...(needsName && filteredExpanded.serviceName
          ? { name: trunc(filteredExpanded.serviceName, 255), nameSource: "extracted" as const }
          : {}),
        ...(needsDescription && filteredExpanded.description ? { description: trunc(filteredExpanded.description, 65535) } : {}),
        ...(needsTargetCustomer && filteredExpanded.targetCustomer ? { targetCustomer: trunc(filteredExpanded.targetCustomer, 65535) } : {}),
        ...(needsMainBenefit && filteredExpanded.mainBenefit ? { mainBenefit: trunc(filteredExpanded.mainBenefit, 65535) } : {}),
        uniqueMechanismSuggestion: trunc(filteredExpanded.uniqueMechanismSuggestion, 65535),
        hvcoTopic: trunc(filteredExpanded.hvcoTopicSuggestion, 300),
      };

      // REQUIREMENT 3: Save to DB BEFORE returning — persists even if user skips review
      try {
        await db
          .update(services)
          .set({ ...updateFields, buyerIntelSource, updatedAt: new Date() })
          .where(eq(services.id, input.serviceId));
      } catch (dbErr: unknown) {
        const e = dbErr as { code?: string; sqlMessage?: string; message?: string };
        console.error('[expandProfile] DB update failed:', {
          code: e.code,
          sqlMessage: e.sqlMessage,
          message: e.message,
          fieldLengths: Object.fromEntries(
            Object.entries(updateFields).map(([k, v]) => [k, typeof v === 'string' ? v.length : v])
          ),
        });
        throw dbErr;
      }

      console.log(
        `[expandProfile] done serviceId=${input.serviceId} ` +
        `nameBackfilled=${needsName && !!filteredExpanded.serviceName} ` +
        `serviceNameReturnedByModel=${!!filteredExpanded.serviceName} ` +
        `nameLenAfter=${(updateFields.name ?? service.name ?? "").length}`,
      );

      // Return the expanded fields so the review screen can display them.
      // Tool-use enforces every required field server-side at the LLM API
      // level, so `expanded.X` and `updateFields.X` are guaranteed strings
      // here — the previous `|| ''` and chained-fallback patterns were
      // dead code (unreachable under tool-use enforcement). Direct reads
      // are the post-migration shape.
      const expandedResult = {
        painPoints: updateFields.painPoints,
        falseBeliefsVsRealReasons: updateFields.falseBeliefsVsRealReasons,
        failedSolutions: updateFields.failedSolutions,
        hiddenReasons: updateFields.hiddenReasons,
        whyProblemExists: updateFields.whyProblemExists,
        riskReversal: updateFields.riskReversal,
        avatarName: updateFields.avatarName,
        avatarTitle: updateFields.avatarTitle,
        uniqueMechanismSuggestion: updateFields.uniqueMechanismSuggestion,
        hvcoTopic: updateFields.hvcoTopic,
        // User-visible fields: include the LLM's freshly-generated value
        // for the review screen even when the DB write skipped them
        // (because the user already had content in those columns).
        targetCustomer: trunc(expanded.targetCustomer, 65535),
        mainBenefit: trunc(expanded.mainBenefit, 65535),
        description: trunc(expanded.description, 65535),
      };
      return {
        serviceId: input.serviceId,
        expanded: expandedResult,
      };
    }),

  // Update existing service
  update: protectedProcedure
    .input(updateServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...updateData } = input;
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!existing) {
        throw new Error("Service not found");
      }
      
      // PROVENANCE (migration 0108, edit-detection corrected 2026-09-03). A buyer-intel field
      // the COACH actually EDITED becomes `coach_stated`. Detection is a DIFF against the stored
      // row — not the mere presence of the key — because every form resends what it rendered.
      // See detectEditedIntelKeys above for the full reasoning.
      const editedIntelKeys = detectEditedIntelKeys(
        updateData as Record<string, unknown>,
        existing as unknown as Record<string, unknown>,
      );

      // Convert price to string for decimal field
      const setData: any = { ...updateData, updatedAt: new Date() };
      if (editedIntelKeys.length > 0) {
        const prior =
          existing.buyerIntelSource && typeof existing.buyerIntelSource === "object" && !Array.isArray(existing.buyerIntelSource)
            ? (existing.buyerIntelSource as Record<string, string>)
            : {};
        const merged: Record<string, string> = { ...prior };
        for (const k of editedIntelKeys) merged[k] = "coach_stated";
        setData.buyerIntelSource = merged;
      }
      if (setData.price !== undefined) {
        setData.price = setData.price?.toString();
      }
      
      await db
        .update(services)
        .set(setData)
        .where(eq(services.id, id));
      
      // Fetch updated record
      const [updated] = await db
        .select()
        .from(services)
        .where(eq(services.id, id))
        .limit(1);
      
      return updated;
    }),

  // Delete service
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Service not found");
      }

      await db.delete(services).where(eq(services.id, input.id));

      return { success: true };
    }),

  // ── Auto Mode Phase A — extractFromText ─────────────────────────────────
  // Single LLM call: takes raw user-typed business description, returns a
  // structured profile draft. NO DB writes. The user reviews + edits on the
  // confirmation screen before any persistence happens via services.create
  // and downstream icps.generateAsync.
  //
  // Output schema mirrors what services.create + icps.generate need
  // downstream so the confirm screen can call those without translation.
  // category enum constrained to the 3 values services.create accepts
  // (coaching / speaking / consulting); LLM picks the closest fit when
  // input describes something off-spec (e.g. "online course" → "consulting").
  //
  // Confidence rules + grounding rule documented in the system prompt.
  // Per institutional finding from Sprint B regression v2 (handover §6),
  // prompt uses positive-only directives — no "Wrong:/Right:" framing.
  extractFromText: protectedProcedure
    .input(z.object({
      rawText: z.string().min(120, "Need at least 120 characters to extract a useful profile.").max(4000),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You analyze raw business descriptions from coaches, speakers, and consultants and extract a structured business profile. Your output is JSON conforming to a strict schema. The user will review and edit your extraction on a confirmation screen — your job is to be accurate about what's actually present in the input, not to fabricate plausible-sounding fields where information is missing.

OUTPUT FIELDS:

- serviceName: the product or programme name as the user names it (≤ 60 chars). If a name appears in the input ("called X", "I sell Y", "my Z programme"), capture it verbatim. If no name is given, leave empty.

- serviceCategory: one of [coaching, speaking, consulting]. Choose the closest match based on the delivery model described. If the input describes online courses, masterminds, agency services, or other models, pick the nearest of the three (typically "consulting" for agency/done-for-you, "coaching" for done-with-you and online courses, "speaking" for speaker/keynote work).

- serviceDescription: a single sentence (≤ 200 chars) describing what they do, in the user's own framing. Mirror their language, not marketing language.

- targetCustomer: who they help (≤ 200 chars). Capture the demographic + context the user describes (e.g., "senior leaders at fast-growing tech companies who feel exhausted after 10+ years"). If only generic ("business owners"), capture that and mark this field as low-grounding.

- mainBenefit: the primary outcome they deliver (≤ 200 chars). Capture in the user's own outcome language.

- icpDescriptor: a one-line ideal-customer descriptor for downstream ICP generation (≤ 150 chars). Combine targetCustomer specificity with the emotional / situational state the user mentioned.

- buyerNegatives: anything the coach states is NOT true of this buyer (≤ 300 chars). Experience they do not have, things they are not looking for, descriptions they would reject, or a proportion of the audience for whom something does not apply. Capture the coach's own phrasing. Leave empty when the coach states nothing of this kind.

- confidence: "high" if all six content fields are clearly grounded in the input. "medium" if at least four are grounded and the rest are reasonable inferences from context. "low" if fewer than four are grounded — when the input is too short, too generic, or so vague the extraction would be guesswork.

- lowConfidenceFields: array of field names where grounding is weak (e.g. ["targetCustomer", "mainBenefit"]). Empty array if confidence is "high".

GROUNDING RULE:

Leave a field as empty string ("") if you cannot infer it with reasonable confidence from the input. The user prefers an empty field they can type into over an invented field they have to delete. Empty fields automatically go into lowConfidenceFields.

A statement about what is NOT true of the buyer is information the coach gave you, not information you are missing. It belongs in buyerNegatives. It never causes a positive field to be left empty, and it is never dropped for lack of a field to hold it.`;

      const userPrompt = `RAW BUSINESS DESCRIPTION (entered by user):

"""
${input.rawText}
"""

Extract the structured business profile. Return JSON matching the schema.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "auto_mode_intake_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                serviceName: { type: "string" },
                serviceCategory: { type: "string", enum: ["coaching", "speaking", "consulting"] },
                serviceDescription: { type: "string" },
                targetCustomer: { type: "string" },
                mainBenefit: { type: "string" },
                icpDescriptor: { type: "string" },
                buyerNegatives: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                lowConfidenceFields: { type: "array", items: { type: "string" } },
              },
              required: [
                "serviceName",
                "serviceCategory",
                "serviceDescription",
                "targetCustomer",
                "mainBenefit",
                "icpDescriptor",
                // Listed for consistency with the other six. NOTE (§15i): on the Anthropic
                // tool-use path `required` is STEERING, not enforcement — nothing throws if the
                // model omits it. The reader below treats a missing value as "", which is the
                // same as the coach stating no negative.
                "buyerNegatives",
                "confidence",
                "lowConfidenceFields",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0].message.content;
      let extracted: {
        serviceName: string;
        serviceCategory: "coaching" | "speaking" | "consulting";
        serviceDescription: string;
        targetCustomer: string;
        mainBenefit: string;
        icpDescriptor: string;
        buyerNegatives: string;
        confidence: "high" | "medium" | "low";
        lowConfidenceFields: string[];
      };
      // Mirror the rawContent handling pattern from expandProfile (L248-260):
      // some LLM backends return a parsed object directly instead of a JSON
      // string. Strict json_schema response_format guarantees the shape; we
      // just need to handle both representations.
      if (typeof rawContent !== "string") {
        extracted = rawContent as unknown as typeof extracted;
      } else {
        try {
          extracted = JSON.parse(rawContent);
        } catch {
          throw new Error("Extraction returned invalid JSON. Please refine your description and try again.");
        }
      }
      return extracted;
    }),

  /**
   * updateFromExtraction — updates service row with richer content from a
   * has-assets document extraction. Only overwrites a field if the new value
   * is substantive (>10 chars) — never blanks a decent greeting-derived field.
   */
  updateFromExtraction: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      name: z.string().max(255).optional(),
      description: z.string().max(2000).optional(),
      targetCustomer: z.string().max(500).optional(),
      mainBenefit: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Ownership check
      const [existing] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      if (!existing) return { updated: false };

      const MIN_SUBSTANTIVE = 10;
      const updates: Record<string, string> = {};

      // Only overwrite if extracted value is substantive AND richer than existing
      if (input.name && input.name.trim().length >= MIN_SUBSTANTIVE) {
        updates.name = input.name.trim();
      }
      if (input.description && input.description.trim().length >= MIN_SUBSTANTIVE &&
          input.description.trim().length > (existing.description?.length ?? 0)) {
        updates.description = input.description.trim();
      }
      if (input.targetCustomer && input.targetCustomer.trim().length >= MIN_SUBSTANTIVE) {
        updates.targetCustomer = input.targetCustomer.trim();
      }
      if (input.mainBenefit && input.mainBenefit.trim().length >= MIN_SUBSTANTIVE) {
        updates.mainBenefit = input.mainBenefit.trim();
      }

      if (Object.keys(updates).length === 0) return { updated: false };

      await db.update(services)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(services.id, input.serviceId));

      return { updated: true };
    }),
});
