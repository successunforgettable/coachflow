// server/routers/videoScripts.ts
// Generates AI scripts for video ads — FREE, no credits consumed
// Credit is only consumed when the user hits Generate Video

// ───────────────────────────────────────────────────────────────────────────
// SPRINT A AUDIT NOTES — workstream Sprint A (single micro-commit)
// ───────────────────────────────────────────────────────────────────────────
// Sprint A reconciled main's P2/P3/P4 prompt-quality work onto railway-build.
// Audit cross-referenced 50 distinct fixes across 4 main commits (3e65eec
// P2, 87bebb9 P3, f33a893 doc, e08682c P4/P4b) against current RB state.
// Finding: 49 of 50 fixes were already incorporated organically by workstream
// commits 3b/4b/4c — convergent evolution from shared direct-response
// copywriting lineage (Hormozi value equation, Brunson hook-story-offer,
// Cialdini commitment+consistency, internal-monologue voice rules).
//
// The single residual partial-port — closed by this commit — was the
// mechanism_reveal goal-line at L802: previously framed the mechanism as
// something to "make sound proprietary and revolutionary" (deception cue
// inherited from the original P4 pre-state). Now reframed as genuine
// structural differentiation, matching the EXTRA RULES block at L826 which
// already had the corrected language.
//
// Future engineers: P2/P3/P4's prompt-quality fixes are present on railway-
// build via convergent workstream incorporation, NOT via direct merge from
// main. If you compare main HEAD vs railway-build HEAD on these files, the
// diffs are large but driven by workstream additions (new builders,
// dispatcher, allow-list blocks, delay metadata, PAGETYPE_PROMPTS), not by
// missing prompt-quality work. Sprint A audit is closed.
// ───────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { videoScripts, services, jobs } from "../../drizzle/schema";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export interface Scene {
  sceneNumber: number;
  voiceoverText: string;
  visualDirection: string;
  onScreenText: string;
  pexelsQuery: string;
}

// ─── CREDIT COST BY DURATION ──────────────────────────────────────────────────
export function getCreditCost(duration: string): number {
  if (duration === "15" || duration === "30") return 1;
  if (duration === "60") return 2;
  if (duration === "90") return 3;
  return 1;
}

