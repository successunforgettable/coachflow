// server/routers/videoScripts.ts
// Generates AI scripts for video ads — FREE, no credits consumed
// Credit is only consumed when the user hits Generate Video

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { videoScripts, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export interface Scene {
  sceneNumber: number;
  duration: number;
  voiceoverText: string;
  visualDirection: string;
  onScreenText: string;
}

// ─── CREDIT COST BY DURATION ──────────────────────────────────────────────────
export function getCreditCost(duration: string): number {
  if (duration === "15" || duration === "30") return 1;
  if (duration === "60") return 2;
  if (duration === "90") return 3;
  return 1;
}

// ─── SCRIPT GENERATION PROMPTS ────────────────────────────────────────────────
function buildScriptPrompt(
  videoType: string,
  duration: number,
  service: any
): string {
  // ═══════════════════════════════════════════════════════════════════════════════
  // COPYWRITING RULES — THESE OVERRIDE EVERYTHING ELSE
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const NICHE_DETECTION = `
NICHE DETECTION — universal, not a fixed list.

ZAP serves any coach, speaker, consultant, or educator on the planet.
You will encounter niches you have never seen before. That is expected.
Your job is to detect and write in their world, whatever that world is.

STEP 1 — Read the service profile carefully. Extract:
- What does this person teach or help people do?
- Who specifically do they help? Not "people" — be specific.
- What does failure look like for that audience RIGHT NOW, today?
- What does success look like for that audience?
- What words does that audience use that an outsider would not?

STEP 2 — Identify the world. It could be any of these or something entirely different:
Fitness / health / nutrition / postpartum / menopause / athletic performance
Crypto / trading / investing / wealth building / financial freedom
Mindset / NLP / hypnotherapy / subconscious / limiting beliefs
Relationships / dating / marriage / divorce / attachment styles
Business / sales / lead generation / agency / freelancing / consulting
Spirituality / tarot / astrology / energy healing / manifestation
Parenting / motherhood / fatherhood / family systems
Career / executive / leadership / corporate / public speaking
Creative / music / writing / art / photography / film
Real estate / property / passive income / land investing
Language / education / academic / professional skills
Sports performance / coaching athletes / mental performance

This list is NOT exhaustive. If the coach teaches competitive barbecue judging — 
detect that world and write in its language.

STEP 3 — Write in their language, not yours.
Every niche has insider language. Use it.
Every niche has specific fears. Name them precisely.
Every niche has specific dreams. Reference them concretely.

EXAMPLES OF NICHE-SPECIFIC FEARS:
- Business coach client: "wasting another year stuck at the same revenue level"
- Dating coach client: "another failed relationship and running out of time"
- Crypto coach client: "watching Bitcoin run 40% while still waiting for the perfect entry"
- Postpartum coach client: "never feeling like herself again after having kids"
- Public speaking coach client: "freezing completely on stage in front of 500 people"
- Dog trainer client: "their dog lunging at every person they pass on the street"
- Executive coach client: "being passed over for promotion again despite doing everything right"
- Tarot coach client: "being dismissed as not credible by people who don't understand the work"
- Wedding photographer coach client: "still charging $1,500 while watching others charge $8,000"

None of these fears sound the same. Your script must sound like it was written 
by someone who lives inside that world — not an outsider who read about it once.

THE NICHE TEST:
Show the script to someone in that niche.
If they say "yes, that's exactly how I feel" — correct world.
If they say "close but not quite" — go deeper into their specific language.
If they say "this doesn't sound like us" — start over.
`;

  const ANGLE_SELECTION = `
ANGLE SELECTION — choose ONE before writing a single word.

For any niche, one of these 5 angles will be strongest.
Choose based on what the service profile data suggests is most compelling.
State your chosen angle before writing the script.

1. LOSS — what are they losing RIGHT NOW without this?
   Best when: the audience has already tried something and failed
   Hook pattern: "You've already [tried X]. You already know [it didn't work]."
   Example: "You've already run Facebook ads. You already know what happened."

2. IDENTITY — who do they want to become, and what's blocking them?
   Best when: the transformation is about becoming a different version of themselves
   Hook pattern: "You know exactly who you want to be. Something keeps pulling you back."
   Example: "You know you're meant to be on stage. Your body has other ideas."

3. PROOF — a specific number that makes the promise feel real
   Best when: the coach has strong credentials, client results, or scale
   Hook pattern: "[Specific number] [specific people] [specific outcome]."
   Example: "3,847 women have rebuilt their strength after having kids. Using this exact system."

4. CONTRARIAN — a truth that goes against what they have been told
   Best when: the audience has wasted money or time following conventional advice
   Hook pattern: "Everything you've been told about [X] is exactly why [Y] keeps happening."
   Example: "Everything the trading gurus told you about entries is why you keep getting wrecked."

5. URGENCY — something happening right now makes waiting costly
   Best when: there is a market timing, trend, or opportunity element
   Hook pattern: "While you're [waiting/thinking/hesitating], [specific bad thing] is happening."
   Example: "While you're waiting to feel ready, your competitor just booked your next 10 clients."

RULE: If the service profile does not clearly suggest one angle — choose LOSS.
Loss is the universal default. It works across every niche because every audience 
has already tried something that did not work.

Do not mix angles. One script, one angle, one emotional through-line from start to finish.
`;

  const BANNED_WORDS = `
BANNED WORDS — never use any of these. No exceptions.

If you catch yourself writing any of these, stop and rewrite the sentence 
using the specific language of the niche instead.

BANNED PHRASES:
- "proven frameworks", "proven strategies", "proven system", "proven methods"
- "AI-powered", "leverage AI", "harness the power of AI", "powered by artificial intelligence"
- "transform", "transformation", "transformative journey", "life-changing transformation"
- "streamline", "optimize", "innovative", "cutting-edge", "state-of-the-art"
- "empower", "empowering", "unlock your potential", "unlock your true potential"
- "scale your business", "take your business to the next level", "elevate your brand"
- "overwhelmed", "challenges", "pain points", "struggling with"
- "in today's world", "in today's digital age", "in today's competitive landscape"
- "seamlessly", "effortlessly", "easily", "simply", "just"
- "game-changer", "revolutionary", "disruptive", "groundbreaking"
- "holistic approach", "comprehensive solution", "end-to-end"
- "best-in-class", "world-class", "industry-leading"
- "passion", "passionate about", "I'm passionate"
- "journey", "on your journey", "begin your journey"

WHY: These words appear in every piece of marketing content on the internet.
They trigger the part of the brain that skips ads. They signal inauthenticity.
A coach who has been burned by bad ads, who is scrolling Facebook at 11pm, 
will not stop for any of these words. They have seen them too many times.
`;

  const CUSTOMER_LANGUAGE_RULE = `
CUSTOMER LANGUAGE RULE — the most important rule in this entire prompt.

Coaches do not talk like software companies.
Consultants do not talk like SaaS landing pages.
Speakers do not talk like enterprise vendors.

Write every line as if a practitioner in that niche is talking directly 
to another practitioner who is about to make the same costly mistake they made.

WRONG (software language): "ZAP leverages AI to optimize your campaign performance"
RIGHT (coach language): "I spent $4,000 on Facebook ads last year. Got 3 leads. All ghosted."

WRONG: "Our proven framework delivers measurable results"
RIGHT: "900,000 people have sat in my programs. None of them found me through a fancy agency."

WRONG: "AI-powered campaigns that scale your coaching business"
RIGHT: "You open the app. You answer 6 questions. Your ad is live on Facebook in 11 minutes."

WRONG: "Stop wasting weeks on manual campaign creation"
RIGHT: "You've been putting off running ads for 4 months. You know why. It's not laziness."

THE TEST: Read each line out loud.
If it sounds like a SaaS product landing page — rewrite it.
If it sounds like a coach having a real conversation — it is right.
If your 13-year-old could have written it — it is too generic.
`;

  const SPECIFICITY_RULE = `
SPECIFICITY RULE — vague claims are invisible.

Every claim needs a number, a name, a timeframe, or a concrete detail.
If a sentence has none of these, it is probably too vague to stop a scroll.

WRONG: "Thousands of coaches trust this system"
RIGHT: "Built by a coach who has trained 900,000 students across 49 countries"

WRONG: "Get results fast"
RIGHT: "Your first ad campaign. Live on Facebook. In under 15 minutes."

WRONG: "Stop wasting money on ads that don't work"
RIGHT: "You've already spent the money. You already know it didn't work. This is different."

WRONG: "Join coaches who are growing their business"
RIGHT: "Join 2,400 coaches who generated their first qualified lead in the first 48 hours"

WRONG: "Feel stronger after having your baby"
RIGHT: "Lift your toddler without your back giving out. Sleep through the night. Feel like you again."

WRONG: "Learn to trade like a professional"
RIGHT: "Stop watching Bitcoin move 30% while you're still waiting for the perfect setup"

Specificity creates credibility. Vagueness creates doubt.
If you cannot be specific — ask what specific data exists in the service profile 
and use whatever numbers or details are available.
`;

  const HOOK_RULE = `
HOOK RULE — applies to Scene 1 only, the first 3 seconds.

The hook has one job: make the right person stop scrolling.
Not everyone. The right person. The one who has this exact problem right now.

REQUIREMENTS for every hook:
1. Names something the viewer is LOSING — not something they could gain
   Loss is felt more powerfully than gain. Lead with loss.
   
2. Creates an open loop — a tension or question that cannot be resolved 
   until the viewer watches the rest of the video
   
3. Does NOT mention ZAP, the product, or any solution
   The hook is only about the pain that exists right now, without ZAP
   
4. Sounds like it was said by a real person, not written by a copywriter
   If it sounds polished and professional — it will be skipped
   If it sounds like a truth someone finally said out loud — it will stop the scroll

WRONG hooks (too generic, no loss, no open loop):
- "Want to grow your coaching business with Facebook ads?"
- "Discover the secret to successful ad campaigns"  
- "Are you tired of struggling with marketing?"
- "Stop wasting time on manual work"

RIGHT hooks (specific loss, open loop, niche language):
- "You've tried running Facebook ads before. You spent the money. You got nothing back."
- "Every trading coach I know has blown at least one account following someone else's signals."
- "You had the baby. You did everything right. You still don't recognise the person in the mirror."
- "You've been speaking for 3 years. You're still being asked to speak for free."
- "You passed your real estate exam. You just haven't closed a deal in 90 days."

The hook does not need to be clever. It needs to be TRUE.
When the right person hears it, their reaction should be: "How did they know that?"
`;

  const META_COMPLIANCE = `
⚠️ META COMPLIANCE — CRITICAL: Ad account suspension if violated.

BEFORE WRITING ANYTHING, read this entire section. Your script will be rejected if it violates ANY of these rules.

ABSOLUTE PROHIBITIONS (will cause immediate ad rejection):

1. NEVER use "you" + negative body/health language:
   ❌ BANNED: "Are you exhausted?", "Feeling weak?", "Your body isn't yours?"
   ❌ BANNED: "Are you overweight?", "Struggling with your weight?", "Feel fat?"
   ❌ BANNED: "Your body has changed", "Don't recognize yourself?", "Feel disconnected from your body?"
   ✅ SAFE: "Want more energy?", "Build strength", "Reconnect with your body"
   ✅ SAFE: "Ready to feel strong again?", "Regain your strength", "Feel like yourself"

2. NEVER call out personal attributes:
   ❌ BANNED: Age ("over 40", "postpartum", "menopausal"), race, religion, disability
   ❌ BANNED: Financial status ("broke", "struggling financially", "can't afford")
   ❌ BANNED: Medical conditions ("have anxiety", "suffering from", "diagnosed with")
   ✅ SAFE: Remove all personal identifiers, focus on desired outcome only

3. NEVER use "you are" + failure language:
   ❌ BANNED: "You're failing", "You're stuck", "You're losing", "You're broke"
   ❌ BANNED: "Still losing accounts?", "Still failing at...?", "Still stuck at...?"
   ✅ SAFE: "Want to stop losing accounts?", "Ready to move forward?", "Time to succeed?"

4. NEVER promise unrealistic outcomes:
   ❌ BANNED: "Lose 50 lbs in 2 weeks", "Make $10K your first month", "Cure your anxiety"
   ✅ SAFE: "Sustainable weight loss", "Build a profitable business", "Manage stress better"

5. NEVER use before/after body transformation language:
   ❌ BANNED: "Get your pre-baby body back", "Look like you did before", "Transform your body"
   ✅ SAFE: "Build strength", "Feel energized", "Regain capability"

SPECIFIC NICHE EXAMPLES:

Postpartum Fitness:
❌ WRONG: "Feeling like your body isn't yours anymore? Exhausted, weak, disconnected?"
✅ RIGHT: "Want to rebuild your core strength? Ready to feel strong and energized again?"

❌ WRONG: "Your postpartum body has changed. Get it back."
✅ RIGHT: "Rebuild core strength. Feel capable and energized."

Weight Loss:
❌ WRONG: "Are you overweight and tired of failed diets?"
✅ RIGHT: "Want sustainable weight loss without restrictive diets?"

Mental Health:
❌ WRONG: "Do you have anxiety? Are you depressed?"
✅ RIGHT: "Want to manage stress better and feel more confident?"

Business/Money:
❌ WRONG: "Are you broke? Still making no money?"
✅ RIGHT: "Ready to build a profitable business? Want consistent revenue?"

Dog Training:
❌ WRONG: "Is your dog aggressive? Does your dog have behavior problems?"
✅ RIGHT: "Want a calmer dog? Ready for stress-free walks?"

PATTERN DETECTION — Scan your script for these:
- "you" + [tired, exhausted, weak, fat, broke, failing, stuck, lost, disconnected]
- "are you" + [any negative attribute]
- "still" + [losing, failing, stuck, broke]
- "your body" + [isn't, changed, failed, broken]

If you find ANY of these patterns → REWRITE IMMEDIATELY.

PRE-SUBMISSION CHECKLIST:
Before returning your script, verify:
□ Zero instances of "you are" + negative attributes
□ Zero body-focused negative language
□ Zero personal attribute callouts (age, weight, financial status)
□ All hooks focus on desired outcome, not current failure
□ All language is empowering and forward-looking

IF YOU VIOLATE THESE RULES, THE USER'S AD ACCOUNT WILL BE FLAGGED OR SUSPENDED.
When in doubt, reframe to positive aspiration instead of negative current state.
`;

  // ═══════════════════════════════════════════════════════════════════════════════
  // SERVICE DATA
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const baseContext = `
PRODUCT NAME: ${service.name}
TARGET AUDIENCE: ${service.targetCustomer || service.targetMarket || "Coaches and consultants"}
PRESSING PROBLEM: ${service.whyProblemExists || service.mainBenefit || "Wasting time on manual tasks"}
DESIRED OUTCOME: ${service.desiredOutcome || service.mainBenefit || "Save time and scale faster"}
UNIQUE MECHANISM: ${service.mechanismDescriptor || service.uniqueMechanism || "AI-powered automation"}
KEY BENEFITS: ${service.mainBenefit || "Save time, make more money"}
AUTHORITY: ${service.authority || "Industry expert"}
SOCIAL PROOF: ${
    service.totalCustomers
      ? `${service.totalCustomers}+ customers${service.averageRating ? `, ${service.averageRating}/5 stars` : ""}`
      : "Proven results — use outcome-based language only, no fabricated numbers"
  }
TESTIMONIAL: ${
    service.testimonial1Quote
      ? `"${service.testimonial1Quote}" — ${service.testimonial1Name}, ${service.testimonial1Title}`
      : "None provided — do not fabricate a testimonial"
  }
`;

  const globalRules = `
MANDATORY RULES (never violate):
1. NEVER use prohibited Meta language: banned, forbidden, leaked, exposed, glitch, secret they don't want you to know
2. NEVER fabricate statistics, customer counts, or testimonials not provided above
3. NEVER make income guarantees or specific financial return claims
4. Keep voiceover text conversational — contractions, short sentences, spoken naturally
5. On-screen text must be 3-7 words MAXIMUM — punchy visual overlay
6. Visual direction must be achievable with motion graphics or kinetic typography
7. First scene must be a pattern interrupt — the hook that stops the scroll
8. META CHARACTER LIMITS: Primary text 125 chars, Headline 27 chars, Description 27 chars (enforce strictly)

RESPOND WITH VALID JSON ONLY. No markdown, no preamble, no explanation.
Format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "voiceoverText": "Exact spoken words",
      "visualDirection": "What appears on screen — specific, achievable",
      "onScreenText": "3-7 word text overlay"
    }
  ]
}`;

  if (videoType === "explainer") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

${NICHE_DETECTION}

${ANGLE_SELECTION}

${BANNED_WORDS}

${CUSTOMER_LANGUAGE_RULE}

${SPECIFICITY_RULE}

${HOOK_RULE}

${META_COMPLIANCE}

═══════════════════════════════════════════════════════════════════════════════

Generate an EXPLAINER video ad script. TOTAL DURATION MUST BE EXACTLY 28 SECONDS (not ${duration}).

SERVICE DATA:
${baseContext}

SCENE STRUCTURE (EXACTLY 5 SCENES, EXACTLY 28 SECONDS TOTAL):
${
  duration <= 30
    ? `Scene 1 (0-3s, duration: 3): HOOK — Fast punch. Pattern interrupt using one of these angles: Pain point ("Stop wasting time on X"), Outcome ("Achieve Y in Z days"), Social proof ("Join 10,000+ who..."), Curiosity ("The X secret..."), or Comparison ("Unlike X, we...")
Scene 2 (3-7s, duration: 4): PROBLEM — Build pain. Relatable pain point that resonates emotionally
Scene 3 (7-12s, duration: 5): AUTHORITY — Credibility. Show social proof or authority (only if data provided)
Scene 4 (12-18s, duration: 6): SOLUTION — Relief. Show product/benefit and how it works
Scene 5 (18-28s, duration: 10): CTA — Drive action. Clear next step + URL display with 3s hold time

YOU MUST GENERATE EXACTLY 5 SCENES. DO NOT ADD A 6TH SCENE. TOTAL DURATION MUST BE 28 SECONDS.`
    : duration === 60
    ? `Scene 1 (0-5s): HOOK — Pattern interrupt
Scene 2 (5-15s): PROBLEM AGITATION — Make the pain real
Scene 3 (15-30s): SOLUTION — Introduce the product
Scene 4 (30-45s): MECHANISM — How it works simply
Scene 5 (45-55s): PROOF — Social proof or authority (only if data provided above)
Scene 6 (55-60s): CTA — Single specific action`
    : `Scene 1 (0-5s): HOOK
Scene 2 (5-15s): PROBLEM AGITATION
Scene 3 (15-30s): RELATABLE STORY SCENARIO
Scene 4 (30-50s): SOLUTION + MECHANISM
Scene 5 (50-70s): PROOF + TESTIMONIAL (only if provided above)
Scene 6 (70-85s): BENEFITS STACK
Scene 7 (85-90s): CTA`
}

${globalRules}`;
  }

  if (videoType === "proof_results") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second PROOF/RESULTS video ad script. Lead with outcomes, not problems.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Bold result claim
Scene 2 (5-15s): BEFORE STATE — Where they were
Scene 3 (15-25s): AFTER STATE — Where they are now
Scene 4 (25-${duration}s): CTA`
    : `Scene 1 (0-5s): HOOK — Bold result claim
Scene 2 (5-15s): BEFORE STATE — Pain and struggle
Scene 3 (15-30s): TRANSFORMATION — What changed
Scene 4 (30-45s): AFTER STATE — Results achieved
Scene 5 (45-55s): SOCIAL PROOF (only use numbers provided above)
Scene 6 (55-${duration}s): CTA — Invite them to get same results`
}

EXTRA RULES FOR PROOF/RESULTS:
- Lead with the result, not the problem
- Use "from X to Y" transformation language where possible
- If no social proof numbers are provided, use directional language: "hundreds of coaches", "most of our clients"
- CTA should be: "Get the same results" or "Start your transformation"

${globalRules}`;
  }

  if (videoType === "testimonial") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second TESTIMONIAL video ad script.

SERVICE DATA:
${baseContext}

INSTRUCTIONS:
${
  service.testimonial1Quote
    ? `A real testimonial has been provided. Structure the video around this person's story.
Real testimonial: "${service.testimonial1Quote}" — ${service.testimonial1Name}, ${service.testimonial1Title}
Write the voiceover as if ${service.testimonial1Name} is speaking directly.`
    : `No real testimonial provided. Write a relatable third-person story using "imagine" framing.
DO NOT fabricate a named person. Use: "Imagine you're a coach who..." or "Picture this..."
This is not a real testimonial — it's an aspirational scenario.`
}

