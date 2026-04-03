/**
 * ICP prompt functions — shared by icps.ts generate (sync) and generateAsync.
 * Keeping them here prevents the two code paths from drifting apart and removes
 * the circular dependency risk of importing from a router file.
 */

import { getGlobalNegativePrompts } from "../lib/complianceFilter";

export type ICPServiceInput = {
  name: string;
  category: string | null;
  description: string | null;
  targetCustomer: string | null;
  mainBenefit: string | null;
};

export function ICP_SYSTEM_PROMPT(): string {
  return `You are an expert direct response copywriter who writes Ideal Customer Profiles from inside the customer's head — using their internal monologue, not a textbook description. You write in the specific language of this niche, not generic marketing language. Every answer must be so specific that the customer reads it and thinks "this is about me." Always respond with valid JSON. Never produce content containing: ${getGlobalNegativePrompts().join(", ")}.`;
}

export function ICP_USER_PROMPT(service: ICPServiceInput): string {
  return `Create a detailed Ideal Customer Profile (ICP) for the following service. Write from INSIDE the customer's head — use their internal monologue, not a textbook description of them.

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

VOICE RULES — apply to every section:
- Write as if you are narrating the customer's internal experience, not describing them from the outside
- Use specific situations, not generic emotions ("It's 2am and I'm refreshing my inbox again" not "they feel anxious")
- Every bullet point must be niche-specific — if it could appear in any coach's ICP, rewrite it
- Use the language they use with a close friend, not the language they'd use in a job interview

Generate a comprehensive ICP with ALL 17 sections:

1. INTRODUCTION: 2-3 paragraphs. Who is this person right now — their current situation, their daily life, their stuck state. Use their internal voice. Name their niche, their role, their specific problem.

2. FEARS: 5-7 fears. Each fear = the 3am version — the thought that wakes them at 3am, not the polite daytime version. Format: "I lie awake worrying that [specific fear]..." Not: "They fear failure."

3. HOPES & DREAMS: 5-7 hopes. Each must name a SPECIFIC desired situation — what their life looks like on the day everything has worked. Not feelings. Situations.

4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status — make these specific and realistic for this exact niche.

5. PSYCHOGRAPHICS: 3-4 paragraphs. Personality traits, lifestyle, attitudes, interests — all niche-specific. What do they do on weekends? What do they read? What podcasts do they listen to? What do they argue about online?

6. PAINS: 7-10 pains. Each pain = a specific daily situation, not an emotion. Format: "Every [day/week/month], [specific situation that happens to them]." Not: "They struggle with marketing."

7. FRUSTRATIONS: 5-7 frustrations. The things that make them say "WHY does this always happen to me?" — niche-specific, situational, specific enough to recognise themselves in.

8. GOALS: 6-8 goals. Each goal = a specific outcome they can picture — a number, a situation, a moment. Not "grow their business." What does it look and feel like when they've succeeded?

9. VALUES: 5-7 values. Not generic values (hard work, family). The values that CONFLICT with what they need to do to solve their problem — the values that make them resist buying or taking action.

10. OBJECTIONS: 5-7 objections. Each objection = the REAL reason they won't buy — not the polite reason they'd tell a salesperson. Format: "What they say: [polite objection]. What they mean: [real objection]."

11. BUYING TRIGGERS: 5-7 triggers. Each trigger = the SPECIFIC MOMENT that breaks the dam — the event, conversation, or realisation that pushes them from considering to buying. "The moment I knew I had to do something was when..."

12. MEDIA CONSUMPTION: Specific platforms, specific channels, specific shows, specific newsletters, specific communities — for this exact niche.

13. INFLUENCERS: Specific names of people they follow and why — not "industry experts" but real figures relevant to this niche.

14. COMMUNICATION STYLE: How they prefer to communicate — specific to their niche and demographics. What turns them off? What makes them trust someone?

15. DECISION MAKING: How they actually make purchasing decisions — who they consult, how long they take, what triggers action vs paralysis.

16. SUCCESS METRICS: How they measure whether something has worked — their specific KPIs, the numbers they track, the feeling they're chasing.

17. IMPLEMENTATION BARRIERS: What stops them from taking action AFTER they've decided to buy — the real friction points, niche-specific.

Format as JSON with these exact keys (use bullet points • for lists where appropriate):
{
  "introduction": "...",
  "fears": "• Fear 1\\n• Fear 2\\n...",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n...",
  "demographics": { ... },
  "psychographics": "...",
  "pains": "• Pain 1\\n• Pain 2\\n...",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n...",
  "goals": "• Goal 1\\n• Goal 2\\n...",
  "values": "• Value 1\\n• Value 2\\n...",
  "objections": "• Objection 1\\n• Objection 2\\n...",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n...",
  "mediaConsumption": "...",
  "influencers": "...",
  "communicationStyle": "...",
  "decisionMaking": "...",
  "successMetrics": "...",
  "implementationBarriers": "..."
}`;
}