// ─── SCRIPT GENERATION PROMPTS ────────────────────────────────────────────────
export function buildScriptPrompt(
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
- "countless", "many", "numerous", "various", "several" (replace with actual numbers from service profile)
- "industry expert", "seasoned professional", "experienced coach" (replace with actual credential from service profile)
- "individuals", "people" (replace with specific audience: traders, mothers, photographers, etc.)

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
❌ WRONG: "Many mothers seek to feel energized" (too generic, not a hook)
✅ RIGHT: "That moment you go to pick up your toddler and your back says no."
✅ RIGHT: "Three months in and the gym feels like a foreign country."
✅ RIGHT: "You reach for the stroller and your core just... isn't there."

❌ WRONG: "Your postpartum body has changed. Get it back."
✅ RIGHT: "Rebuild core strength. Feel capable and energized."

KEY PRINCIPLE: Describe a specific physical MOMENT, not a personal attribute.
- Moments are Meta-compliant ("you go to pick up your toddler and your back says no")
- Attributes are violations ("you are weak and exhausted")

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

  const FEW_SHOT_EXAMPLES = `
## EXAMPLES — Learning the Pattern, Not the Niches

These examples exist to teach you HOW to detect a world and write in it.
They do not represent the only niches ZAP serves.
ZAP serves every coaching, consulting, speaking, and education niche on earth.
Your job is to apply this same detection and writing process to ANY niche you encounter.

Study the PATTERN across all 3 examples:
- How the hook is constructed (loss + open loop + insider language)
- How the problem scene deepens without labelling the person
- How authority is stated (first person + specific number)
- How the solution shows the after state, not the mechanism
- How the CTA uses the coach's exact specificOutcome language

Once you understand the pattern, you can apply it to:
A barbecue competition coach. A Mandarin language tutor. A grief counsellor.
A professional poker player who coaches others. A beekeeper who teaches beekeeping.
A retired navy SEAL who coaches corporate leadership. Any niche. Every niche.

---

### EXAMPLE A — World: Corporate Leadership (shows moment-based loss hook)

SERVICE PROFILE:
targetCustomer: Senior women passed over for promotion
mainPainPoint: Told not ready despite outperforming peers
specificOutcome: "Get your VP title within the next 12 months"
credentials: Former Fortune 500 CHRO, 200+ women promoted
angle: LOSS

❌ GENERIC VERSION — what the LLM defaults to without guidance:
"Are you struggling to advance in your career? Many women face challenges 
in corporate environments. Our proven framework empowers you to transform 
your trajectory. Start your journey today."

Pattern failures: no world language, banned words throughout, no specific
loss, no open loop, could belong to any industry or gender.

✅ NICHE VERSION — what ZAP must produce:
Scene 1: "Still waiting for that VP title you earned years ago?"
Scene 2: "It's infuriating to hear 'not ready yet' after outperforming your male peers."
Scene 3: "As a former Fortune 500 CHRO, I've promoted over 200 women into senior roles."
Scene 4: "The Executive Edge shows you how to articulate your impact, command the room, and secure that overdue promotion. No more waiting."
Scene 5: "Stop losing out. Click Learn More to get your VP title within the next 12 months."

Pattern applied:
HOOK → specific loss (title already earned, still waiting) + open loop (why?)
PROBLEM → insider language (male peers, not ready yet) + emotion without labels
AUTHORITY → first person + specific credential + specific number
SOLUTION → after state (command the room) not mechanism (we use a framework)
CTA → specificOutcome field pulled verbatim

---

### EXAMPLE B — World: Animal Behaviour (shows visceral experience hook)

SERVICE PROFILE:
targetCustomer: Dog owners whose dog lunges at other dogs on walks
mainPainPoint: Dreading every walk, unpredictable behaviour
specificOutcome: "Get your calm dog back"
credentials: Certified applied animal behaviourist, 1,200 reactive dogs
angle: LOSS

❌ GENERIC VERSION:
"Is your dog causing problems? Dog behaviour challenges can be overwhelming.
Our expert trainers use proven methods to transform your dog. Book today
to start your journey to a better relationship with your pet."

Pattern failures: "causing problems" vague, "overwhelming" banned,
"proven methods" banned, "transform" banned, "journey" banned,
no pelvic floor — wait, wrong niche. Exactly. No insider language at all.

✅ NICHE VERSION:
Scene 1: "Losing the joy of dog walks because of leash reactivity?"
Scene 2: "That gut-wrenching dread every time you see another dog — wondering if this walk ends in a lunge-fest or a full-blown meltdown."
Scene 3: "As a certified applied animal behaviourist, I've helped over 1,200 reactive dogs find their calm."
Scene 4: "Science-backed methods that rewire your dog's brain — replacing fear with focus. No pulling. No barking. Just a loose leash."
Scene 5: "Stop avoiding walks. Book your free call and get your calm dog back."

Pattern applied:
HOOK → specific activity being lost (dog walks) + insider term (leash reactivity)
PROBLEM → physical experience (gut-wrenching dread) not a label (stressed owner)
AUTHORITY → certification + specific number (1,200 dogs)
SOLUTION → concrete image of the after state (loose leash, no barking)
CTA → action verb + specificOutcome verbatim (calm dog back)

---

### EXAMPLE C — World: Postpartum Fitness (shows Meta-compliant moment hook)

SERVICE PROFILE:
targetCustomer: Mothers 3-18 months postpartum
mainPainPoint: Feeling disconnected from body after having kids
specificOutcome: "Feel like yourself again"
credentials: Pelvic floor physio and strength coach
angle: LOSS
special rule: Meta compliance — describe MOMENTS not personal attributes

❌ GENERIC VERSION:
"Are you struggling to get back in shape after your baby? Many mothers 
feel exhausted and weak postpartum. Our holistic approach transforms 
your body and mind. Begin your wellness journey today."

Pattern failures: "get back in shape" implies body image (Meta violation),
"exhausted and weak" are personal attributes (Meta violation), "holistic"
banned, "transforms" banned, "wellness journey" two banned words,
no pelvic floor language, no specificity.

✅ NICHE VERSION:
Scene 1: "That moment you go to pick up your baby and your core just… isn't there."
Scene 2: "You try to walk further, but your hips ache, and lifting the car seat feels like a marathon."
Scene 3: "As a pelvic floor physio and strength coach, I've guided hundreds of mothers back to full strength."
Scene 4: "The Strong Mama Method — specialised pelvic floor recovery combined with progressive strength training. Build a resilient body, safely."
Scene 5: "Feel like yourself again. Tap Learn More to explore the Strong Mama Method."

Pattern applied:
HOOK → specific MOMENT (picking up baby) not attribute (being weak)
PROBLEM → physical EXPERIENCE (hips ache, car seat weight) not condition (exhausted)
AUTHORITY → dual credential (physio + strength coach) + number (hundreds)
SOLUTION → method name + what it combines + outcome image (resilient body)
CTA → specificOutcome field verbatim as opening line

---

## THE UNIVERSAL PATTERN — Apply This to Every Niche

Extract these 5 rules from the examples above and apply them to ANY niche:

HOOK FORMULA:
[Specific activity or moment being lost] + [insider term for the problem] + [open question]
OR
[The exact moment the pain hits] + [sensory/physical detail] (for Meta-sensitive niches)

PROBLEM FORMULA:
[Physical or emotional EXPERIENCE of the pain] — never a label, always an experience
Use the exact words someone in that world uses to describe this to a friend

AUTHORITY FORMULA:
"As a [specific credential], I've [specific verb] [specific number] [specific people/things]."
Always first person. Always a number. Always a credential the niche respects.

SOLUTION FORMULA:
Name the method or program + what it does in niche language + concrete image of the after state
Do NOT describe the mechanism. Show the result.

CTA FORMULA:
[Action word] + [specificOutcome field verbatim] + [campaign objective action]
The specificOutcome field is the coach's own words. Use them exactly.

---

## APPLYING THE PATTERN TO NEW NICHES

When you encounter a niche not in these examples, follow this process:

Step 1: Identify the specific activity or moment where the pain is most felt
  Crypto trader → the moment the funded account gets blown
  Wedding photographer → the moment a client asks for a discount
  Grief counsellor → the moment they reach for the phone to call someone gone
  Beekeeping coach → the moment a hive collapses and they don't know why

Step 2: Find the insider term for that pain
  Crypto → "blowing the account", "getting wrecked", "prop firm challenge"
  Wedding photographer → "second shooter discount", "ghosted after the quote"
  Grief counsellor → "grief fog", "the firsts" (first birthday, first Christmas)
  Beekeeping → "colony collapse", "hive loss", "varroa mite infestation"

Step 3: Write the hook using that moment + that insider term
  Never use the generic version. Always use the world's own language.

Step 4: Follow the AUTHORITY → SOLUTION → CTA formula exactly as shown above

This process works for every niche. There are no exceptions.
`;

  const AUTHORITY_SCENE_RULE = `
AUTHORITY SCENE RULE — Scene 3 only:

Scene 3 must use the exact credentials from the service profile.
Do not invent credentials. Do not use generic phrases.
Do not say "industry expert", "experienced coach", "seasoned professional."
Do not say "countless" — if there is no number, use "hundreds of" minimum.

The authority scene has one formula. Use it exactly:

"As a [CREDENTIAL FROM uniqueMechanism FIELD], I've [SPECIFIC VERB] 
[NUMBER FROM uniqueMechanism FIELD] [SPECIFIC PEOPLE OR THINGS]."

WRONG: "As an industry expert, I've guided countless individuals."
RIGHT: "As a certified grief recovery specialist, I've guided 800+ people 
through losing a spouse or parent."

WRONG: "I've seen countless traders stuck in this cycle."
RIGHT: "As a former prop desk trader with 7 years trading bank capital, 
I've mentored over 340 retail traders to consistent funded account withdrawals."

If the uniqueMechanism field contains a number — use it.
If it does not contain a number — use "hundreds of" as minimum.
If it does not contain a specific credential — ask what it is before generating.

The authority scene is the proof point. Generic proof is no proof at all.
`;

  const PEXELS_QUERY_RULE = `
PEXELS QUERY RULES — MANDATORY for every scene:

EVERY pexelsQuery MUST follow this exact formula:
  [PERSON/ROLE in the niche] + [SPECIFIC ACTION or EMOTIONAL STATE]

RULES:
1. Always show a HUMAN BEING doing something — never an object, concept, or abstract idea
2. Use 3-5 words maximum
3. The person and situation must match the detected nicheWorld
4. The emotional state must match the scene voiceover (frustrated = hook, relieved = solution, confident = cta)
5. English only — no metaphors, no brand names, no abstract nouns

FORMULA APPLIED TO ANY NICHE:
  Crypto/trading: "trader stressed watching charts", "investor celebrating profit screen"
  Fitness/health: "woman exhausted after workout", "person celebrating weight loss"
  Dog training: "owner frustrated pulling leash", "trainer rewarding calm dog"
  Business/coaching: "entrepreneur overwhelmed at desk", "coach presenting whiteboard group"
  Relationships: "couple arguing living room", "woman smiling reading message"
  Real estate: "agent showing house clients", "buyer signing contract table"

BAD (never use these): "transformation", "coaching", "success journey", "breakthrough moment", "motivation", "mindset", "growth"

For the service you are writing for, detect the nicheWorld first, then apply the formula to generate queries that show a PERSON from that niche in a situation that matches each scene's emotional arc.
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

  const DURATION_RULE = `
DURATION RULE — NON-NEGOTIABLE:
- Total script must produce 30-45 seconds of voiceover when spoken at natural pace
- 5 scenes maximum — hook, problem, authority, solution, cta
- Each voiceoverText must be 1-3 sentences maximum
- Count words: aim for 80-120 total words across all 5 scenes
- Average speaking pace is 130 words per minute
- 100 words = approximately 46 seconds spoken
- If you write more than 120 words total — you have written too much. Cut it.
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
  "angle": "LOSS|GAIN|FEAR|IDENTITY",
  "nicheWorld": "detected niche world e.g. corporate leadership, crypto trading, postpartum fitness",
  "insiderWords": ["word1", "word2", "word3"],
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneType": "hook|problem|authority|solution|cta",
      "voiceoverText": "Exact spoken words — write enough to fill the scene naturally",
      "onScreenText": "MAX 40 CHARS, UPPERCASE, PUNCHY",
      "statBadge": "authority scene only — the specific credential number e.g. 200+ WOMEN PROMOTED",
      "visualDirection": "What appears on screen — specific, achievable",
      "pexelsQuery": "2-4 word Pexels search query matching the niche and scene emotion"
    }
  ]
}

