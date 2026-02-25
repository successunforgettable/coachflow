// Test script generation for 3 different niches
import { invokeLLM } from './server/_core/llm';
import fs from 'fs';

// Mock service profiles for 3 different niches
const cryptoCoach = {
  name: "Crypto Entry Signals",
  targetCustomer: "Crypto traders who keep missing the best entries",
  targetMarket: "Day traders and swing traders in crypto",
  whyProblemExists: "You're watching 12 charts at once. You blink. The entry you've been waiting for happens. You miss it. Again.",
  desiredOutcome: "Never miss a high-probability entry again",
  mechanismDescriptor: "Real-time alerts the second a setup forms on your watchlist",
  mainBenefit: "Catch entries you would have missed",
  authority: "Built by a trader who's been in crypto since 2017",
  totalCustomers: 3400,
  averageRating: 4.8
};

const postpartumFitnessCoach = {
  name: "PostBaby Strong",
  targetCustomer: "Moms 6-18 months postpartum who feel disconnected from their bodies",
  targetMarket: "Postpartum moms struggling to rebuild core strength",
  whyProblemExists: "Your body doesn't feel like yours anymore. You try a workout. Your core doesn't engage. You feel weak. You stop.",
  desiredOutcome: "Rebuild your core and feel strong in your body again",
  mechanismDescriptor: "Progressive core reconnection system designed for postpartum bodies",
  mainBenefit: "Rebuild core strength without doing a single crunch",
  authority: "Pre/postnatal fitness specialist, mom of 3",
  totalCustomers: 1200,
  averageRating: 4.9
};

const tarotCoach = {
  name: "Tarot Business Blueprint",
  targetCustomer: "Tarot readers who love the cards but hate selling",
  targetMarket: "Spiritual practitioners who want to turn readings into income",
  whyProblemExists: "You give incredible readings. People cry. They transform. Then you feel gross asking for money. So you charge $20 and wonder why you're broke.",
  desiredOutcome: "Build a tarot business that feels aligned and pays your bills",
  mechanismDescriptor: "Spiritual business model that honors your gifts and your rent",
  mainBenefit: "Turn your tarot practice into consistent income without feeling like a sellout",
  authority: "Full-time tarot reader since 2019, $15k/month",
  totalCustomers: 890,
  averageRating: 5.0
};