SCENE STRUCTURE for ${duration} seconds:
Scene 1 (0-5s): HOOK — Before state (struggle or challenge)
Scene 2 (5-15s): THE PROBLEM — What they were dealing with
Scene 3 (15-30s): DISCOVERY — How they found the solution
Scene 4 (30-45s): TRANSFORMATION — What changed
Scene 5 (45-55s): RESULTS — Where they are now
Scene 6 (55-${duration}s): CTA — Invite viewer to have same experience

EXTRA RULES:
- Write in first person if using real testimonial, third person/imagine framing if not
- Show emotional journey: frustration → relief → success
- On-screen text should use quote-style highlights
- Visual direction should suggest testimonial card layout

${globalRules}`;
  }

  if (videoType === "mechanism_reveal") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second MECHANISM REVEAL video ad script. The goal is to make the unique mechanism sound proprietary and revolutionary.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Question challenging the old approach
Scene 2 (5-15s): OLD WAY — Why current methods fail
Scene 3 (15-25s): NEW WAY — Reveal the mechanism
Scene 4 (25-${duration}s): CTA`
    : `Scene 1 (0-5s): HOOK — Question challenging the old approach
Scene 2 (5-15s): OLD WAY — Why current methods fail
Scene 3 (15-30s): NEW WAY — Reveal the mechanism
Scene 4 (30-45s): HOW IT WORKS — 3-step breakdown (simple, clear)
Scene 5 (45-55s): RESULTS — What this mechanism enables
Scene 6 (55-${duration}s): CTA`
}

