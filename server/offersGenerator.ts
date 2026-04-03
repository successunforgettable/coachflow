import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";

// Angle-specific prompt modifiers for Offers (Industry standard)
const ANGLE_PROMPTS = {
  godfather: `
Generate an IRRESISTIBLE GODFATHER OFFER using risk reversal.

Focus on:
- Money-back guarantee
- "Or you don't pay" - removes all risk
- Making it impossible to say no
- Stack value so high it's a no-brainer

Offer Name pattern: "[Result] - Or You Don't Pay!"
CTA: "Claim Your Risk-Free Spot"
Key phrase: Emphasize "Or you don't pay" and risk reversal
  `,
  free: `
Generate a FREE OFFER emphasizing zero-cost entry.

Focus on:
- Free consultation/training/audit
- No credit card required
- Risk-free start
- Immediate access to value

Offer Name pattern: "FREE [Service/Training/Audit]"
CTA: "Claim Your FREE [Offer]!"
Key phrase: Emphasize "FREE" and "no strings attached"
  `,
  dollar: `
Generate a DOLLAR OFFER with specific price positioning.

Focus on:
- Exact pricing ($1, $7, $27, $97)
- Incredible value at low price
- Limited-time pricing
- Value stack showing savings

Offer Name pattern: "Get [Result] for Just $[Price]!"
CTA: "Get Started for $[Price]"
Key phrase: Emphasize specific price and massive value
  `
};

export async function generateOfferAngle(
  productName: string,
  productDescription: string,
  targetCustomer: string,
  mainBenefit: string,
  angle: 'godfather' | 'free' | 'dollar',
  offerType: 'standard' | 'premium' | 'vip',
  socialProof: any
): Promise<OfferContent> {
  const offerTypeInstructions = {
    standard: "Entry-level offer with core benefits, good value",
    premium: "Mid-tier offer with additional bonuses, better value",
    vip: "High-ticket offer with maximum value, exclusive access, premium bonuses",
  };

  // Social proof guidance (Issue 2 fix)
  const socialProofGuidance = socialProof.hasCustomers
    ? `REAL SOCIAL PROOF AVAILABLE:
- ${socialProof.customerCount} verified customers

You MAY use this number in the offer copy if relevant. Do not fabricate.`
    : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts or specific testimonials in the offer
- Focus on benefit claims and value propositions`;
  
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
          "You are an expert offer creator specializing in irresistible, loss-aversion-driven offers for coaches, speakers, and consultants. You apply anchoring to make the price feel like a fraction of the value, and you make saying no feel more expensive than saying yes. You write specific outcomes and specific dollar values — never vague promises or unquantified benefits. Always respond with valid JSON.",
      },
      { role: "user", content: prompt },
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
  socialProof: any
): Promise<{
  godfather: OfferContent;
  free: OfferContent;
  dollar: OfferContent;
}> {
  const [godfather, free, dollar] = await Promise.all([
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'godfather', offerType, socialProof),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'free', offerType, socialProof),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'dollar', offerType, socialProof),
  ]);

  return { godfather, free, dollar };
}