RULES FOR OUTPUT:
- onScreenText must be 40 characters or fewer
- onScreenText must be UPPERCASE
- statBadge only on the authority scene (sceneType: authority) — contains the specific number/credential
- voiceoverText must follow all banned word rules and niche detection rules
- Return JSON only — no markdown, no explanation, no backticks`;

  if (videoType === "explainer") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

${NICHE_DETECTION}

${ANGLE_SELECTION}

${BANNED_WORDS}

${CUSTOMER_LANGUAGE_RULE}

${SPECIFICITY_RULE}

${HOOK_RULE}

${META_COMPLIANCE}

${FEW_SHOT_EXAMPLES}

${AUTHORITY_SCENE_RULE}

${PEXELS_QUERY_RULE}

${DURATION_RULE}

═══════════════════════════════════════════════════════════════════════════════

Generate an EXPLAINER video ad script. TOTAL DURATION MUST BE 30-45 SECONDS.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE (EXACTLY 5 SCENES):

${duration === 15
    ? `Scene 1: HOOK — Fast punch. 1-2 sentences. Pattern interrupt using pain point, outcome, social proof, curiosity, or comparison.
Scene 2: PROBLEM — Build pain. 2-3 sentences that deepen emotional pain.
Scene 3: AUTHORITY — Credibility. 2-3 sentences with specific proof (only if data provided).
Scene 4: SOLUTION — Relief. 2-3 sentences explaining how it works.
Scene 5: CTA — Drive action. 1-2 sentences maximum.

