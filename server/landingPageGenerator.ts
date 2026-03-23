import { invokeLLM } from "./_core/llm";
import type { LandingPageContent } from "../drizzle/schema";

// Angle-specific prompt modifiers based on industry research
const ANGLE_PROMPTS = {
  original: `
Generate a benefit-driven landing page emphasizing the unique mechanism and transformation.

Focus on:
- Specific results and timeframe
- Proprietary system name
- Step-by-step process
- Guarantee included

Headline pattern: "[Benefit]: How [Avatar]'s '[Mechanism Name]' Delivers [Result] Using [System] - In [Timeframe], Guaranteed!"
CTA: "Claim Your FREE Consultation!"
  `,
  godfather: `
Generate a landing page with an IRRESISTIBLE OFFER using risk reversal.

Focus on:
- Money-back guarantee
- "Or you don't pay" - removes all risk
- Making it impossible to say no
- Risk reversal throughout copy

Headline pattern: "Get [Result] in [Timeframe] - Or You Don't Pay [Currency]!"
CTA: "Book My Free [Service] Call"
Key phrase: Emphasize "Or you don't pay" throughout the copy
  `,
  free: `
Generate a landing page emphasizing FREE consultation/training/resources.

Focus on:
- Free value
- No credit card required
- Risk-free start
- Immediate access

Headline pattern: "Get [Result] - FREE [Offer Type]!"
CTA: "Claim Your FREE [Offer]!"
Key phrase: Emphasize "FREE" and "no strings attached"
  `,
  dollar: `
Generate a landing page with specific price positioning.

Focus on:
- Exact pricing
- Value comparison
- Cost breakdown
- Limited-time pricing

Headline pattern: "Get [Result] for Just $[Price]!"
CTA: "Get Started for $[Price]"
Key phrase: Emphasize specific price and value
  `
};

