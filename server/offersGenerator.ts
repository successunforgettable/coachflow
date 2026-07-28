import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, REGISTER_STANDARD, truncateQuote } from "./_core/copywritingRules";
import { validateOfferFabricationPatterns, getCanonicalOfferTokens, type OfferSuppliedData, type RawOfferFields } from "./_core/validator";

// Phase D Phase 1 — offer hardening (red-team baseline v1 evidence-driven).
// See docs/redteam-audit-baseline-v1.md for measured pre-fix rates +
// docs/redteam-failure-taxonomy-v1.md for the pass criteria contracts.
const OFFER_VALIDATOR_RETRY_MAX_ATTEMPTS = 3;

// Angle-specific prompt modifiers for Offers (Industry standard)
const ANGLE_PROMPTS = {
  godfather: `
Generate an IRRESISTIBLE GODFATHER OFFER using the Hormozi value equation: Dream Outcome × Perceived Likelihood of Achievement ÷ Time Delay × Effort and Sacrifice. Every element of the offer must increase the numerator or decrease the denominator.

STRUCTURE:
1. Name the dream outcome in one specific sentence — not a category, a situation. Not "financial freedom" — "replacing your current salary within [INSERT_FIRST_RESULT_TIMEFRAME]." Use niche-specific language for specificity, never invented currency amounts.
2. State the likelihood of achievement using whatever the SOCIAL PROOF section below actually supplies. Where it supplies none, establish likelihood through the MECHANISM itself — why the method works, what it accounts for that the approaches they already tried do not — which carries the same persuasive weight while standing on the method rather than on a client count.
3. Reduce perceived time delay — name the specific first result the customer sees in the first 7 days, not just the end result.
4. Reduce perceived effort — name the one thing they do NOT have to do that they assumed they would have to do.
5. Stack the offer: core programme + bonuses (each with a real name and the operator-supplied value or [INSERT_BONUS_N_VALUE] placeholder when none is supplied) + guarantee that removes all financial risk.
6. The guarantee must make keeping the money feel riskier than giving it back — name exactly what they keep if they refund (all materials, all recordings, all bonus resources). The reader must feel that requesting a refund still leaves them better off than before.
7. State the programme investment as an explicit pricing line — use the operator-supplied price when provided, otherwise emit the [INSERT_PRICE] placeholder verbatim. Always populate the pricing field with this line even when the call-to-action is a booked call, so the offer's price has a clear home.

Risk reversal: state "or you don't pay" as a specific condition, not a slogan. Name the result that must happen for payment to be earned.

CTA: "Book My Risk-Free [Service] Call"

BANNED GODFATHER PHRASES (never use):
- "too good to be true"
- "once in a lifetime"
- "limited time only" without a specific date
- "act now"
- "don't miss out"
- "this offer expires soon" without a specific date
- "incredible offer"
- "you'd be crazy not to"
  `,
  free: `
Generate a FREE OFFER that feels like the full value being given away — not a stripped-down version of the paid programme. The free thing must feel complete at the point of delivery, with nothing held back.

STRUCTURE:
1. Name the specific deliverable from the free session — a personalised gap analysis, a three-step roadmap, a custom action plan — not "valuable insights" or "clarity." The deliverable must be something the client can act on immediately after the session ends.
2. Name the perceived value of that deliverable if the client had paid for it — use operator-supplied price data or [INSERT_PRICE] placeholder when no price is supplied. Explain why it has that value — what it includes that makes it worth that amount.
3. Name who this free offer is NOT for — this increases perceived exclusivity and pre-qualifies leads. Be specific: "This is not for people who are just curious. This is for [specific situation with specific qualifying criteria]."
4. Name the one thing that will happen in the session that the client cannot get anywhere else — the proprietary analysis, framework, or insight that makes this session unique to this provider.

Offer Name pattern: "FREE [Specific Deliverable Name] for [Specific Avatar]"
CTA: "Claim Your FREE [Specific Deliverable]"

BANNED FREE OFFER PHRASES (overused — trigger skepticism, do not use):
- "no strings attached"
- "completely free" (redundant)
- "zero cost to you"
- "nothing to lose"
- "at no cost"
- "totally free"
  `,
  dollar: `
Generate a DOLLAR OFFER that anchors against the cost of the problem, not against the cost of a higher-tier programme. The price must feel like the obvious rational choice compared to what staying stuck costs per month.

STRUCTURE:
1. Frame the cost of the problem — describe what staying stuck costs the customer in concrete terms (time, missed opportunities, ongoing frustration) without inventing specific currency amounts. Use operator-supplied price or [INSERT_PRICE] placeholder for the offer price. The price must feel like the obvious rational choice compared to the cost of inaction.
2. Name what the customer gets access to immediately on payment — not what they get "over the programme" — what lands in their inbox or account in the next 10 minutes.
3. Use the tripwire frame: this is not the full programme. This is the specific tool that solves the single most painful problem. Name that specific problem and name that specific tool.
4. Show the value ladder transparently: name that this low-price entry leads to the full programme. Be open about it — transparency increases conversion because it removes the hidden agenda suspicion.

Offer Name pattern: "The [Specific Tool Name] for [Niche Avatar] — [INSERT_PRICE]"
CTA: "Get Instant Access for [INSERT_PRICE]"
Price anchoring: frame the anchor using the cost of the problem (without inventing currency amounts) before presenting the operator-supplied price or [INSERT_PRICE] placeholder.

BANNED DOLLAR PHRASES (do not use):
- "incredible value"
- "massive discount"
- "for a limited time only" without a specific end date
- "usually costs X" without a real anchor established first
- "steal"
- "bargain"
- "grab this"
  `
};

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
): Promise<OfferContent> {
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
  const suppliedPriceLine = supplied.price
    ? `- The operator HAS supplied a price: ${supplied.price}. Use this exact number in pricing. Do not invent additional anchor prices or alternative tiers.`
    : `- The operator has NOT supplied a price. Emit the placeholder [INSERT_PRICE] verbatim wherever the price would appear. Do NOT invent a currency amount.`;
  const suppliedGuaranteeLine = (supplied.guaranteeType || supplied.guaranteeDuration)
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

  const prompt = `
You are an expert offer creator specializing in irresistible offers for coaches, speakers, and consultants.

Product: ${productName}
Description: ${productDescription}
Target Customer: ${targetCustomer}
Main Benefit: ${mainBenefit}
Offer Type: ${offerTypeInstructions[offerType]}
Angle: ${angle}

${ANGLE_PROMPTS[angle]}

${socialProofGuidance}

${operatorFillBlock}

LOSS AVERSION PRINCIPLE — apply throughout every section:
The cost of NOT buying must feel greater than the cost of buying. At least one section must name the specific ongoing cost of the customer's current situation (time, money, missed opportunities, continued pain). Make saying no feel more expensive than saying yes.

ANCHORING PRINCIPLE — apply to pricing and bonuses (within the operator-fill constraints above):
- If the operator has supplied a price, establish a high anchor price BEFORE revealing the actual price (but anchor must be operator-supplied or derived from supplied data — never invent a fabricated anchor)
- Every bonus must have an operator-supplied dollar value OR a [INSERT_BONUS_N_VALUE] placeholder (never invent the £/$ amount)
- The total bonus value, if stated, must come from operator-supplied data (never invent the summation)
- The actual price (if supplied) must be presented as a fraction of the total value

SPECIFICITY RULE — applies to every field:
Every output must pass this test: could this offer have been written for a different coaching programme in a different niche? If yes, it is not specific enough — rewrite it until the answer is no. The offer must contain at least three niche-specific words or phrases — terms that only someone in this world would recognise. Specificity comes from NICHE-SPECIFIC LANGUAGE, never from invented currency amounts or durations.

BONUS CREDIBILITY RULE:
Every bonus must feel like something that took real effort to create — not a PDF that could be made in an afternoon. Name the format explicitly: recorded workshop, live group call, private community access, custom assessment, done-for-you template, annotated swipe file. Name the specific outcome of using that bonus — what will the buyer be able to do after using it that they could not do before? Never use "access to X" as the bonus description — name what X specifically gives them. For bonus VALUES, use the operator-fill placeholders specified above.

OUTCOME SPECIFICITY RULE:
Replace any outcome that uses these words with a specific measurable alternative: results, transformation, success, growth, improvement, better, more, less. Every outcome must have a number, a timeframe, or a named situation — but the number, timeframe, or situation MUST come from operator-supplied data or be marked with a canonical token. Not "better results" — "3 new clients in 60 days" (if 60 days is operator-supplied), or "3 new clients in [INSERT_FIRST_RESULT_TIMEFRAME]" if not.

GODFATHER OFFER RULE (for godfather angle): Make it impossible to say no. Structure so refusing it feels irrational — bonus stack (with canonical-token values when not supplied), a guarantee (with canonical-token terms when not supplied), and a price (operator-supplied or [INSERT_PRICE] placeholder).

Generate a complete offer with 7 sections:

1. **Offer Name** (5-10 words, outcome-specific and risk-reversed per the angle rules)
   Must name the specific result + the angle-specific risk reversal phrase. Not a generic name.

2. **Value Proposition** (20-30 words)
   State the specific functional outcome (number, timeframe, or named situation) the customer gets. Then immediately name what it costs them if they stay where they are. Not a feeling — a situation.

3. **Pricing** (price section, 30-50 words)
   Use operator-supplied price OR [INSERT_PRICE] placeholder verbatim. Do NOT invent a price, anchor range, or cost comparison with a fabricated number. Include the guarantee duration only if operator-supplied; otherwise reference the [INSERT_GUARANTEE_TERMS] placeholder.

4. **Bonuses** (EXACTLY 3 bonuses)
   Emit ONLY the bonus NAME slot for each — one bonus per line, NAME token only, NO description, and NO value unless the operator supplied one. The real bonus name and its one-line description are filled in from the campaign's generated bonus stack after this step; adding your own description here would contradict the real bonus (a checklist wrongly described as a "live call"), so leave the line at the name slot.
   Format WITHOUT a supplied value (the default): "BONUS #1: [INSERT_BONUS_1_NAME]" then "BONUS #2: [INSERT_BONUS_2_NAME]" then "BONUS #3: [INSERT_BONUS_3_NAME]", each on its own line (N=1, 2, 3 only).
   Format WITH an operator-supplied value: "BONUS #1: The Strategy Playbook (£497 value)".

5. **Guarantee** (50-75 words, specific risk reversal)
   Use operator-supplied guarantee terms OR [INSERT_GUARANTEE_TERMS] placeholder verbatim. Do NOT invent "30-day refund", "pay nothing", "full refund", "money-back" mechanics.

6. **Urgency/Scarcity** (30-50 words, angle-specific)
   Use [INSERT_COHORT_LIMIT] for cohort sizes and [INSERT_COHORT_CLOSE_DATE] for closing dates. Never invent "8 leaders per cohort" / "next cohort opens".

7. **Call to Action** (clear next step, 20-30 words)
   One clear action. Use angle-appropriate CTA language from the angle rules above.

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
): Promise<{
  godfather: OfferContent;
  free: OfferContent;
  dollar: OfferContent;
}> {
  const [godfather, free, dollar] = await Promise.all([
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'godfather', offerType, socialProof, cascadeContext, supplied),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'free', offerType, socialProof, cascadeContext, supplied),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'dollar', offerType, socialProof, cascadeContext, supplied),
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

  // ICP context block
  const icpContext = icp ? [
    'IDEAL CUSTOMER PROFILE — use this to make every offer specific and targeted:',
    icp.objections ? `Their objections to buying: ${icp.objections}` : '',
    icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : '',
    icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : '',
    icp.successMetrics ? `How they measure success: ${icp.successMetrics}` : '',
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

  const allAngles = await generateAllOfferAngles(
    service.name,
    service.description || "",
    enrichedTargetCustomer,
    service.mainBenefit || "Main Benefit",
    input.offerType,
    socialProof,
    cascadeContext,
    offerSupplied,
  );

  const insertResult: any = await db.insert(offers).values({
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
  });
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