⚠️ WRITE PUNCHY, CONCISE COPY: Each scene should be 10-25 words. Total script 100-150 words (creates 40-60s video with natural pacing).`
    : duration === 60
    ? `Scene 1: HOOK — Pattern interrupt. 1-2 sentences maximum.
Scene 2: PROBLEM AGITATION — Make the pain real. 2-3 sentences.
Scene 3: AUTHORITY — Credibility. 2-3 sentences with specific proof (only if data provided).
Scene 4: SOLUTION — Introduce the product and how it works. 2-3 sentences.
Scene 5: CTA — Single specific action. 1-2 sentences maximum.

⚠️ WRITE PUNCHY, CONCISE COPY: Each scene should be 10-25 words. Total script 100-150 words (creates 40-60s video with natural pacing).`
    : `Scene 1: HOOK — 1-2 sentences
Scene 2: PROBLEM AGITATION — 2-3 sentences
Scene 3: RELATABLE STORY SCENARIO — 3-4 sentences
Scene 4: SOLUTION + MECHANISM — 3-4 sentences
Scene 5: PROOF + TESTIMONIAL (only if provided above) — 2-3 sentences
Scene 6: BENEFITS STACK — 2-3 sentences
Scene 7: CTA — 1-2 sentences

⚠️ WRITE PUNCHY, CONCISE COPY: Total script 200-250 words (creates 80-100s video with natural pacing).`
}

${globalRules}`;
  }

  if (videoType === "proof_results") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

