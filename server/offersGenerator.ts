import { invokeLLM } from "./_core/llm";
import type { OfferContent } from "../drizzle/schema";

// Angle-specific prompt modifiers for Offers
const ANGLE_PROMPTS = {
  godfather: `
You are writing a GODFATHER OFFER — the most irresistible, risk-reversed, premium offer possible.

ANGLE RULES (these override everything):
* This is the FULL PRICE premium offer. Price must reflect full programme value ($2,000–$25,000 range typical for high-ticket coaching).
* The entire offer is built around ONE guarantee: "If you don't get [result], you don't pay. Period."
* Bonuses must be premium and specific — name each bonus, give it a dollar value, make the total bonus stack worth MORE than the programme price.
* Urgency is scarcity-based: limited spots, cohort closes, waitlist opens.
* Tone: bold, confident, zero apology for the price.
* The offer name must include the core result AND a risk-reversal phrase.
* CTA: "Claim Your Risk-Free Spot"
  `,
  free: `
You are writing a FREE LEAD MAGNET OFFER — a zero-cost, zero-friction entry point designed to attract qualified leads.

ANGLE RULES (these override everything):
* Price is always FREE. No credit card. No strings. No trial period.
* This is NOT the main programme — it is a taster, a training, an audit, a PDF, a challenge, or a free session.
* The offer name must start with the word FREE or include "at no cost."
* Value Proposition must explain what they will LEARN or EXPERIENCE for free, not what they will buy later.
* Bonuses should be delivery bonuses (instant access, replay, cheat sheet) — not premium upsells.
* Guarantee should focus on their time: "If you don't find this valuable, you've lost nothing."
* Urgency is availability-based: limited free spots, doors close Friday, only 20 seats.
* Tone: generous, warm, low-pressure, "I just want to help."
* CTA: "Claim Your FREE [Offer Type]"
  `,
  dollar: `
You are writing a DOLLAR OFFER — a specific low-price entry point designed to convert browsers into buyers by making the decision financially trivial.

ANGLE RULES (these override everything):
* Price must be a specific, real dollar amount: $1, $7, $17, $27, $47, or $97. Never a range. Never "low cost." A real number.
* The offer name must include the price: "Get [Result] for Just $[Price]"
* This is a real paid product — a workshop, a mini-course, a 30-minute session, a toolkit — NOT the full programme.
* Value Proposition must make the price feel absurd: "Normally $[10x price], yours today for $[price]."
* Bonuses should amplify the value-to-price gap — show the total value is worth 10–20x the asking price.
* Guarantee should be a full money-back: "If you're not satisfied after [timeframe], email us and we'll refund every cent."
* Urgency is time-limited: price increases, offer expires, founding member rate.
* Tone: direct, energetic, "this is a no-brainer."
* CTA: "Get Started for $[Price]"
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
