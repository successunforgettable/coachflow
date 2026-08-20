import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, REGISTER_STANDARD, truncateQuote } from "./_core/copywritingRules";
import { validateOfferFabricationPatterns, getCanonicalOfferTokens, type OfferSuppliedData, type RawOfferFields } from "./_core/validator";
import { resolveOfferMode, FREE_STEP_NOUN, DEFAULT_CAMPAIGN_TYPE, type OfferMode } from "./_core/campaignFraming";
import { offerStandardBlock, offerAngleBlock } from "./_core/offerStandard";

/**
 * Replace currency amounts in CUSTOMER-PROFILE text with a qualitative stand-in before that text
 * reaches the offer prompt.
 *
 * The profile's figures are real and are about the BUYER — "loses £2,000 a month to no-shows" is
 * a fact about their situation, not a price for anything ZAP is selling. Passed through verbatim
 * they are the single most likely thing for a model to echo back into `pricing` or an anchor, and
 * `detectInventedCurrencyAmounts` would then correctly flag every one of them as invented,
 * burning all three retry attempts before the degrade-never-kill floor persists the row anyway.
 *
 * Keeping the MAGNITUDE qualitatively preserves the signal that actually matters — that this is a
 * costly problem — while removing the digits that could be mistaken for an offer fact.
 */
export function neutraliseProfileCurrency(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/[£$€¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn)?/gi, 'a specific amount')
    .replace(/\b\d[\d,]*(?:\.\d+)?\s?(?:pounds|dollars|euros|GBP|USD|EUR)\b/gi, 'a specific amount');
}

// Phase D Phase 1 — offer hardening (red-team baseline v1 evidence-driven).
// See docs/redteam-audit-baseline-v1.md for measured pre-fix rates +
// docs/redteam-failure-taxonomy-v1.md for the pass criteria contracts.
const OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS = 3;

// The three angle prompts now live in `_core/offerStandard.ts`, in TWO sets: one for a campaign
// that converts on a FREE next step and one for a campaign that converts on a PURCHASE. The set
// that used to sit here was paid-shaped in all three angles — it instructed a price line and a
// refund guarantee on every campaign, including free webinars. See `offerAngleBlock`.