${NICHE_DETECTION}

${BANNED_WORDS}

${CUSTOMER_LANGUAGE_RULE}

${META_COMPLIANCE}

${PEXELS_QUERY_RULE}

Generate a ${duration}-second PROOF/RESULTS video ad script. Lead with outcomes, not problems.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Bold result claim using niche-specific language
Scene 2 (5-15s): BEFORE STATE — Where they were (name the specific situation, not the emotion)
Scene 3 (15-25s): AFTER STATE — Where they are now (concrete, specific, observable)
Scene 4 (25-${duration}s): CTA`
    : `Scene 1 (0-5s): HOOK — Bold result claim using niche-specific language
Scene 2 (5-15s): BEFORE STATE — Pain and struggle (name the specific situation, not the emotion)
Scene 3 (15-30s): WHAT CHANGED — Name the specific mechanism or decision that changed things
Scene 4 (30-45s): AFTER STATE — Results achieved (concrete number or named outcome)
Scene 5 (45-55s): SOCIAL PROOF (only use numbers provided above — never fabricate)
Scene 6 (55-${duration}s): CTA — Invite them to get same results`
}

EXTRA RULES FOR PROOF/RESULTS:
- Lead with the result, not the problem
- Use "from X to Y" language where possible — name the specific before state and after state
- If no social proof numbers are provided, use directional language: "hundreds of coaches", "most of our clients" — never fabricate a number
- CTA must use the specificOutcome field language — never use generic phrases like "change your life" or "get results"

${globalRules}`;
  }

  if (videoType === "testimonial") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

${BANNED_WORDS}

