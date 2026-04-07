/**
 * Issue 3: Ad Copy Angle Diversity
 *
 * 18 distinct psychological angles for ad body copy generation.
 * Includes 15 core angles + 3 PDC (Pain/Desire/Circumstance) angles added in W2.
 */

import { BANNED_COPYWRITING_WORDS } from "./_core/copywritingRules";

export type BodyAngle =
  | "pain_agitation"
  | "social_proof"
  | "authority"
  | "curiosity"
  | "story"
  | "urgency"
  | "benefit_stack"
  | "comparison"
  | "question"
  | "guarantee"
  | "transformation"
  | "contrarian"
  | "data_driven"
  | "emotional"
  | "direct_response"
  | "pain_pdc"
  | "desire_pdc"
  | "circumstance_pdc";

export const BODY_ANGLE_PROMPTS: Record<BodyAngle, string> = {
  pain_agitation: `
Generate body copy using the PAS (Problem-Agitate-Solution) formula:

Structure:
1. PROBLEM (30-40 words): Identify the specific pain point from pressing problem
2. AGITATE (40-50 words): Amplify the emotional impact, make it visceral and urgent
3. SOLUTION (40-60 words): Present the unique mechanism as the answer, end with clear CTA

Tone: Empathetic but direct, emotional intensity builds through sections
Hook: Start with "You know that feeling when..."
Example: "You know that feeling when you see another crypto opportunity slip by because you're paralyzed by fear of losing money? That frustration compounds every single day. While others are building wealth, you're stuck researching endlessly, second-guessing every move, watching your savings sit idle. The [Unique Mechanism] removes that paralyzing fear with a proven 9-step system that turns beginners into confident investors. [CTA]"
`,

  social_proof: `
Generate testimonial-driven body copy:

Structure:
1. CREDIBILITY HOOK (20-30 words): Establish trust with customer count or authority
2. TESTIMONIAL STORY (50-70 words): Share specific customer transformation with name/location (if available) or "One client" if not
3. PROOF STACK (30-40 words): Add 2-3 more brief success indicators
4. CTA (20-30 words): Invite reader to join successful customers

Tone: Authentic, specific, evidence-based
Hook: Start with "[X] customers have already..." or "Real results from real people:"
CRITICAL: Only use real testimonials/customer counts from social proof data. If none provided, use outcome-based language WITHOUT specific names.
`,

  authority: `
Generate expert-endorsed body copy:

Structure:
1. AUTHORITY INTRO (25-35 words): Introduce credible expert/authority figure
2. CREDENTIALS (30-40 words): Establish why this authority is trustworthy
3. ENDORSEMENT (40-50 words): Authority explains why unique mechanism works
4. INVITATION (20-30 words): Position reader as insider accessing expert knowledge

Tone: Professional, credible, insider access
Hook: Start with "[Authority] reveals..." or "According to [Expert]..."
Example: "Award-winning crypto educator [Name] spent 7 years testing every beginner strategy. After analyzing 10,000+ portfolios, he discovered that 92% of new investors fail because they skip one critical step. His [Unique Mechanism] fixes this exact gap. [CTA]"
`,

  curiosity: `
Generate mystery-driven body copy with open loops:

Structure:
1. INTRIGUE HOOK (25-35 words): Pose mysterious question or counterintuitive claim
2. TEASE (40-50 words): Hint at the answer without revealing, build tension
3. MECHANISM REVEAL (40-50 words): Partially reveal unique mechanism as the "secret"
4. CURIOSITY CTA (20-30 words): Promise full reveal behind the click

Tone: Mysterious, intriguing, "insider information" feel
Hook: Start with "What if I told you..." or "There's something most people don't know about..."
Avoid: Sensationalist banned phrases like "shocking secret" or "they don't want you to know"
`,

  story: `
Generate narrative-driven body copy with hero's journey:

Structure:
1. RELATABLE HERO (30-40 words): Introduce protagonist similar to target market
2. STRUGGLE (40-50 words): Show their pain and failed attempts
3. DISCOVERY (30-40 words): How they found the unique mechanism
4. TRANSFORMATION (20-30 words): Brief outcome + CTA to start their journey

Tone: Narrative, relatable, inspirational
Hook: Start with "Meet [Name/Role]..." or "[Time period] ago, [Hero] was exactly where you are..."
Example: "6 months ago, Sarah was a frustrated crypto beginner losing sleep over every market dip. She'd tried YouTube tutorials, Discord groups, even paid for courses—nothing clicked. Then she discovered the [Unique Mechanism]. Today, she confidently manages her portfolio without the constant anxiety. [CTA]"
`,

  urgency: `
Generate scarcity-driven body copy (MUST be truthful):

Structure:
1. OPPORTUNITY FRAME (25-35 words): Present the time-sensitive opportunity
2. SCARCITY REASON (40-50 words): Explain WHY it's limited (capacity, resources, exclusivity)
3. CONSEQUENCE (30-40 words): What happens if they wait
4. ACTION CTA (20-30 words): Clear next step with time element

Tone: Urgent but professional, not manipulative
Hook: Start with "Applications now open" or "Limited enrollment period"
CRITICAL: Only use real scarcity (actual enrollment limits, genuine deadlines). Do NOT fabricate "only 3 spots left" unless literally true.
`,

  benefit_stack: `
Generate feature-list body copy:

Structure:
1. VALUE PROMISE (20-30 words): Overall transformation statement
2. BENEFIT LIST (60-80 words): 4-5 specific benefits with brief explanations, use bullet format in prose
3. MECHANISM CONTEXT (30-40 words): How the unique mechanism delivers these benefits
4. CTA (15-25 words): Simple action step

Tone: Clear, value-focused, organized
Hook: Start with "Here's exactly what you'll get:" or "Inside [Product]:"
Format: "You'll get [Benefit 1] so you can [outcome]. Plus [Benefit 2] that [outcome]. And [Benefit 3]..."
`,

  comparison: `
Generate before/after contrast body copy:

Structure:
1. CURRENT STATE (30-40 words): Paint picture of "before" situation
2. CONTRAST (40-50 words): Show the gap between where they are and where they want to be
3. BRIDGE (30-40 words): Unique mechanism as the path across the gap
4. FUTURE STATE CTA (20-30 words): Invite them to cross the bridge

Tone: Aspirational, contrast-focused, hopeful
Hook: Start with "Right now you're..." or "There are two types of [audience]..."
Avoid: Prohibited before/after language like "I was broke, now I'm rich"
Use: Process contrast not outcome guarantees
`,

  question: `
Generate Socratic method body copy:

Structure:
1. OPENING QUESTION (20-30 words): Thought-provoking question that makes them think "yes, that's me"
2. FOLLOW-UP QUESTIONS (40-50 words): 2-3 more questions that dig deeper into the problem
3. ANSWER REVEAL (40-50 words): Unique mechanism presented as the answer to all questions
4. QUESTION CTA (20-30 words): Final question that prompts action

Tone: Conversational, engaging, Socratic
Hook: Start with "Have you ever wondered why..." or "What if the reason you're stuck is..."
Example: "Why do 90% of crypto beginners quit within 6 months? Is it because they lack discipline? Or because they chose the wrong coins? Actually, it's neither. It's because they're missing the [Unique Mechanism] that turns confusion into clarity. Ready to discover what you've been missing? [CTA]"
`,

  guarantee: `
Generate risk-reversal body copy:

Structure:
1. BOLD PROMISE (25-35 words): State the guarantee upfront
2. PROOF MECHANISM (40-50 words): Explain how/why you can make this guarantee
3. RISK COMPARISON (30-40 words): Show how this removes all risk compared to alternatives
4. GUARANTEE CTA (20-30 words): Emphasize zero-risk action

Tone: Confident, reassuring, risk-free
Hook: Start with "Here's our guarantee:" or "You risk nothing:"
CRITICAL: Only use real guarantees (actual money-back policies, real refund terms). Do NOT fabricate guarantees.
`,

  transformation: `
Generate identity-shift body copy:

Structure:
1. IDENTITY GAP (30-40 words): Contrast current identity with desired identity
2. IDENTITY BARRIER (35-45 words): What's keeping them from becoming that person
3. MECHANISM AS BRIDGE (35-45 words): How unique mechanism facilitates identity transformation
4. NEW IDENTITY CTA (20-30 words): Invite them to step into new identity

Tone: Aspirational, identity-focused, empowering
Hook: Start with "You're not a [current identity]. You're a [desired identity] waiting to emerge."
Example: "You're not 'bad with crypto.' You're a confident investor who just hasn't found the right system yet. The only thing standing between you and that identity is the [Unique Mechanism]. [CTA]"
`,

  contrarian: `
Generate belief-challenging body copy:

Structure:
1. COMMON BELIEF (25-35 words): State the conventional wisdom everyone believes
2. CHALLENGE (40-50 words): Explain why that belief is wrong or incomplete
3. TRUTH REVEAL (40-50 words): Present unique mechanism as the contrarian truth
4. REBEL CTA (15-25 words): Invite them to reject conventional wisdom

Tone: Contrarian, confident, myth-busting
Hook: Start with "Everything you've been told about [topic] is wrong." or "Here's what most people get backwards:"
Avoid: Sensationalist language like "banned method" or "what they don't want you to know"
`,

  data_driven: `
Generate statistics-based body copy:

Structure:
1. SHOCKING STAT (20-30 words): Lead with compelling data point
2. CONTEXT (40-50 words): Explain what this statistic means for the reader
3. SOLUTION DATA (40-50 words): Present unique mechanism with supporting data/research
4. DATA CTA (20-30 words): Invite them to join the winning percentage

Tone: Analytical, evidence-based, credible
Hook: Start with "[X]% of [audience] struggle with..." or "Research shows that..."
CRITICAL: Only use real statistics. If no data provided, use qualitative language instead.
`,

  emotional: `
Generate empathy-driven body copy:

Structure:
1. EMOTIONAL MIRROR (30-40 words): Reflect their emotional state back to them
2. SHARED EXPERIENCE (40-50 words): Show you understand because you've been there
3. HOPE INTRODUCTION (35-45 words): Present unique mechanism as path to emotional relief
4. EMOTIONAL CTA (15-25 words): Invite them to feel different

Tone: Empathetic, vulnerable, connecting
Hook: Start with "I know how it feels to..." or "That weight you're carrying..."
Example: "That knot in your stomach every time you think about your crypto portfolio? I've felt it too. The constant worry that you're one wrong move away from losing everything. The [Unique Mechanism] replaced that anxiety with confidence for me—and it can for you too. [CTA]"
`,

  direct_response: `
Generate action-focused body copy:

Structure:
1. CLEAR OFFER (25-35 words): State exactly what they're getting
2. VALUE PROPOSITION (40-50 words): Why this offer solves their problem
3. SIMPLE PROCESS (30-40 words): Break down the easy steps to get started
4. STRONG CTA (20-30 words): Direct, clear action command

Tone: Direct, no-nonsense, action-oriented
Hook: Start with "Here's what you need to do:" or "The solution is simpler than you think:"
Format: Short sentences, active voice, imperative verbs
Example: "Want to master crypto without the confusion? Here's the plan: Download the [Unique Mechanism] framework. Follow the 9 simple steps. Start building your portfolio with confidence. It's that straightforward. [CTA]"
`,

  pain_pdc: `
Generate body copy using the PDC Pain angle — agitate a specific struggle the ICP is living right now.

Framework: PDC Pain (Pain / Desire / Circumstance) — Pain leg.

Structure following PAS:
1. PAIN — Name the pain precisely (30-40 words): Use the exact language the ICP uses to describe this struggle to a friend. Name the specific daily frustration — not a category, the actual lived experience. The first sentence must be about their situation, not the product.
2. AGITATE — Show the cost of staying stuck (40-50 words): Make the pain heavier. Name what they are losing every week they don't solve this. Name the failed solutions they have already tried and why those failed. Keep sentences short — maximum 15 words each.
3. SOLUTION — Position the offer as the only logical exit (40-60 words): Introduce the unique mechanism. Name what makes it structurally different from everything they have tried. Include one specific outcome or timeframe tied to the pressing problem.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data provided — their pains, fears, objections, and buying triggers — to make every sentence specific to this exact person. Do not write for a generic audience.

Tone: Empathetic but direct. No motivation-poster language. No fluff. Write like a trusted friend who has solved this exact problem.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,

  desire_pdc: `
Generate body copy using the PDC Desire angle — paint the specific outcome the ICP wants most.

Framework: PDC Desire (Pain / Desire / Circumstance) — Desire leg.

Structure following PAS:
1. PAIN — Acknowledge where they are now before painting the desire (20-30 words): One short sentence naming the gap between where they are and where they want to be. This grounds the desire in reality, not fantasy.
2. AGITATE — Show how close they already are (40-50 words): Name the specific thing that is keeping them from the outcome they want. It is not a lack of effort — name the missing mechanism. Make it feel frustrating that the gap is this small yet still feels so far.
3. SOLUTION — Position the offer as the final bridge (50-60 words): Describe the desired end state in concrete, specific terms — a number, a timeframe, a daily reality. Then show how the unique mechanism is the direct bridge to that state. Be aspirational but grounded: no guarantees, no hype.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data provided — their desires, buying triggers, and communication style — to make the desired end state feel personally relevant, not generic. Describe the outcome in the words they would use, not coaching language.

Tone: Aspirational but grounded. Specific outcomes, not emotional hyperbole. Write the desire in a way that feels achievable and earned, not wishful.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,

  circumstance_pdc: `
Generate body copy using the PDC Circumstance angle — mirror the ICP's exact current situation back at them.

Framework: PDC Circumstance (Pain / Desire / Circumstance) — Circumstance leg.

Structure following PAS:
1. PAIN — Describe where they are right now with precision (35-45 words): Mirror their exact current situation back at them so specifically that it feels like the ad was written for them personally. Name the stage they are at, the specific actions they are already taking, and why those actions are not producing the results they expect. Do not open with a question — open with an observation.
2. AGITATE — Identify what is holding them at this stage (40-50 words): Name the structural reason why effort alone is not enough. This is not a character flaw — it is a missing mechanism. Make it feel logical and obvious once named. Keep sentences under 15 words.
3. SOLUTION — Show the offer as the mechanism to move forward (40-55 words): Introduce the unique mechanism as the specific thing that addresses the exact bottleneck named in the agitation. Connect it directly to the circumstance described in the opening. One concrete outcome or timeframe.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data provided — their objections, current situation, communication style, and what makes them buy — to make the circumstance description feel unnervingly accurate. The goal is pattern recognition: the reader thinks "this is exactly me."

Tone: Observational, not salesy. Precise, not clinical. Write like someone who has studied this person's situation carefully and is describing it back without judgment.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,
};

export const ALL_BODY_ANGLES: BodyAngle[] = [
  "pain_agitation",
  "social_proof",
  "authority",
  "curiosity",
  "story",
  "urgency",
  "benefit_stack",
  "comparison",
  "question",
  "guarantee",
  "transformation",
  "contrarian",
  "data_driven",
  "emotional",
  "direct_response",
  "pain_pdc",
  "desire_pdc",
  "circumstance_pdc",
];