export async function generateOfferAngle(
  productName: string,
  productDescription: string,
  targetCustomer: string,
  mainBenefit: string,
  angle: 'godfather' | 'free' | 'dollar',
  offerType: 'standard' | 'premium' | 'vip',
  socialProof: any,
  cascadeContext: string = "",
  supplied: OfferSuppliedData = {},
  /** Free-next-step campaign or a genuine purchase. Decides whether price/guarantee exist at all. */
  mode: OfferMode = "paid",
  /** What the reader is registering for, so free-mode copy can name it ("live training", "call"). */
  freeStepNoun: string = "session",
  /** Residual legacy-validator hits, so the persistence gate folds them into ONE verdict. */
  __legacySink?: { hits: Array<{ classId: string; matched: string; location: string }> }): Promise<OfferContent> {
  const offerTypeInstructions = {
    standard: "Entry-level offer with core benefits, good value",
    premium: "Mid-tier offer with additional bonuses, better value",
    vip: "High-ticket offer with maximum value, exclusive access, premium bonuses",
  };

  // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
  // Social proof guidance — full guard matching landingPageGenerator.ts
  const testimonialLines = socialProof.hasTestimonials
    ? socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')
    : '';
  const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers || socialProof.hasPress
    ? `REAL SOCIAL PROOF AVAILABLE — you MUST reference these in the offer copy, do not fabricate or inflate:
${socialProof.hasCustomers ? `- CUSTOMER COUNT: ${socialProof.customerCount} verified customers — use this exact number in the offer` : ''}
${socialProof.hasRating ? `- RATING: ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews — include this specific rating number` : ''}
${socialProof.hasTestimonials ? `- TESTIMONIALS — quote the actual words, use the real name:\n${testimonialLines}` : ''}
${socialProof.hasPress ? `- PRESS: ${socialProof.press} — reference this specific press mention by name` : ''}

USAGE RULES:
- If testimonials exist: quote the actual testimonial text verbatim (or paraphrase closely) and use the real name
- If rating exists: state the exact rating number (e.g. "4.9-star rated") — never round or omit
- If press exists: name the specific publication/feature — never say "featured in leading publications"
- If customer count exists: use the exact number — never say "hundreds of clients"`
    : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts, ratings, or specific testimonials in the offer
- Focus on outcome-based language and benefit claims only
- Use transformation language WITHOUT specific names ("A client in this niche" instead of "John Smith")
- DO NOT fabricate social proof of any kind`;

  // ─── Phase D Phase 1: canonical operator-fill token directive ──────────────
  // Per docs/redteam-audit-baseline-v1.md, the pre-fix offer prompt produced
  // 100% fabrication rate on pricing + bonuses + total value + placeholders;
  // 80-93% on guarantees + cohort + anchor ranges. Root cause: the prompt
  // explicitly INSTRUCTED the LLM to invent currency amounts ("each bonus
  // must have a real name and specific £/$ value"). Phase 1 fix inverts the
  // pattern: emit canonical operator-fill placeholders verbatim when the
  // operator hasn't supplied the underlying field. Allow-list of canonical
  // tokens is enforced post-generation by validateOfferFabricationPatterns.
  // ── FREE-EVENT MODE: the price and guarantee facts are WITHHELD, not just unmentioned ──────
  // This campaign converts on a free next step, so the coach's programme price and refund terms
  // are not facts about anything on this page. Handing them to the model and asking it not to use
  // them is the failure mode this fix exists to close: measured on service 1 (£3,000 / "Full
  // refund" / "90 days"), supplying the facts put the price in faq[4] and the money-back promise
  // in faq[5] of a FREE webinar page, on three of four angles. The fix is to not supply them.
  const isFreeEvent = mode === "free_event";
  const suppliedPriceLine = isFreeEvent
    ? `- This campaign converts on a FREE ${freeStepNoun}. It has no price, so no section carries one. Where the paid programme is referred to at all, it is referred to as something discussed later, never with a figure. Emit no price token.`
    : supplied.price
    ? `- The operator HAS supplied a price: ${supplied.price}. Use this exact number in pricing. Do not invent additional anchor prices or alternative tiers.`
    : `- The operator has NOT supplied a price. Emit the placeholder [INSERT_PRICE] verbatim wherever the price would appear. Do NOT invent a currency amount.`;
  const suppliedGuaranteeLine = isFreeEvent
    ? `- A free ${freeStepNoun} takes no money, so there is nothing to refund and no guarantee section in the money sense. The guarantee field carries the ATTENDANCE PROMISE instead: what the reader walks away holding, and that nothing is sold in the room. Emit no guarantee token and no refund language.`
    : (supplied.guaranteeType || supplied.guaranteeDuration)
    ? `- The operator HAS supplied guarantee terms: ${[supplied.guaranteeDuration, supplied.guaranteeType].filter(Boolean).join(", ")}. Use these terms verbatim in the guarantee section.`
    : `- The operator has NOT supplied a guarantee. Emit the placeholder [INSERT_GUARANTEE_TERMS] verbatim in the guarantee section. Do NOT invent refund mechanics, timeframes, or "pay nothing" / "full refund" / "money-back" language.`;
  const suppliedDurationLine = supplied.deliveryDuration
    ? `- The operator HAS supplied a delivery duration: ${supplied.deliveryDuration}. Use this verbatim wherever programme duration is mentioned.`
    : `- The operator has NOT supplied a delivery duration. Emit the placeholder [INSERT_PROGRAMME_DURATION] verbatim wherever programme duration would appear. Do NOT invent "N-minute session", "N-week sprint", or similar durations.`;
  const suppliedBonusesLine = supplied.bonuses
    ? `- The operator HAS supplied bonuses content. Reference it directly without inventing additional currency values.`
    : `- The operator has NOT supplied bonuses. Emit EXACTLY 3 bonuses. For each, use [INSERT_BONUS_N_NAME] for the name and [INSERT_BONUS_N_VALUE] for the value (N=1, 2, 3 only — never 4 or 5). Do NOT invent "(£497 value)" / "(£1,200 value)" / etc. Do NOT invent a total bonus value summation.`;

  const canonicalTokensList = getCanonicalOfferTokens().join(", ");

  const operatorFillBlock = `
CANONICAL TOKEN ALLOW-LIST — operator-fill seam:

ZAP separates two layers:
  1. The asset-generation layer (you, the LLM) — produces structure + copy
  2. The operator-fill layer (the user) — fills in specific facts ZAP cannot know

When the operator has not supplied a specific fact (price, guarantee terms,
cohort size, programme duration, bonus values, etc.), you MUST emit one of
the canonical operator-fill placeholder tokens listed below VERBATIM at the
position where the fact would appear. The placeholders are surfaced to the
operator in the UI for inline editing before publication.

OPERATOR-SUPPLIED DATA FOR THIS GENERATION:
${suppliedPriceLine}
${suppliedGuaranteeLine}
${suppliedDurationLine}
${suppliedBonusesLine}
- No fixture field exists for cohort size. Always emit [INSERT_COHORT_LIMIT] verbatim when cohort scarcity is mentioned. Never invent "8 leaders" / "maximum of 12 founders" / etc.
- No fixture field exists for cohort dates. Always emit [INSERT_COHORT_CLOSE_DATE] or [INSERT_PROGRAMME_START_DATE] verbatim. Never invent "next cohort opens" / "enrolment closes" framing.
- No fixture field exists for first-result timing. Emit [INSERT_FIRST_RESULT_TIMEFRAME] verbatim if naming a specific timeframe. Never invent "within 7 days" / "in the first 14 days".

CANONICAL TOKENS (use ONLY these — never invent variants like [INSERT_LAUNCH_DATE], [INSERT_SPOTS_REMAINING], [INSERT_START_DATE], [INSERT_BOOKING_LINK], [INSERT_CART_CLOSE]):
${canonicalTokensList}

ABSOLUTE PROHIBITIONS — these are zero-tolerance fabrications that will trigger retry:
- Inventing currency amounts when no price is supplied
- Inventing anchor price ranges (£X – £Y)
- Inventing bonus values (£N value)
- Inventing a total bonus value summation
- Inventing cohort sizes (maximum of N seats/leaders/places)
- Inventing programme durations (N-week sprint, N-minute session)
- Inventing guarantee timeframes (within N days)
- Inventing refund mechanics (pay nothing, full refund, money-back) when no guarantee is supplied
- Inventing next-cohort opening/closing dates
- Emitting any [INSERT_X] token NOT in the canonical allow-list above
`;

  const modeHeader = mode === "free_event"
    ? `THIS CAMPAIGN CONVERTS ON A FREE NEXT STEP — a ${freeStepNoun} the reader registers for at no cost.
The coach's paid programme is real and is sold LATER, in conversation, away from this page. So the
offer you are writing is the PROGRAMME CONTEXT that makes attending worth an hour of someone's
life: the transformation, the mechanism, and the value equation. It carries no price and makes no
refund promise, because nothing is being bought here.`
    : `THIS CAMPAIGN CONVERTS ON A PURCHASE. The price and the guarantee are real parts of the offer
and belong in it, written from the operator's supplied facts.`;

  const prompt = `
You are an expert B2C offer creator for coaches, speakers, consultants and practitioners —
individual people selling to individual people. Your reader is one person deciding for themselves.
There is no buying committee, no procurement process and no business case; the decision is
personal, and it is made on identity and trust.

Product: ${productName}
Description: ${productDescription}
Target Customer: ${targetCustomer}
Main Benefit: ${mainBenefit}
Offer Type: ${offerTypeInstructions[offerType]}
Angle: ${angle}

${modeHeader}

${offerAngleBlock(mode, angle)}

${offerStandardBlock(mode)}

${socialProofGuidance}

${operatorFillBlock}

SPECIFICITY RULE — applies to every field:
Every output must pass this test: could this offer have been written for a different coaching
programme in a different niche? If yes, it is not specific enough — rewrite it until the answer is
no. The offer must contain at least three niche-specific words or phrases — terms that only
someone in this world would recognise. Specificity comes from NICHE-SPECIFIC LANGUAGE, never from
invented currency amounts or durations.

OUTCOME SPECIFICITY RULE:
Replace any outcome that uses these words with a specific alternative: results, transformation,
success, growth, improvement, better, more, less. Every outcome names a situation, and where it
names a number or a timeframe that number or timeframe comes from operator-supplied data or
carries its canonical token. Not "better results" — "3 new clients in 60 days" where 60 days is
supplied, or "3 new clients in [INSERT_FIRST_RESULT_TIMEFRAME]" where it is not.

BONUS CREDIBILITY RULE:
Every bonus reads as something that took real effort to make. Name the format explicitly:
recorded workshop, live group call, private community access, custom assessment, done-for-you
template, annotated swipe file. Name what the buyer can DO after using it that they could not do
before. For bonus values, use the operator-fill placeholders specified above.

Return ONLY valid JSON with these exact keys: offerName, valueProposition, pricing, bonuses, guarantee, urgency, cta
`;

  // ─── Phase D Phase 1: retry-with-failContext loop ──────────────────────────
  // Mirrors the landingPageGenerator.ts pattern. Max 3 attempts; each retry
  // injects validatorFailContext (from validateOfferFabricationPatterns) into
  // the next prompt. On exhaust, persist best-effort with diagnostic log dump
  // (same shape as LP exhaust path).
  let validatorFailContext = "";
  let lastParsed: OfferContent | null = null;

  for (let attempt = 1; attempt <= OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS; attempt++) {
    const failContextInjection = validatorFailContext
      ? `\n\nPRIOR-ATTEMPT FABRICATION FEEDBACK (you must address this):\n${validatorFailContext}\n\n`
      : "";

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            `You are an expert offer creator specializing in irresistible, loss-aversion-driven offers for coaches, speakers, and consultants. You apply anchoring to make the price feel like a fraction of the value, and you make saying no feel more expensive than saying yes. You write specific outcomes — but you NEVER invent currency amounts, bonus values, cohort sizes, programme durations, or guarantee timeframes that the operator has not supplied. When such facts are unavailable, you emit the canonical operator-fill placeholder tokens listed in the user prompt verbatim. Always respond with valid JSON.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_DATE_FABRICATION_RULE}\n\n${REGISTER_STANDARD}`,
        },
        { role: "user", content: cascadeContext + failContextInjection + prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "offer_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              offerName: { type: "string" },
              valueProposition: { type: "string" },
              pricing: { type: "string" },
              bonuses: { type: "string" },
              guarantee: { type: "string" },
              urgency: { type: "string" },
              cta: { type: "string" },
            },
            required: [
              "offerName",
              "valueProposition",
              "pricing",
              "bonuses",
              "guarantee",
              "urgency",
              "cta",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (typeof content !== "string") {
      throw new Error("Invalid response format from AI");
    }
    const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(stripped) as OfferContent;

    // ── Deterministic pricing backstop (Phase D) ────────────────────────────
    // The schema requires `pricing` but permits an empty string, and the
    // godfather angle's call-booking narrative sometimes returns pricing="",
    // leaving neither a literal price nor a fillable token — which renders as
    // "Pricing: —" on the kit page and ships blank in exports. Guarantee an
    // operator-fill seam: use the supplied price when present, else emit the
    // canonical [INSERT_PRICE] token so the registry resolver always has a
    // target to substitute. Runs before the fabrication check ([INSERT_PRICE]
    // and the operator-supplied price are both allow-listed).
    if (!parsed.pricing || !parsed.pricing.trim()) {
      parsed.pricing = supplied.price ? String(supplied.price) : "[INSERT_PRICE]";
    }

    lastParsed = parsed;

    // Fabrication-pattern check against the canonical-token allow-list.
    const fabResult = validateOfferFabricationPatterns(parsed as RawOfferFields, supplied);
    if (__legacySink) __legacySink.hits.push(...(fabResult.ok ? [] : (fabResult.hits ?? []).map((h: any) => ({
      classId: String(h.classId), matched: String(h.matched ?? ""), location: String(h.location ?? "offer"),
    }))));
    if (fabResult.ok) {
      return parsed;
    }

    if (attempt < OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS) {
      validatorFailContext = fabResult.failContext;
      const hitCount = fabResult.hits.length;
      const hitSummary = fabResult.hits.slice(0, 3).map(h => `${h.classId}@${h.location}`).join(",");
      console.warn(`[offersGenerator] Offer fabrication check failed on attempt ${attempt}/${OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS} (angle=${angle}, ${hitCount} hits, top=[${hitSummary}]). Retrying with fail-context.`);
      continue;
    }

    // Exhaust path — best-effort return + diagnostic dump for forensic
    // recovery (mirrors LP testimonial exhaust + C1.1 ad headlines exhaust
    // patterns). Persist content so the user gets *something* rather than
    // a hard generation failure; the PlaceholderBanner UX (Phase 3) will
    // surface remaining fabricated fields to the operator for inline edit.
    const hitClasses = fabResult.hits.map(h => h.classId).join(",");
    console.warn(`[offersGenerator] Offer fabrication check exhausted retries on angle=${angle} (${fabResult.hits.length} hits remaining, classes=[${hitClasses}]); returning content as best-effort. Phase D Phase 1.`);
    fabResult.hits.forEach((h, i) => {
      if (i < 10) console.warn(`[offersGenerator]   hit ${i + 1}: ${h.classId} @ ${h.location} matched "${h.matched}"`);
    });
    return parsed;
  }

  // Unreachable — loop returns or throws — but TS exhaustiveness:
  if (!lastParsed) throw new Error("Offer generation failed: no response captured");
  return lastParsed;
}