export async function generateLandingPageAngle(
  productName: string,
  productDescription: string,
  avatarName: string,
  avatarDescription: string,
  angle: 'original' | 'godfather' | 'free' | 'dollar',
  socialProof: any
): Promise<LandingPageContent> {
  // Social proof guidance (Issue 2 fix)
  const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers || socialProof.hasPress
    ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials: ${socialProof.testimonials.map((t: any) => `${t.name} (${t.title})`).join(', ')}` : ''}
${socialProof.hasPress ? `- Press features: ${socialProof.press}` : ''}

You MUST use these exact numbers and real testimonials. Do not fabricate or inflate.`
    : `NO SOCIAL PROOF DATA PROVIDED:
- For testimonials section: Use outcome-based quotes WITHOUT specific names ("A marketing agency owner" instead of "John Smith")
- For "As Seen In" section: OMIT entirely or use "Trusted by [audience] in 30+ countries"
- DO NOT fabricate customer counts, ratings, or press mentions
- Focus on benefit claims and transformation stories instead`;
  
  const prompt = `
You are a world-class direct response copywriter specializing in high-converting landing pages.

Product: ${productName}
Description: ${productDescription}
Target Avatar: ${avatarName} - ${avatarDescription}
Angle: ${angle}

${ANGLE_PROMPTS[angle]}

${socialProofGuidance}

Generate a complete landing page with 16 sections following this structure:

1. **Eyebrow Headline** (all caps, attention-grabbing, addresses target avatar's pain, max 100 chars)
   Example: "FOR UAE & GCC CRYPTO BEGINNERS"

2. **Main Headline** (long-form, benefit-driven, includes unique mechanism, 100-150 chars)
   Example: "Get Consistent, Halal Crypto Income in Just 6 Months - Or You Don't Pay a Dirham!"

3. **Subheadline** (explains why current methods fail or what makes this different, 150-200 chars)
   Example: "...No blocked accounts, stress, or risking your family's trust - even if you've lost money before or think the local banking system is impossible to beat."

4. **Primary CTA Button** (clear action, 3-6 words)
   Example: "Claim Your FREE Consultation!"

5. **As Seen In** (5 credible publication names as array)
   Example: ["Forbes", "Inc.", "Entrepreneur", "Yahoo Finance", "Business Insider"]
   NOTE: DO NOT include "Meta", "Facebook", or "Instagram" as these imply platform endorsement which violates Meta advertising policy

6. **Quiz/Question Section** (engaging question with 5 options and reveal answer, 200-300 words total)
   CRITICAL: The "answer" field MUST be a full 2-3 sentence explanation of why the correct option is right. NEVER leave answer empty, null, or just the option text. The answer must educate and surprise the reader.
   Example: "Can You Guess Which One of These 'Safe' Crypto Moves… Actually Gets Your Bank Account Flagged?"

7. **Problem Agitation** (emotional pain points, 200-300 words)
   Example: "Still Worrying You'll Be The Next Account Freeze Or Crypto Horror Story?"

8. **Solution Introduction** (introduces the unique mechanism, 200-300 words)
   Example: "If You've Tried P2P Groups, Chased Hot Signals, or Risked Your Bank Cards - and Still Aren't Seeing Real Crypto Profits..."

9. **Why Old Methods Fail** (contrarian angle, 200-300 words)
   CRITICAL: Name 2-3 SPECIFIC reasons why conventional approaches fail for this exact avatar. Tie each reason to the avatar's niche, pain points, and situation. Never use generic filler like "traditional methods don't work." Pull from the avatar's frustrations and prior failed attempts.
   Example: "Why Playing It 'Safe' With Mainstream Crypto Advice Actually Keeps You Stuck (and Broke)"

10. **Unique Mechanism Introduction** (names the proprietary system, 200-300 words)
    CRITICAL: Name a SPECIFIC proprietary methodology or system — give it a branded name derived from the product and avatar context. Describe what it does in 2-3 concrete sentences. If the product description mentions a named method, USE that name. Never write generic copy like "our unique system" — it must have a real name and specific steps.
    Example: "Introducing the 'Steady Wealth Protocol': Your Step-by-Step Safe Haven in Middle East Crypto"

11. **Social Proof / Testimonials** (4 testimonials with headline, quote, name, location)
    Example: 
    - Headline: "No More Blocked Accounts"
    - Quote: "Before this, every time I tried cashing out, my bank flagged me. Now I follow their exact steps and my accounts are safe. Finally, I have peace of mind."
    - Name: "Mohammed S."
    - Location: "Abu Dhabi, UAE"

12. **Insider Advantages** (what makes it different, 200-300 words)
    Example: "Unlock Insider Advantages: Built on Real Middle East Banking, Not Generic Advice"

13. **Scarcity / Urgency** (limited enrollment messaging, 200-300 words)
    Example: "The Steady Wealth Protocol Doors Are Only Open For a Short Window (Secure Your Spot Now)"

14. **Shocking Statistic** (data-driven fear, 150-200 words)
    CRITICAL: Generate a SPECIFIC, believable statistic relevant to this avatar's niche. Use a concrete percentage or number (e.g. "87% of...", "Only 3 in 100..."). The stat must feel real and credible for this industry — not a generic placeholder. Format as one punchy opening sentence with the stat, followed by 2-3 sentences explaining what it means for the avatar.
    Example: "92% of UAE Crypto Beginners Will Never Build Real Wealth Without a Proven System"

15. **Time-Saving Benefit** (shortcut positioning, 150-200 words)
    Example: "Save Yourself Years of Painful Guesswork: Our Blueprint Gives You the Shortcut to Real Crypto Income"

16. **Consultation Outline** (10 numbered items with title and description)
    Example:
    1. "Step-by-Step Roadmap" - "Follow our Steady Wealth Protocol to take you from frustrated beginner to confident crypto earner - with every safe step mapped out."
    2. "Done-For-You Templates" - "Plug-and-play scripts, checklists, and spreadsheets for every transaction, from your first crypto buy to safe cashing out."
    ... (8 more items)

Return as JSON matching the LandingPageContent type.
Use the avatar's name, location, and description throughout the copy to personalize it.
Make it compelling, benefit-driven, and conversion-focused.
Use direct response copywriting principles: pain agitation, unique mechanism, social proof, scarcity, and strong CTAs.

CRITICAL FORMATTING: All string values must be plain text. NO markdown syntax anywhere — no asterisks (*), no hash symbols (#), no bold (**text**), no italic (*text*), no bullet markers. Just clean sentences and paragraphs separated by line breaks.

CRITICAL CONTENT: Every single one of the 16 sections MUST contain substantial content. Never return an empty string for any section. shockingStat must contain a specific statistic. whyOldFail must contain 2-3 named reasons. Every section must be 50+ words minimum.
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a world-class direct response copywriter specializing in high-converting landing pages. You write compelling, benefit-driven copy that converts visitors into customers. FORMATTING RULE: Return plain text only inside all JSON string values. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting of any kind. No bullet markers. Just clean readable sentences and paragraphs." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "landing_page_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            eyebrowHeadline: { type: "string" },
            mainHeadline: { type: "string" },
            subheadline: { type: "string" },
            primaryCta: { type: "string" },
            asSeenIn: { 
              type: "array", 
              items: { type: "string" }
            },
            quizSection: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { 
                  type: "array", 
                  items: { type: "string" }
                },
                answer: { type: "string" }
              },
              required: ["question", "options", "answer"],
              additionalProperties: false
            },
            problemAgitation: { type: "string" },
            solutionIntro: { type: "string" },
            whyOldFail: { type: "string" },
            uniqueMechanism: { type: "string" },
            testimonials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  quote: { type: "string" },
                  name: { type: "string" },
                  location: { type: "string" }
                },
                required: ["headline", "quote", "name", "location"],
                additionalProperties: false
              }
            },
            insiderAdvantages: { type: "string" },
            scarcityUrgency: { type: "string" },
            shockingStat: { type: "string" },
            timeSavingBenefit: { type: "string" },
            consultationOutline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" }
                },
                required: ["title", "description"],
                additionalProperties: false
              }
            }
          },
          required: [
            "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
            "asSeenIn", "quizSection", "problemAgitation", "solutionIntro",
            "whyOldFail", "uniqueMechanism", "testimonials", "insiderAdvantages",
            "scarcityUrgency", "shockingStat", "timeSavingBenefit", "consultationOutline"
          ],
          additionalProperties: false
        }
      }
    }
  });

  // Add error handling for undefined response
  if (!response || !response.choices || response.choices.length === 0) {
    console.error('Invalid LLM response:', JSON.stringify(response, null, 2));
    throw new Error('Invalid response from LLM: no choices returned');
  }
  
  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('Invalid response format from LLM');
  }
  // Strip markdown code fences if LLM wraps response in ```json ... ```
  const cleaned = content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
  const parsed = JSON.parse(cleaned);

  // Strip any markdown formatting from all string values
  function stripMarkdown(val: unknown): unknown {
    if (typeof val === "string") {
      return val
        .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
        .replace(/\*(.*?)\*/g, '$1')       // *italic* → italic
        .replace(/^#{1,6}\s+/gm, '')       // # heading → heading
        .replace(/^[-*]\s+/gm, '')         // - bullet → bullet
        .trim();
    }
    if (Array.isArray(val)) return val.map(stripMarkdown);
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = stripMarkdown(v);
      }
      return out;
    }
    return val;
  }
  const cleanParsed = stripMarkdown(parsed) as Record<string, unknown>;

  // Validate and add fallbacks for all required fields
  const validated: LandingPageContent = {
    eyebrowHeadline: (cleanParsed.eyebrowHeadline as string) || 'SPECIAL OFFER',
    mainHeadline: (cleanParsed.mainHeadline as string) || 'Transform Your Results Today',
    subheadline: (cleanParsed.subheadline as string) || 'Discover how to achieve your goals faster than ever before',
    primaryCta: (cleanParsed.primaryCta as string) || 'Get Started Now',
    asSeenIn: Array.isArray(cleanParsed.asSeenIn) && cleanParsed.asSeenIn.length > 0 ? cleanParsed.asSeenIn as string[] : ['Featured'],
    quizSection: (cleanParsed.quizSection as any) || {
      question: 'What is your biggest challenge?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 'Option A'
    },
    problemAgitation: (cleanParsed.problemAgitation as string) || '[Generation incomplete — please regenerate this section]',
    solutionIntro: (cleanParsed.solutionIntro as string) || '[Generation incomplete — please regenerate this section]',
    whyOldFail: (cleanParsed.whyOldFail as string) || '[Generation incomplete — please regenerate this section]',
    uniqueMechanism: (cleanParsed.uniqueMechanism as string) || '[Generation incomplete — please regenerate this section]',
    testimonials: Array.isArray(cleanParsed.testimonials) && cleanParsed.testimonials.length > 0 ? cleanParsed.testimonials as any : [
      {
        headline: 'Life-Changing Results',
        quote: 'This completely transformed how I approach my goals.',
        name: 'A Satisfied Customer',
        location: 'Worldwide'
      }
    ],
    insiderAdvantages: (cleanParsed.insiderAdvantages as string) || '[Generation incomplete — please regenerate this section]',
    scarcityUrgency: (cleanParsed.scarcityUrgency as string) || '[Generation incomplete — please regenerate this section]',
    shockingStat: (cleanParsed.shockingStat as string) || '[Generation incomplete — please regenerate this section]',
    timeSavingBenefit: (cleanParsed.timeSavingBenefit as string) || '[Generation incomplete — please regenerate this section]',
    consultationOutline: Array.isArray(cleanParsed.consultationOutline) && cleanParsed.consultationOutline.length > 0 ? cleanParsed.consultationOutline as any : [
      {
        title: 'Assessment',
        description: 'We evaluate your current situation'
      },
      {
        title: 'Strategy',
        description: 'We create a custom plan for you'
      },
      {
        title: 'Implementation',
        description: 'We help you execute and succeed'
      }
    ]
  };
  
  return validated;
}

// Per-angle timeout wrapper — prevents one slow AI response from blocking the entire job
async function generateWithTimeout(
  productName: string,
  productDescription: string,
  avatarName: string,
  avatarDescription: string,
  angle: 'original' | 'godfather' | 'free' | 'dollar',
  socialProof: any,
  timeoutMs = 300_000
): Promise<LandingPageContent> {
  return Promise.race([
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, angle, socialProof),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Landing page ${angle} angle timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

// Generate all 4 angles in parallel.
// onAngleComplete(completed, total) is called after each angle finishes so callers
// can write real progress updates to the job record during generation.
export async function generateAllAngles(
  productName: string,
  productDescription: string,
  avatarName: string,
  avatarDescription: string,
  socialProof: any,
  onAngleComplete?: (completed: number, total: number) => Promise<void>
): Promise<{
  original: LandingPageContent;
  godfather: LandingPageContent;
  free: LandingPageContent;
  dollar: LandingPageContent;
}> {
  const TOTAL = 4;
  let completed = 0;
  const notify = async () => {
    completed++;
    if (onAngleComplete) {
      try { await onAngleComplete(completed, TOTAL); } catch { /* progress write failure is non-fatal */ }
    }
  };

  // All 4 angles in parallel — cuts total time by ~75% vs sequential
  const [original, godfather, free, dollar] = await Promise.all([
    generateWithTimeout(productName, productDescription, avatarName, avatarDescription, 'original', socialProof).then(async r => { await notify(); return r; }),
    generateWithTimeout(productName, productDescription, avatarName, avatarDescription, 'godfather', socialProof).then(async r => { await notify(); return r; }),
    generateWithTimeout(productName, productDescription, avatarName, avatarDescription, 'free', socialProof).then(async r => { await notify(); return r; }),
    generateWithTimeout(productName, productDescription, avatarName, avatarDescription, 'dollar', socialProof).then(async r => { await notify(); return r; }),
  ]);
  return { original, godfather, free, dollar };
}