// Build the prompt (copied from videoScripts.ts buildScriptPrompt function)
function buildTestPrompt(service: any): string {
  const NICHE_DETECTION = `
═══ NICHE DETECTION — DO THIS FIRST ═══

Read the service profile data carefully. Identify:
1. What WORLD does this coach operate in? (fitness, crypto, mindset, relationships, business, spiritual, parenting, etc.)
2. What language does that world use? (a fitness coach says "gains" and "macros", a crypto coach says "entries" and "bags", a mindset coach says "blocks" and "patterns")
3. What does FAILURE look like in that world? What are they afraid of?
4. What does SUCCESS look like in that world? What do they dream about?

Then write the ENTIRE script using only the language of that world.
A fitness ad must sound like a fitness coach wrote it.
A crypto ad must sound like a crypto trader wrote it.
A life coach ad must sound like a life coach wrote it.

If a life coach and a crypto trader could both use your script without changing a word — it is too generic. Rewrite it.
`;

  const ANGLE_SELECTION = `
═══ ANGLE SELECTION — CHOOSE ONE ═══

BEFORE WRITING ANYTHING, choose ONE angle for this script:
- Pain point: Lead with what the coach is LOSING or suffering right now
- Outcome: Lead with the specific transformation the coach's clients experience  
- Social proof: Lead with a specific number or result that creates instant credibility
- Curiosity: Lead with a counterintuitive truth about why ads fail for coaches
- Comparison: Lead with what makes this different from every other ad tool

State the chosen angle in your thinking. Then write the entire script through that single lens.
Only one angle per script. Do not mix them.
`;

  const BANNED_WORDS = `
═══ BANNED WORDS — NEVER USE THESE ═══

NEVER USE THESE WORDS OR PHRASES — they produce generic, forgettable copy:
- "proven frameworks", "proven strategies", "proven system"
- "AI-powered", "leverage AI", "harness the power"
- "transform", "transformation", "transformative"
- "streamline", "optimize", "innovative", "cutting-edge"
- "empower", "empowering", "unlock your potential"  
- "scale your business", "take your business to the next level"
- "overwhelmed", "challenges", "pain points"
- "in today's world", "in the digital age"
- "seamlessly", "effortlessly", "easily"
- Any word ending in "-ize" that isn't a common word

If you catch yourself writing any of these — stop. Rewrite the sentence using the coach's actual language.
`;

  const CUSTOMER_LANGUAGE_RULE = `
═══ CUSTOMER LANGUAGE RULE — MOST IMPORTANT ═══

Coaches do not talk like software companies. 
Write every line as if a coach who has been burned by bad ads is talking to another coach who is about to make the same mistake.

WRONG (software language): "ZAP leverages AI to optimize your campaign performance"
RIGHT (coach language): "I spent $4,000 on Facebook ads last year. Got 3 leads. All of them ghosted me."

WRONG: "Our proven framework delivers results"  
RIGHT: "900,000 people have been through my programs. None of them found me because of a fancy agency."

WRONG: "AI-powered campaigns at scale"
RIGHT: "You open the app. You answer 6 questions. Your ad is live on Facebook in 11 minutes."

The test: read each line out loud. If it sounds like a SaaS landing page — rewrite it. 
If it sounds like a coach talking to another coach — it's right.
`;

  const SPECIFICITY_RULE = `
═══ SPECIFICITY RULE — NUMBERS AND NAMES ═══

Every claim needs a number or a name. Vague claims are invisible.

WRONG: "Thousands of coaches trust ZAP"
RIGHT: "Built by a coach who's trained 900,000 students across 49 countries"

WRONG: "Get results fast"  
RIGHT: "Your first ad campaign. Live on Facebook. In under 15 minutes."

WRONG: "Stop wasting money on ads that don't work"
RIGHT: "You've already spent the money. You already know it didn't work. This is different."

If a sentence has no specific number, name, timeframe, or concrete detail — it is probably too vague.
`;

  const HOOK_RULE = `
═══ HOOK RULE — SCENE 1 ONLY ═══

The hook must create an open loop. A question, a tension, or a truth that 
cannot be resolved until the viewer watches the rest of the video.

The hook must also name something the viewer is LOSING — not something they could gain.
Loss is felt more than gain. Make them feel the loss.

WRONG hook: "Want to grow your coaching business with Facebook ads?"
RIGHT hook: "You've tried running Facebook ads before. You spent the money. You got nothing back."

WRONG hook: "Discover the secret to successful ad campaigns"
RIGHT hook: "Every coach I know has wasted at least $2,000 on ads that did absolutely nothing."

The hook does not mention ZAP. The hook does not mention solutions. 
The hook is only about the pain that is happening right now, today, without ZAP.
`;

  const baseContext = `
PRODUCT NAME: ${service.name}
TARGET AUDIENCE: ${service.targetCustomer || service.targetMarket}
PRESSING PROBLEM: ${service.whyProblemExists}
DESIRED OUTCOME: ${service.desiredOutcome}
UNIQUE MECHANISM: ${service.mechanismDescriptor}
KEY BENEFITS: ${service.mainBenefit}
AUTHORITY: ${service.authority}
SOCIAL PROOF: ${service.totalCustomers}+ customers, ${service.averageRating}/5 stars
`;

  return `You are a world-class direct response video scriptwriter for Meta ads.

${NICHE_DETECTION}

${ANGLE_SELECTION}

${BANNED_WORDS}

${CUSTOMER_LANGUAGE_RULE}

${SPECIFICITY_RULE}

${HOOK_RULE}

═══════════════════════════════════════════════════════════════════════════════

Generate an EXPLAINER video ad script. TOTAL DURATION MUST BE EXACTLY 28 SECONDS.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE (EXACTLY 5 SCENES, EXACTLY 28 SECONDS TOTAL):
Scene 1 (0-3s, duration: 3): HOOK — Fast punch. Pattern interrupt. Name the LOSS.
Scene 2 (3-7s, duration: 4): PROBLEM — Build pain. Make it relatable.
Scene 3 (7-12s, duration: 5): AUTHORITY — Credibility. Use social proof provided.
Scene 4 (12-20s, duration: 8): SOLUTION — Relief. Show how it works.
Scene 5 (20-28s, duration: 8): CTA — Drive action. Clear next step.

YOU MUST GENERATE EXACTLY 5 SCENES. DO NOT ADD A 6TH SCENE. TOTAL DURATION MUST BE 28 SECONDS.

MANDATORY RULES:
1. NEVER use prohibited Meta language: banned, forbidden, leaked, exposed, glitch, secret they don't want you to know
2. NEVER fabricate statistics, customer counts, or testimonials not provided above
3. NEVER make income guarantees or specific financial return claims
4. Keep voiceover text conversational — contractions, short sentences, spoken naturally
5. On-screen text must be 3-7 words MAXIMUM — punchy visual overlay
6. Visual direction must be achievable with motion graphics or kinetic typography
7. First scene must be a pattern interrupt — the hook that stops the scroll

RESPOND WITH VALID JSON ONLY. No markdown, no preamble, no explanation.
Format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 3,
      "voiceoverText": "Exact spoken words",
      "visualDirection": "What appears on screen — specific, achievable",
      "onScreenText": "3-7 word text overlay"
    }
  ]
}`;
}

async function testNicheScripts() {
  console.log('🎬 Testing Niche-Specific Script Generation\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const niches = [
    { name: "Crypto Trading Coach", service: cryptoCoach },
    { name: "Postpartum Fitness Coach", service: postpartumFitnessCoach },
    { name: "Tarot/Spiritual Coach", service: tarotCoach }
  ];
  
  for (const niche of niches) {
    console.log(`\n📝 Generating script for: ${niche.name}`);
    console.log('─'.repeat(79));
    
    const prompt = buildTestPrompt(niche.service);
    
    try {
      const response = await invokeLLM({
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      
      const scriptText = response.choices[0].message.content;
      const script = JSON.parse(scriptText);
      
      console.log(`\n✅ Script generated for ${niche.name}:\n`);
      
      script.scenes.forEach((scene: any) => {
        console.log(`Scene ${scene.sceneNumber} (${scene.duration}s):`);
        console.log(`  Voiceover: "${scene.voiceoverText}"`);
        console.log(`  On-screen: "${scene.onScreenText}"`);
        console.log('');
      });
      
      // Save to file
      fs.writeFileSync(
        `/home/ubuntu/script-${niche.name.toLowerCase().replace(/[^a-z]+/g, '-')}.json`,
        JSON.stringify(script, null, 2)
      );
      
    } catch (error: any) {
      console.error(`❌ Error generating script for ${niche.name}:`, error.message);
    }
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
  }
  
  console.log('\n\n🎯 VERIFICATION:');
  console.log('Check if all 3 scripts sound completely different.');
  console.log('If they sound similar — the niche detection is not working.\n');
}

testNicheScripts().catch(console.error);