EXTRA RULES:
- Position the mechanism as a fundamentally different approach
- Contrast old way vs new way explicitly
- Break mechanism into 3 steps maximum
- Make it sound proprietary even if it isn't
- On-screen text should emphasize the mechanism name
- Visual direction should suggest step-by-step reveal

${globalRules}`;
  }

  throw new Error(`Unknown video type: ${videoType}`);
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export const videoScriptsRouter = router({

  // Generate script — FREE, no credit consumed
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        videoType: z.enum(["explainer", "proof_results", "testimonial", "mechanism_reveal"]),
        duration: z.enum(["15", "30", "60", "90"]),
        visualStyle: z.enum(["text_only", "kinetic_typography", "motion_graphics", "stats_card"]),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId));

      if (!service) throw new Error("Service not found");

      let scriptData: { scenes: Scene[] };
      let voiceoverText: string;

      // Check if this is ZAP service - use hardcoded demo script
      const isZapService = service.name.toLowerCase().includes('zap');
      
      if (isZapService) {
        // Use hardcoded ZAP demo script (bypasses LLM)
        const { ZAP_DEMO_SCRIPT, ZAP_DEMO_VOICEOVER } = await import("../zapDemoScript.js");
        scriptData = ZAP_DEMO_SCRIPT;
        voiceoverText = ZAP_DEMO_VOICEOVER;
        console.log(`[VideoScripts] Using hardcoded ZAP demo script for service: ${service.name}`);
      } else {
        // Regular LLM-based script generation
        const prompt = buildScriptPrompt(
          input.videoType,
          parseInt(input.duration),
          service
        );

        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          maxTokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Invalid AI response");
        }

        try {
          const clean = content.replace(/```json|```/g, "").trim();
          scriptData = JSON.parse(clean);
        } catch {
          throw new Error("Script generation failed — please try again");
        }

        if (!scriptData.scenes?.length) {
          throw new Error("No scenes returned — please try again");
        }

        voiceoverText = scriptData.scenes.map((s) => s.voiceoverText).join(" ");
      }

      const [record] = await db.insert(videoScripts).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId ?? null,
        videoType: input.videoType,
        duration: input.duration,
        visualStyle: input.visualStyle,
        scenes: scriptData.scenes,
        voiceoverText,
        status: "draft",
      });

      return {
        scriptId: (record as any).insertId,
        scenes: scriptData.scenes,
        voiceoverText,
        creditCost: getCreditCost(input.duration),
      };
    }),

  // Update script after user edits — FREE
  update: protectedProcedure
    .input(
      z.object({
        scriptId: z.number(),
        scenes: z.array(
          z.object({
            sceneNumber: z.number(),
            duration: z.number(),
            voiceoverText: z.string(),
            visualDirection: z.string(),
            onScreenText: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [script] = await db
        .select()
        .from(videoScripts)
        .where(
          and(
            eq(videoScripts.id, input.scriptId),
            eq(videoScripts.userId, ctx.user.id)
          )
        );

      if (!script) throw new Error("Script not found");

      const voiceoverText = input.scenes.map((s: any) => s.voiceoverText).join(" ");

      await db
        .update(videoScripts)
        .set({ scenes: input.scenes, voiceoverText, updatedAt: new Date() })
        .where(eq(videoScripts.id, input.scriptId));

      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ scriptId: z.number() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [script] = await db
        .select()
        .from(videoScripts)
        .where(
          and(
            eq(videoScripts.id, input.scriptId),
            eq(videoScripts.userId, ctx.user.id)
          )
        );

      if (!script) throw new Error("Script not found");

      return {
        ...script,
        scenes: script.scenes as Scene[],
        creditCost: getCreditCost(script.duration),
      };
    }),

  list: protectedProcedure.query(async ({ ctx }: { ctx: any }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const scripts = await db
      .select()
      .from(videoScripts)
      .where(eq(videoScripts.userId, ctx.user.id))
      .orderBy(desc(videoScripts.createdAt))
      .limit(50);

    return scripts.map((s) => ({
      ...s,
      creditCost: getCreditCost(s.duration),
    }));
  }),
});
