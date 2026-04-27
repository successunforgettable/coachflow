import { invokeLLM } from "./_core/llm";
import type { LandingPageContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, truncateQuote } from "./_core/copywritingRules";

// The 12 simple-string fields in the landing-page schema. Each is
// declared `type: "string"` in the json_schema below; production data
// (JSON_TYPE inspection on 22 rows) confirmed the LLM sometimes emits
// these as nested {body, headline} objects instead of flat strings,
// which previously slipped through three layers (JSON.parse, the
// validated block's `||` fallback, MySQL JSON column storage) and
// reached the renderer as visible JSON syntax. The runtime typeof
// check below is the content-safety layer that prevents this; it is
// permanent and survives the planned Option B tool-use migration
// (tool-use enforces type at the API level, but a no-cost runtime
// check is belt-and-braces — kept).
const LP_STRING_SCHEMA_FIELDS = [
  "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
  "problemAgitation", "solutionIntro", "whyOldFail", "uniqueMechanism",
  "insiderAdvantages", "scarcityUrgency", "shockingStat", "timeSavingBenefit",
] as const;

// Bounded retry on schema-violating model output. Three attempts gives
// the model two retries to produce schema-conforming output before
// throwing; if all three return at least one non-string field, we
// fail the generation rather than store structurally corrupt content.
const LP_SCHEMA_RETRY_MAX_ATTEMPTS = 3;