// Generate all 3 angles in parallel
export async function generateAllOfferAngles(
  productName: string,
  productDescription: string,
  targetCustomer: string,
  mainBenefit: string,
  offerType: 'standard' | 'premium' | 'vip',
  socialProof: any,
  cascadeContext: string = "",
  supplied: OfferSuppliedData = {},
  /** Shared sink so all three angles' residual legacy hits reach ONE verdict at persist. */
  __sink?: { hits: Array<{ classId: string; matched: string; location: string }> },
  /** Free-next-step campaign or a genuine purchase. Threaded to all three angles identically. */
  mode: OfferMode = "paid",
  freeStepNoun: string = "session"): Promise<{
  godfather: OfferContent;
  free: OfferContent;
  dollar: OfferContent;
}> {
  const __offerLegacySink = __sink ?? { hits: [] as Array<{ classId: string; matched: string; location: string }> };
  const [godfather, free, dollar] = await Promise.all([
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'godfather', offerType, socialProof, cascadeContext, supplied, mode, freeStepNoun, __offerLegacySink),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'free', offerType, socialProof, cascadeContext, supplied, mode, freeStepNoun, __offerLegacySink),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'dollar', offerType, socialProof, cascadeContext, supplied, mode, freeStepNoun, __offerLegacySink),
  ]);

  return { godfather, free, dollar };
}