${CUSTOMER_LANGUAGE_RULE}

${META_COMPLIANCE}

${PEXELS_QUERY_RULE}

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
Scene 1 (0-5s): HOOK — Before state (name the specific situation, not the emotion)
Scene 2 (5-15s): THE PROBLEM — What they were dealing with (niche-specific, observable)
Scene 3 (15-30s): DISCOVERY — How they found the solution
Scene 4 (30-45s): WHAT CHANGED — Name the specific thing that changed, not a generic description
Scene 5 (45-55s): RESULTS — Where they are now (concrete outcome — number, named situation, or specific capability)
Scene 6 (55-${duration}s): CTA — Invite viewer to have same experience

EXTRA RULES:
- Write in first person if using real testimonial, third person/imagine framing if not
- Show the journey through specific situations, not emotional labels
- On-screen text should use quote-style highlights
- Visual direction should suggest testimonial card layout
- Never fabricate results, income claims, or specific numbers not provided in the service data

${globalRules}`;
  }

  if (videoType === "mechanism_reveal") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second MECHANISM REVEAL video ad script. The goal is to position the unique mechanism as a fundamentally different structural approach to the problem — naming the old way and explaining the precise mechanistic difference, not making vague claims of proprietary status.

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
- Name the specific thing that makes this mechanism structurally different from what the audience has already tried. The mechanism must be genuinely differentiated — name the old approach explicitly and explain the precise structural difference.
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

      let scriptData: { scenes: Scene[]; angle?: string; nicheWorld?: string };
      let voiceoverText: string;

      // ✅ ALL services go through buildScriptPrompt — no exceptions, no hardcoded bypass
      console.log(`[VideoScripts] Generating live ZAP script for service: ${service.name}`);
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

      // Word count validation — max 150 words
      const totalWords = scriptData.scenes.reduce((sum: number, s: any) =>
        sum + (s.voiceoverText?.trim().split(/\s+/).length || 0), 0
      );
      console.log(`[Script] Total word count: ${totalWords}`);
      if (totalWords > 150) {
        throw new Error(`Script too long: ${totalWords} words. Maximum 150. Regenerate.`);
      }

      console.log(`✅ ZAP-generated script for: ${service.name}`);
      scriptData.scenes.forEach((scene: any, i: number) => {
        console.log(`  Scene ${i + 1} [${scene.sceneType || scene.sceneNumber}]: "${scene.voiceoverText}"`);
        console.log(`    pexelsQuery: "${scene.pexelsQuery}"`);
      });

      voiceoverText = scriptData.scenes.map((s) => s.voiceoverText).join(" ");

      // Attach top-level angle/nicheWorld to first scene so it's accessible from video insert
      const enrichedScenes = scriptData.scenes.map((s: any, i: number) =>
        i === 0 ? { ...s, _angle: scriptData.angle, _nicheWorld: scriptData.nicheWorld, _wordCount: totalWords } : s
      );

      const [record] = await db.insert(videoScripts).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId ?? null,
        videoType: input.videoType,
        duration: input.duration,
        visualStyle: input.visualStyle,
        scenes: enrichedScenes,
        voiceoverText,
        status: "draft",
      });

      return {
        scriptId: (record as any).insertId,
        scenes: enrichedScenes,
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
            voiceoverText: z.string(),
            visualDirection: z.string(),
            onScreenText: z.string(),
            pexelsQuery: z.string().optional(),
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

  /**
   * generateAsync — wraps the synchronous generate in the standard V2 background
   * job pattern. Returns jobId immediately; script generation runs via setImmediate.
   * On completion stores { scriptId, scenes, voiceoverText, creditCost } in jobs.result.
   */
  generateAsync: protectedProcedure
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
      // Pre-fetch service data synchronously before setImmediate
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      }
      const capturedUserId = ctx.user.id;
      const capturedInput = { ...input };
      const capturedService = { ...service };
      // Create job record
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });
      // Fire background generation
      setImmediate(async () => {
        try {
          const { getDb: getDbBg } = await import("../db");
          const { eq: eqBg } = await import("drizzle-orm");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");
          const { videoScripts: videoScriptsTable, jobs: jobsTable } = await import("../../drizzle/schema");
          // Use the exact V1 prompt verbatim
          const prompt = buildScriptPrompt(
            capturedInput.videoType,
            parseInt(capturedInput.duration),
            capturedService
          );
          const { invokeLLM: invokeLLMBg } = await import("../_core/llm");
          const response = await invokeLLMBg({
            messages: [{ role: "user", content: prompt }],
            maxTokens: 2000,
          });
          const rawContent = response.choices[0]?.message?.content;
          if (!rawContent || typeof rawContent !== "string") throw new Error("Invalid AI response");
          const cleaned = rawContent.replace(/```json|```/g, "").trim();
          let parsed: any;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            throw new Error("Script generation failed — LLM did not return valid JSON");
          }
          if (!parsed.scenes || parsed.scenes.length !== 5) {
            throw new Error(`Invalid script structure — expected 5 scenes, got ${parsed.scenes?.length ?? 0}`);
          }
          const totalWords = parsed.scenes.reduce(
            (sum: number, s: any) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0),
            0
          );
          if (totalWords > 150) {
            throw new Error(`Script too long: ${totalWords} words. Maximum 150.`);
          }
          const voiceoverText = parsed.scenes.map((s: any) => s.voiceoverText).join(" ");
          const enrichedScenes = parsed.scenes.map((s: any, i: number) =>
            i === 0
              ? { ...s, _angle: parsed.angle, _nicheWorld: parsed.nicheWorld, _wordCount: totalWords }
              : s
          );
          const [record] = await bgDb.insert(videoScriptsTable).values({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId ?? null,
            videoType: capturedInput.videoType,
            duration: capturedInput.duration,
            visualStyle: capturedInput.visualStyle,
            scenes: enrichedScenes,
            voiceoverText,
            status: "draft",
          });
          const scriptId = (record as any).insertId;
          const creditCost = getCreditCost(capturedInput.duration);
          await bgDb
            .update(jobsTable)
            .set({
              status: "complete",
              result: JSON.stringify({ scriptId, scenes: enrichedScenes, voiceoverText, creditCost }),
            })
            .where(eqBg(jobsTable.id, jobId));
          console.log(`[videoScripts.generateAsync] Job ${jobId} complete — scriptId: ${scriptId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[videoScripts.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 } = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });
      return { jobId };
    }),
});

