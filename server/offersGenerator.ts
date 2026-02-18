import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";

// Angle-specific prompt modifiers for Offers (Kong parity)
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
  offerType: 'standard' | 'premium' | 'vip'
): Promise<OfferContent> {
  const offerTypeInstructions = {
    standard: "Entry-level offer with core benefits, good value",
    premium: "Mid-tier offer with additional bonuses, better value",
    vip: "High-ticket offer with maximum value, exclusive access, premium bonuses",
  };

  const prompt = `
You are an expert offer creator specializing in irresistible offers for coaches, speakers, and consultants.

Product: ${productName}
Description: ${productDescription}
Target Customer: ${targetCustomer}
Main Benefit: ${mainBenefit}
Offer Type: ${offerTypeInstructions[offerType]}
Angle: ${angle}

${ANGLE_PROMPTS[angle]}

Generate a complete offer with 7 sections:

1. **Offer Name** (5-10 words, compelling and benefit-focused)
   Example: "6-Month Crypto Mastery - Or You Don't Pay!"

2. **Value Proposition** (20-30 words, specific transformation)
   Example: "Transform from crypto beginner to confident investor earning $10K/month in passive income - guaranteed or your money back."

3. **Pricing** (clear price with context, 30-50 words)
   Example: "$997 one-time payment (normally $2,997) - includes everything below. 60-day money-back guarantee if you don't see results."

4. **Bonuses** (3-5 bonuses with perceived value, 150-200 words total)
   Example: "BONUS #1: Crypto Tax Optimization Guide ($497 value) - Never overpay on crypto taxes again..."

5. **Guarantee** (50-75 words, risk reversal, specific)
   Example: "60-Day 'Make $10K or Don't Pay' Guarantee: Follow the system for 60 days. If you don't make at least $10,000 in crypto income, we'll refund every penny - no questions asked."

6. **Urgency/Scarcity** (30-50 words, creates FOMO)
   Example: "Only 10 spots available this month. Once they're gone, the next cohort won't start for 90 days. Secure your spot now before it's too late."

7. **Call to Action** (clear next step, 20-30 words)
   Example: "Click the button below to claim your spot and start your crypto journey today. Your future self will thank you."

Return ONLY valid JSON with these exact keys: offerName, valueProposition, pricing, bonuses, guarantee, urgency, cta
`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are an expert offer creator specializing in irresistible offers for coaches, speakers, and consultants. Always respond with valid JSON.",
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

  return JSON.parse(content) as OfferContent;
}

// Generate all 3 angles in parallel
export async function generateAllOfferAngles(
  productName: string,
  productDescription: string,
  targetCustomer: string,
  mainBenefit: string,
  offerType: 'standard' | 'premium' | 'vip'
): Promise<{
  godfather: OfferContent;
  free: OfferContent;
  dollar: OfferContent;
}> {
  const [godfather, free, dollar] = await Promise.all([
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'godfather', offerType),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'free', offerType),
    generateOfferAngle(productName, productDescription, targetCustomer, mainBenefit, 'dollar', offerType),
  ]);

  return { godfather, free, dollar };
}
