import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, truncateQuote } from "./_core/copywritingRules";

// Angle-specific prompt modifiers for Offers (Industry standard)
const ANGLE_PROMPTS = {
  godfather: `
Generate an IRRESISTIBLE GODFATHER OFFER using the Hormozi value equation: Dream Outcome × Perceived Likelihood of Achievement ÷ Time Delay × Effort and Sacrifice. Every element of the offer must increase the numerator or decrease the denominator.

STRUCTURE:
1. Name the dream outcome in one specific sentence — not a category, a situation. Not "financial freedom" — "replacing your £8,000/month salary within 90 days."
2. State the likelihood of achievement using social proof — specific client numbers from the data provided, or "hundreds of clients" minimum if none available.
3. Reduce perceived time delay — name the specific first result the customer sees in the first 7 days, not just the end result.
4. Reduce perceived effort — name the one thing they do NOT have to do that they assumed they would have to do.
5. Stack the offer: core programme + bonuses (each with real name and specific £/$ value) + guarantee that removes all financial risk.
6. The guarantee must make keeping the money feel riskier than giving it back — name exactly what they keep if they refund (all materials, all recordings, all bonus resources). The reader must feel that requesting a refund still leaves them better off than before.

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
2. Name the monetary value of that deliverable if the client had paid for it, and explain why it has that value — what it includes that makes it worth that amount.
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
1. Calculate the monthly cost of the problem — if the customer is losing £X/month by not solving this, state that number explicitly. The dollar price must be shown as a fraction of that monthly cost. Example: "$7 is less than 1% of what this problem costs you every month."
2. Name what the customer gets access to immediately on payment — not what they get "over the programme" — what lands in their inbox or account in the next 10 minutes.
3. Use the tripwire frame: this is not the full programme. This is the specific tool that solves the single most painful problem. Name that specific problem and name that specific tool.
4. Show the value ladder transparently: name that this low-price entry leads to the full programme. Be open about it — transparency increases conversion because it removes the hidden agenda suspicion.

Offer Name pattern: "The [Specific Tool Name] for [Niche Avatar] — [Price]"
CTA: "Get Instant Access for $[Price]"
Price anchoring: state the anchor (full programme value or monthly cost of problem) before revealing the dollar price.

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

LOSS AVERSION PRINCIPLE — apply throughout every section:
The cost of NOT buying must feel greater than the cost of buying. At least one section must name the specific ongoing cost of the customer's current situation (time, money, missed opportunities, continued pain). Make saying no feel more expensive than saying yes.

ANCHORING PRINCIPLE — apply to pricing and bonuses:
- Establish a high anchor price before revealing the actual price
- Every bonus must have a specific named dollar value (not "priceless" or "invaluable")
- The total bonus value must be stated and must exceed the programme price
- The actual price must be presented as a fraction of the total value

SPECIFICITY RULE — applies to every field:
Every output must pass this test: could this offer have been written for a different coaching programme in a different niche? If yes, it is not specific enough — rewrite it until the answer is no. The offer must contain at least three niche-specific words or phrases — terms that only someone in this world would recognise.

BONUS CREDIBILITY RULE:
Every bonus must feel like something that took real effort to create — not a PDF that could be made in an afternoon. Name the format explicitly: recorded workshop, live group call, private community access, custom assessment, done-for-you template, annotated swipe file. Name the specific outcome of using that bonus — what will the buyer be able to do after using it that they could not do before? Never use "access to X" as the bonus description — name what X specifically gives them.

OUTCOME SPECIFICITY RULE:
Replace any outcome that uses these words with a specific measurable alternative: results, transformation, success, growth, improvement, better, more, less. Every outcome must have a number, a timeframe, or a named situation. Not "better results" — "3 new clients in 60 days." Not "transformation" — "moving from £2,000/month to £8,000/month within a quarter."

GODFATHER OFFER RULE (for godfather angle): Make it impossible to say no. The offer must be structured so that refusing it feels irrational — more bonuses than they expect, a guarantee that removes all risk, and a price that feels like a fraction of the transformation value.

Generate a complete offer with 7 sections:

1. **Offer Name** (5-10 words, outcome-specific and risk-reversed per the angle rules)
   Must name the specific result + the angle-specific risk reversal phrase. Not a generic name.

2. **Value Proposition** (20-30 words)
   State the specific functional outcome (number, timeframe, or named situation) the customer gets. Then immediately name what it costs them if they stay where they are. Not a feeling — a situation.

3. **Pricing** (clear price with anchoring, 30-50 words)
   State the anchor price first. Then reveal the actual price. Show the gap. Include the guarantee duration.
   Example structure: "Normally [anchor price]. Today [actual price] — [what's included]. [Guarantee statement]."

4. **Bonuses** (3-5 bonuses with specific dollar values, 150-200 words total)
   Every bonus must: have a real name, a specific dollar value in £/$ (not "priceless"), and one sentence explaining exactly what it does for the customer. The total bonus value must exceed the programme price.
   Example: "BONUS #1: [Specific Name] (£497 value) — [One sentence on what it does for the customer]"

5. **Guarantee** (50-75 words, specific risk reversal)
   Must include: exact duration (30-day, 60-day, etc.), the specific result guaranteed, the exact refund process (email us at X / no questions asked / etc.), and what they keep if they refund. Make keeping the money feel riskier than giving it back.

6. **Urgency/Scarcity** (30-50 words, angle-specific)
   Name the specific mechanism of scarcity (cohort closes, limited spots, price increases). The urgency must match the angle rules above.

7. **Call to Action** (clear next step, 20-30 words)
   One clear action. Use angle-appropriate CTA language from the angle rules above.

Return ONLY valid JSON with these exact keys: offerName, valueProposition, pricing, bonuses, guarantee, urgency, cta
`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          `You are an expert offer creator specializing in irresistible, loss-aversion-driven offers for coaches, speakers, and consultants. You apply anchoring to make the price feel like a fraction of the value, and you make saying no feel more expensive than saying yes. You write specific outcomes and specific dollar values — never vague promises or unquantified benefits. Always respond with valid JSON.\n\n${META_COMPLIANCE_NOTES}`,
      },
      { role: "user", content: cascadeContext + prompt },
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

  // Strip markdown code fences if the LLM wraps the JSON (e.g. ```json\n{...}\n```)
  const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(stripped) as OfferContent;
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
): Promise<{
  godfather: OfferContent;
  free: OfferContent;
  dollar: OfferContent;
}> {
  const [godfather, free, dollar] = await Promise.all([
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'godfather', offerType, socialProof, cascadeContext),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'free', offerType, socialProof, cascadeContext),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'dollar', offerType, socialProof, cascadeContext),
  ]);

  return { godfather, free, dollar };
}