// ─── Auto Mode Phase B1 — runOfferGeneration ────────────────────────────────
// Gen-core for the offers node. Callable directly by:
//   - offers.generate (sync tRPC mutation) — wrapped with quota check, returns full row
//   - offers.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue, runs in setImmediate
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// Shape: takes minimal pre-validated input, fetches everything it needs from
// the DB, builds cascade/ICP/SOT context, calls generateAllOfferAngles,
// inserts the offer row, returns { offerId }. Quota checks live in the
// tRPC wrappers (orchestrator skips them by design — Auto Mode is one user-
// initiated action that already passed the entry gate at intake).
export async function runOfferGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  offerType: 'standard' | 'premium' | 'vip';
  /**
   * Auto Mode passes this straight through. Every OTHER generator already resolves it from the
   * campaign kit and the offer node was the only one that did not, which is why it wrote a
   * priced, refund-guaranteed offer for a free webinar. Omitted → resolved from the kit below.
   */
  campaignType?: string | null;
}): Promise<{ offerId: number }> {
  // Lazy-import DB types/runtime to keep this file framework-agnostic for the
  // orchestrator's direct-call path.
  const { getDb } = await import("./db");
  const { offers, services, idealCustomerProfiles, sourceOfTruth, campaigns } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Service fetch — owner-scoped
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.userId, input.userId)))
    .limit(1);
  if (!service) throw new Error("Service not found");

  // Campaign fetch (if scoped to a campaign) — Item 1.1b icpId support
  let campaignRecord: typeof campaigns.$inferSelect | undefined;
  if (input.campaignId) {
    [campaignRecord] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, input.userId)))
      .limit(1);
  }

  // ICP fetch — campaign-specific first, serviceId fallback
  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (campaignRecord?.icpId) {
    [icp] = await db
      .select()
      .from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.id, campaignRecord.icpId))
      .limit(1);
  }
  if (!icp) {
    [icp] = await db
      .select()
      .from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.serviceId, input.serviceId))
      .limit(1);
  }

  // Cascade context — upstream campaignKits selections for this ICP
  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "offer");

  // ── Offer mode — resolved from the kit, exactly as every other generator resolves campaignType ──
  // The kit is the V2 source of truth. `campaignFacts.price` is the coach's own upfront answer and
  // outranks the campaign-type default in both directions (a priced event is paid; an explicit
  // "it's free" is free), which is also the seam the deferred paid tripwire will land on.
  const { campaignKits } = await import("../drizzle/schema");
  let kitCampaignType: string | null = input.campaignType ?? null;
  let kitFacts: { price?: any } | null = null;
  if (icp?.id) {
    const [kit] = await db
      .select()
      .from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
      .limit(1);
    if (kit) {
      kitCampaignType = kitCampaignType ?? kit.campaignType ?? null;
      kitFacts = (kit.campaignFacts as { price?: any } | null) ?? null;
    }
  }
  const offerMode = resolveOfferMode({ campaignType: kitCampaignType, campaignFacts: kitFacts });
  const freeStepNoun = FREE_STEP_NOUN[(kitCampaignType ?? DEFAULT_CAMPAIGN_TYPE) as keyof typeof FREE_STEP_NOUN]
    ?? FREE_STEP_NOUN[DEFAULT_CAMPAIGN_TYPE];
  console.log(`[offer] serviceId=${input.serviceId} campaignType=${kitCampaignType ?? "none"} mode=${offerMode}`);

  // ── ICP context block — now carrying the value equation's OWN inputs ──────────────────────────
  // The block used to supply four fields, none of which is a lever in the equation the prompt is
  // built on: objections, buyingTriggers, implementationBarriers, successMetrics. The Dream
  // Outcome (hopesDreams) and the cost of inaction (pains, fears) were sitting unused in the same
  // row. They are the numerator and the denominator; without them the equation had no inputs.
  //
  // 🔴 GUARDED. The customer profile is EVIDENCE ABOUT THE BUYER and is never a source of offer
  // facts. Since ICP Phase A, `pains` legitimately contains the coach's own currency figures, and
  // `detectInventedCurrencyAmounts` (_core/validator.ts) flags EVERY £N in the output when no
  // price is supplied — so a figure copied out of the profile would burn all three retries and
  // then persist anyway. `neutraliseProfileCurrency` makes that structurally impossible rather
  // than asking the prompt nicely, which is the lesson this codebase has already paid for twice.
  const icpContext = icp ? [
    'IDEAL CUSTOMER PROFILE — evidence about the person who reads this offer.',
    'Use it to make every section specific to them. It describes the BUYER and their situation;',
    'it is never a source of facts about the offer itself — not its price, its value, or its terms.',
    '',
    icp.hopesDreams ? `DREAM OUTCOME — what they are reaching for: ${neutraliseProfileCurrency(icp.hopesDreams)}` : '',
    icp.pains ? `THE COST OF STAYING STUCK — what the current situation takes from them: ${neutraliseProfileCurrency(icp.pains)}` : '',
    icp.fears ? `WHAT THEY ARE AFRAID OF — the risk they feel in changing anything: ${neutraliseProfileCurrency(icp.fears)}` : '',
    icp.objections ? `Their objections to buying: ${neutraliseProfileCurrency(icp.objections)}` : '',
    icp.buyingTriggers ? `What makes them buy: ${neutraliseProfileCurrency(icp.buyingTriggers)}` : '',
    icp.implementationBarriers ? `What stops them from taking action: ${neutraliseProfileCurrency(icp.implementationBarriers)}` : '',
    icp.successMetrics ? `How they measure success: ${neutraliseProfileCurrency(icp.successMetrics)}` : '',
  ].filter(Boolean).join('\n').trim() : '';

  // SOT fetch + context block
  const [sot] = await db
    .select()
    .from(sourceOfTruth)
    .where(eq(sourceOfTruth.userId, input.userId))
    .limit(1);
  const sotLines = sot ? [
    sot.coreOffer ? `Core offer: ${sot.coreOffer}` : '',
    sot.targetAudience ? `Target audience: ${sot.targetAudience}` : '',
    sot.mainPainPoint ? `Main pain point: ${sot.mainPainPoint}` : '',
    sot.mainBenefits ? `Main benefits: ${sot.mainBenefits}` : '',
    sot.uniqueValue ? `Unique value: ${sot.uniqueValue}` : '',
    sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
  ].filter(Boolean) : [];
  const sotContext = sotLines.length > 0
    ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
    : '';

  // Social proof — full structure matching offersGenerator's social proof guard
  const socialProof = {
    hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
    hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
    hasRating: !!service.averageRating && parseFloat(service.averageRating) > 0,
    hasReviews: !!service.totalReviews && service.totalReviews > 0,
    hasPress: !!service.pressFeatures && service.pressFeatures.trim().length > 0,
    customerCount: service.totalCustomers || 0,
    rating: service.averageRating || '',
    reviewCount: service.totalReviews || 0,
    testimonials: [
      service.testimonial1Name ? { name: service.testimonial1Name, title: service.testimonial1Title || '', quote: service.testimonial1Quote || '' } : null,
      service.testimonial2Name ? { name: service.testimonial2Name, title: service.testimonial2Title || '', quote: service.testimonial2Quote || '' } : null,
      service.testimonial3Name ? { name: service.testimonial3Name, title: service.testimonial3Title || '', quote: service.testimonial3Quote || '' } : null,
    ].filter(Boolean),
    press: service.pressFeatures || '',
  };

  const enrichedTargetCustomer = sotContext || icpContext
    ? `${sotContext ? `${sotContext}\n\n` : ''}${service.targetCustomer || 'Target Customer'}${icpContext ? `\n\n${icpContext}` : ''}`
    : service.targetCustomer || 'Target Customer';

  // Phase D Phase 1 — Operator-supplied facts for the offer fabrication
  // validator's cross-check (USER-SUPPLIED vs MODEL-INVENTED classification).
  // Anything not supplied here gets emitted as a canonical [INSERT_X] token
  // by the generator and is enforced by validateOfferFabricationPatterns.
  const offerSupplied: OfferSuppliedData = {
    price: service.price ?? null,
    guaranteeType: service.guaranteeType ?? null,
    guaranteeDuration: service.guaranteeDuration ?? null,
    deliveryDuration: service.deliveryDuration ?? null,
    bonuses: service.bonuses ?? null,
  };

  const __offerSink = { hits: [] as Array<{ classId: string; matched: string; location: string }> };
  const allAngles = await generateAllOfferAngles(
    service.name,
    service.description || "",
    enrichedTargetCustomer,
    service.mainBenefit || "Main Benefit",
    input.offerType,
    socialProof,
    cascadeContext,
    offerSupplied,
    __offerSink,
    offerMode,
    freeStepNoun
  );

  const __offerRow = {
    userId: input.userId,
    serviceId: input.serviceId,
    campaignId: input.campaignId || null,
    productName: service.name,
    offerType: input.offerType,
    godfatherAngle: allAngles.godfather,
    freeAngle: allAngles.free,
    dollarAngle: allAngles.dollar,
    activeAngle: "godfather",
    rating: 0,
  };
  // Persistence backstop for offers — previously the ONLY cascade table with no gate at
  // all. legacyHits folds the offer validator's residual findings into the same verdict.
  const { gateBeforePersist } = await import("./_core/persistenceGate");
  const __og = await gateBeforePersist("offers", [__offerRow as any], { legacyHits: __offerSink.hits });
  const insertResult: any = await db.insert(offers).values((__og.kept[0] ?? __offerRow) as any);
  const offerId = insertResult[0].insertId;

  // Auto-select into campaign kit (creates kit if needed) — mirrors orchestrator pattern
  try {
    if (icp?.id) {
      const { autoSelectBest } = await import("./routers/campaignKits");
      await autoSelectBest(input.userId, icp.id, "selectedOfferId", offerId);
    }
  } catch (e) { console.warn("[auto-select] offer failed:", e); }

  return { offerId };
}