// Export helper functions for campaign batch generation
export async function generateVideoScriptForService(params: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  videoType: "explainer" | "proof_results" | "testimonial" | "mechanism_reveal";
  duration: "15" | "30" | "60" | "90";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get service details
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, params.serviceId))
    .limit(1);

  if (!service) throw new Error("Service not found");

  // ✅ Generate script using buildScriptPrompt — the ZAP generator with all rules
  console.log(`[VideoScripts] Generating live ZAP script for campaign video: ${service.name}`);
  const prompt = buildScriptPrompt(params.videoType, parseInt(params.duration), service);
  const { invokeLLM } = await import("../_core/llm");
  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2000,
  });
  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") throw new Error("Invalid AI response");
  const cleaned = rawContent.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Script generation failed — LLM did not return valid JSON");
  }
  if (!parsed.scenes || parsed.scenes.length !== 5) {
    throw new Error(`Invalid script structure — expected 5 scenes, got: ${JSON.stringify(parsed)}`);
  }

  // Word count validation — max 150 words
  const totalWords = parsed.scenes.reduce((sum: number, s: any) =>
    sum + (s.voiceoverText?.trim().split(/\s+/).length || 0), 0
  );
  console.log(`[Script] Total word count: ${totalWords}`);
  if (totalWords > 150) {
    throw new Error(`Script too long: ${totalWords} words. Maximum 150. Regenerate.`);
  }

  console.log(`✅ ZAP-generated script for: ${service.name}`);
  console.log(`  Angle: ${parsed.angle || 'N/A'} | Niche world: ${parsed.nicheWorld || 'N/A'}`);
  parsed.scenes.forEach((scene: any, i: number) => {
    console.log(`  Scene ${i + 1} [${scene.sceneType}]: "${scene.voiceoverText}"`);
    console.log(`    pexelsQuery: "${scene.pexelsQuery}"`);
  });
  const voiceoverTextFull = parsed.scenes.map((s: any) => s.voiceoverText).join(" ");

  // Save script to database
  const [record] = await db.insert(videoScripts).values({
    userId: params.userId,
    serviceId: params.serviceId,
    campaignId: params.campaignId || null,
    videoType: params.videoType,
    duration: params.duration,
    visualStyle: "kinetic_typography",
    scenes: parsed.scenes,
    voiceoverText: voiceoverTextFull,
    status: "draft",
  });

  return (record as any).insertId;
}