// Angle-specific prompt modifiers based on industry research
const ANGLE_PROMPTS = {
  original: `
Generate a benefit-driven landing page emphasizing the unique mechanism and transformation.

Focus on:
- Specific results and timeframe
- Proprietary system name
- Step-by-step process
- Guarantee included

CTA: "Claim Your FREE Consultation!"
  `,
  godfather: `
Generate a landing page with an IRRESISTIBLE OFFER using risk reversal.

Focus on:
- Money-back guarantee
- "Or you don't pay" - removes all risk
- Making it impossible to say no
- Risk reversal throughout copy

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
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}
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

EMOTIONAL ARC — every section of this landing page must serve a specific emotional purpose in sequence. A visitor who reads from top to bottom must feel each emotion in order:
Section 1 (Hero — eyebrow + main headline + subheadline): SEEN AND UNDERSTOOD. The reader must feel "this person knows exactly who I am and what I'm going through." Use their internal language. Name their situation precisely.
Section 2 (Problem — quizSection + problemAgitation): NAMED AND VALIDATED. "Finally, someone has put words to this." The problem must be described so accurately that the reader feels exposed. Name the specific daily situation, not a category of pain.
Section 3 (Agitate — whyOldFail + shockingStat): COST OF INACTION. "I cannot afford to stay here." Make the cost of not solving this problem feel concrete and immediate. Name the specific ways staying stuck is costing them (time, money, relationships, self-respect).
Section 4 (Solution — solutionIntroduction): HOPE. "There might be a way out." Introduce the possibility of a different outcome before introducing the mechanism. Make hope feel credible, not hype.
Section 5 (Mechanism — uniqueMechanismIntro): DIFFERENT FROM WHAT THEY'VE TRIED. "This is not the same thing I've already failed with." Explicitly name 1-2 things they've already tried and explain why this is structurally different — not just "better."
Section 6 (Proof — socialProofTestimonials + insiderAdvantages): SAFE TO BELIEVE. "Other people like me have done this." Testimonials must feel like real people, not marketing copy. Quote specific situations and specific results.
Section 7 (Offer — scarcityUrgency + timeSavingBenefit + consultationOutline): OBVIOUS NEXT STEP. "Not buying would be irrational." The offer must stack so much value that the question becomes "why wouldn't I?" Apply anchoring — state total value before the ask.

Generate a complete landing page with 16 sections following this structure:

1. **Eyebrow Headline** (all caps, attention-grabbing, addresses target avatar's pain, max 100 chars)
   Example: "FOR UAE & GCC CRYPTO BEGINNERS"

2. **Main Headline** (long-form, benefit-driven, 100-150 chars)
   A great landing page headline does three things simultaneously: (1) identifies the exact person it is written for so precisely that anyone else feels excluded, (2) names the specific outcome they want using their own words not marketing language, (3) signals that this is different from everything they have already tried. Do not use fill-in-the-blank template patterns — write a headline that could only exist for this specific product and this specific avatar. The headline must not use any of these words: ${BANNED_COPYWRITING_WORDS.join(', ')}.

3. **Subheadline** (explains why current methods fail or what makes this different, 150-200 chars)
   Example: "...No blocked accounts, stress, or risking your family's trust - even if you've lost money before or think the local banking system is impossible to beat."

4. **Primary CTA Button** (clear action, 3-6 words)
   Example: "Claim Your FREE Consultation!"

5. **As Seen In** (5 credible publication names as array)
   Example: ["Forbes", "Inc.", "Entrepreneur", "Yahoo Finance", "Business Insider"]
   NOTE: DO NOT include "Meta", "Facebook", or "Instagram" as these imply platform endorsement which violates Meta advertising policy

6. **Quiz/Question Section** (niche-specific question with 5 plausible options and a surprising reveal answer, 200-300 words total)
   A great quiz question does two things: it makes the reader feel smart for knowing the answer (or curious because they don't), and it reframes their understanding of the problem. Rules: the question must use insider language from the target market; every option must sound genuinely plausible — a good option is one the reader would seriously consider before seeing the answer; the answer must surprise the reader and teach them something they could not have known without reading this page; the question must name a specific scenario from the niche, not a generic category. BANNED quiz patterns (too generic, do not use): "Which of these is the most important X", "What is the first step to X", "How many X do you need to Y".

7. **Problem Agitation** (emotional pain points, 200-300 words)
   Example: "Still Worrying You'll Be The Next Account Freeze Or Crypto Horror Story?"

8. **Solution Introduction** (introduces the unique mechanism, 200-300 words)
   Example: "If You've Tried P2P Groups, Chased Hot Signals, or Risked Your Bank Cards - and Still Aren't Seeing Real Crypto Profits..."

9. **Why Old Methods Fail** (contrarian angle, 200-300 words)
   Example: "Why Playing It 'Safe' With Mainstream Crypto Advice Actually Keeps You Stuck (and Broke)"

10. **Unique Mechanism Introduction** (names the proprietary system, 200-300 words)
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
    Example: "92% of UAE Crypto Beginners Will Never Build Real Wealth Without a Proven System"

15. **Time-Saving Benefit** (shortcut positioning, 150-200 words)
    Example: "Save Yourself Years of Painful Guesswork: Our Blueprint Gives You the Shortcut to Real Crypto Income"

16. **Consultation Outline** (10 numbered items, each with a specific title and a deliverable-focused description)
    The consultation outline must feel like a genuine agenda, not a marketing list. Each item must name the specific deliverable the client will have at the end of that segment — what they have after that step that they did not have before it. BANNED consultation outline patterns (do not use as titles or descriptions): "Introduction and welcome", "Q&A", "Next steps", "Strategy overview", "Getting to know you" — these are placeholders, not deliverables. Every item must name a specific analysis, assessment, calculation, or output. Example: "Revenue Gap Analysis — At the end of this segment you will have a precise number: the exact monthly gap between your current income and your target, and the three specific levers available to close it."

SPECIFICITY CHECK — apply this before returning the JSON:
For every section, ask: does this section contain at least one phrase that could only appear on a landing page for THIS specific service in THIS specific niche? If any section contains only generic direct response language that could apply to any coaching programme, rewrite that section before returning. The test: mentally swap the product name for a different coaching product in a different niche. If the section still makes sense without any changes, it is not specific enough. Rewrite until it only makes sense for this product, this avatar, and this outcome.

Return as JSON matching the LandingPageContent type.
Use the avatar's name, location, and description throughout the copy to personalize it.
Make it compelling, benefit-driven, and conversion-focused.
Use direct response copywriting principles: pain agitation, unique mechanism, social proof, scarcity, and strong CTAs.
`;

  // Schema-violation retry. Wraps the LLM call + parse + type-check in a
  // bounded loop; if the model emits a non-string value for any field
  // declared as type:"string", we discard it and retry rather than store
  // structurally corrupt content. Permanent — Option B's tool-use
  // migration enforces types server-side, this runtime check stays as
  // belt-and-braces.
  for (let leakAttempt = 1; leakAttempt <= LP_SCHEMA_RETRY_MAX_ATTEMPTS; leakAttempt++) {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: `You are a world-class direct response copywriter specializing in high-converting landing pages. You engineer an emotional arc through each page — every section serves a specific emotional purpose, moving the reader from 'seen and understood' through 'named and validated', 'cost of inaction', 'hope', 'different from what they've tried', 'safe to believe', and finally 'obvious next step'. You write in the customer's own language — the words they use with a close friend, not marketing language. FORMATTING RULE: Return plain text only inside all JSON string values. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting of any kind. No bullet markers. Just clean readable sentences and paragraphs.\n\n${META_COMPLIANCE_NOTES}` },
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

  // Runtime type-check on schema-declared string fields. Production
  // evidence (JSON_TYPE inspection across 22 rows: 13 corrupted, 59%)
  // shows the LLM frequently emits {body, headline} nested objects for
  // long-form sections where the schema declares `type: "string"`.
  // JSON.parse, the validated-block's `||` fallback, and MySQL's JSON
  // column all accept this without complaint, so the corruption surfaces
  // only at render time. Catch it here.
  let schemaViolated = false;
  for (const field of LP_STRING_SCHEMA_FIELDS) {
    const got = (parsed as Record<string, unknown>)[field];
    if (typeof got !== "string") {
      console.warn(
        `[landingPageGenerator] Schema violation on attempt ${leakAttempt}/${LP_SCHEMA_RETRY_MAX_ATTEMPTS} ` +
        `(angle=${angle}, field=${field}, gotType=${got === null ? "null" : typeof got}). Retrying.`,
      );
      schemaViolated = true;
      break;
    }
  }
  if (schemaViolated) continue;

  // No more silent-fallback layer. The previous validated-block pattern
  // (`parsed.X || 'fallback content'`) hid 5 weeks of model omissions
  // by substituting placeholder strings — primaryCta omitted on 100% of
  // production generations, masked as "Get Started Now"; OBJECT-typed
  // body sections rendered as visible JSON syntax. Under invokeLLM's
  // tool-use migration, every required field is enforced server-side
  // by Anthropic before the response returns. The typeof retry loop
  // above is belt-and-braces over that enforcement. Past this point,
  // `parsed` matches LandingPageContent by contract.
  return parsed as LandingPageContent;
  }

  throw new Error(
    `Landing page generation failed for angle "${angle}": all ${LP_SCHEMA_RETRY_MAX_ATTEMPTS} attempts produced schema-violating output. Aborting rather than storing corrupt content.`,
  );
}

// Generate all 4 angles at once.
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
  // Generate in 2 batches of 2 to avoid overwhelming the LLM API with 4 concurrent
  // large JSON-structured requests (each ~8k tokens), which can cause "fetch failed" timeouts.
  const TOTAL = 4;
  let completed = 0;
  const notify = async () => {
    completed++;
    if (onAngleComplete) {
      try { await onAngleComplete(completed, TOTAL); } catch { /* progress write failure is non-fatal */ }
    }
  };

  const [original, godfather] = await Promise.all([
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'original', socialProof).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'godfather', socialProof).then(async r => { await notify(); return r; }),
  ]);
  const [free, dollar] = await Promise.all([
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'free', socialProof).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'dollar', socialProof).then(async r => { await notify(); return r; }),
  ]);
  return { original, godfather, free, dollar };
}