export async function renderVideoFromScript(params: {
  userId: number;
  scriptId: number;
  visualStyle: "text_only" | "kinetic_typography" | "motion_graphics" | "stats_card";
  campaignId?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get script
  const [script] = await db
    .select()
    .from(videoScripts)
    .where(eq(videoScripts.id, params.scriptId))
    .limit(1);

  if (!script) throw new Error("Script not found");

  // Import render function from videos router
  const { renderVideo } = await import("./videos");
  const { videoCredits, videoCreditTransactions, videos } = await import("../../drizzle/schema");

  // Calculate credit cost
  const creditCost = getCreditCost(script.duration);

  // Check credit balance
  const [creditBalance] = await db
    .select()
    .from(videoCredits)
    .where(eq(videoCredits.userId, params.userId))
    .limit(1);

  if (!creditBalance || creditBalance.balance < creditCost) {
    throw new Error(`Insufficient credits: need ${creditCost}, have ${creditBalance?.balance || 0}`);
  }

  // Deduct credits
  await db
    .update(videoCredits)
    .set({
      balance: creditBalance.balance - creditCost,
      updatedAt: new Date(),
    })
    .where(eq(videoCredits.userId, params.userId));

  // Record transaction
  await db.insert(videoCreditTransactions).values({
    userId: params.userId,
    type: "deduction",
    amount: -creditCost,
    balanceAfter: creditBalance.balance - creditCost,
    description: `Video generation (${script.duration}s, ${params.visualStyle})`,
  });

  // Create video record
  const [videoRecord] = await db.insert(videos).values({
    userId: params.userId,
    scriptId: params.scriptId,
    serviceId: script.serviceId,
    campaignId: params.campaignId || null,
    videoType: script.videoType,
    duration: script.duration,
    visualStyle: params.visualStyle,
    creatomateStatus: "queued",
    creditsUsed: creditCost,
  });

  const videoId = (videoRecord as any).insertId;

  // Trigger async render
  renderVideo({
    videoId,
    script,
    visualStyle: params.visualStyle,
    brandColor: "#3B82F6",
    logoUrl: undefined,
    userId: params.userId,
    creditCost,
    originalBalance: creditBalance.balance,
    isZapDemo: false,
  }).catch(async (error) => {
    console.error(`[renderVideoFromScript] Video ${videoId} render failed:`, error);
    // Refund credits on failure
    const db = await getDb();
    if (!db) return;
    await db
      .update(videoCredits)
      .set({ balance: creditBalance.balance, updatedAt: new Date() })
      .where(eq(videoCredits.userId, params.userId));
    await db.insert(videoCreditTransactions).values({
      userId: params.userId,
      amount: creditCost,
      type: "refund",
      balanceAfter: creditBalance.balance,
      description: `Refund: Video generation failed (${script.duration}s)`,
    });
  });

  return videoId;
}

// All script generation uses buildScriptPrompt — the ZAP generator with all niche detection and copywriting rules
