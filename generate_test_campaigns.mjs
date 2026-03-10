/**
 * Autonomous Campaign Generation Script
 * Generates all 11 nodes for 5 test accounts using real Claude API calls
 * Run from: /home/ubuntu/coachflow
 */
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(messages, responseFormat = null) {
  // Use Forge API if available, else Anthropic directly
  if (FORGE_API_URL && FORGE_API_KEY) {
    const body = {
      model: 'claude-sonnet-4-5',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    };
    if (responseFormat) body.response_format = responseFormat;
    const res = await fetch(`${FORGE_API_URL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FORGE_API_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } else {
    // Direct Anthropic
    const anthropicMessages = messages.filter(m => m.role !== 'system');
    const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
    const body = {
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemMsg,
      messages: anthropicMessages.map(m => ({ role: m.role, content: m.content })),
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
}

function parseJSON(text) {
  try {
    const cleaned = text.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function nanoid(size = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < size; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Campaign definitions ─────────────────────────────────────────────────────
const CAMPAIGNS = [
  {
    userId: 7200001,
    email: 'test-fitness@zapcampaigns.com',
    service: {
      name: 'Online Fitness Coaching',
      category: 'coaching',
      description: 'A 90-day online fitness coaching program for busy professionals over 35 who want to lose 20 pounds without spending hours at the gym.',
      targetCustomer: 'Busy professionals over 35',
      mainBenefit: 'Lose 20 pounds in 90 days',
      painPoints: 'No time for the gym, struggling to lose weight despite trying multiple diets',
      hvcoTopic: 'The Busy Professional Fat Loss Blueprint',
      uniqueMechanismSuggestion: '20-Minute Metabolic Reset Method',
    },
  },
  {
    userId: 7200002,
    email: 'test-realestate@zapcampaigns.com',
    service: {
      name: 'Real Estate Investment Coaching',
      category: 'coaching',
      description: 'A 6-month coaching program helping first-time property investors buy their first investment property with confidence.',
      targetCustomer: 'First-time property investors',
      mainBenefit: 'Buy their first investment property in 6 months',
      painPoints: "Don't know where to start, overwhelmed by the complexity of property investment",
      hvcoTopic: 'The First Property Investor Fast-Start Guide',
      uniqueMechanismSuggestion: 'Property Profit Pathway System',
    },
  },
  {
    userId: 7200003,
    email: 'test-mindset@zapcampaigns.com',
    service: {
      name: 'Mindset and Performance Coaching',
      category: 'coaching',
      description: 'A high-performance coaching program for entrepreneurs stuck under $10k/month who want to break through to consistent 6-figure months.',
      targetCustomer: 'Entrepreneurs stuck under $10k per month',
      mainBenefit: 'Break through to consistent 6-figure months',
      painPoints: 'Self-sabotage, fear of failure, imposter syndrome blocking income growth',
      hvcoTopic: 'The 6-Figure Mindset Breakthrough Blueprint',
      uniqueMechanismSuggestion: 'Neural Wealth Activation Protocol',
    },
  },
  {
    userId: 7200004,
    email: 'test-relationships@zapcampaigns.com',
    service: {
      name: 'Relationship Coaching for Women',
      category: 'coaching',
      description: 'A 90-day relationship coaching program for single women over 40 who want to attract a high-quality partner.',
      targetCustomer: 'Single women over 40',
      mainBenefit: 'Attract a high-quality partner in 90 days',
      painPoints: 'Keep attracting the wrong men, feeling like time is running out, past relationship trauma',
      hvcoTopic: 'The High-Value Woman Attraction Blueprint',
      uniqueMechanismSuggestion: 'Magnetic Feminine Energy Method',
    },
  },
  {
    userId: 7200005,
    email: 'test-business@zapcampaigns.com',
    service: {
      name: 'Business Launch Coaching',
      category: 'coaching',
      description: 'A 12-month coaching program for corporate employees who want to replace their salary with their own business.',
      targetCustomer: 'Corporate employees who want to quit their job',
      mainBenefit: 'Replace their salary with their own business in 12 months',
      painPoints: "Don't know what business to start, fear of leaving job security, overwhelmed by options",
      hvcoTopic: 'The Corporate Escape Business Launch Blueprint',
      uniqueMechanismSuggestion: 'Salary-to-Freedom Launch System',
    },
  },
];

// ─── Node generators ──────────────────────────────────────────────────────────

async function generateICP(conn, userId, serviceId, service) {
  console.log(`  [Node 2] Generating ICP...`);
  const prompt = `Create a detailed Ideal Customer Profile for this service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Points: ${service.painPoints}

Return JSON with these exact keys:
{
  "introduction": "2-3 paragraph overview",
  "fears": "• Fear 1\\n• Fear 2\\n• Fear 3\\n• Fear 4\\n• Fear 5",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n• Dream 3\\n• Dream 4\\n• Dream 5",
  "demographics": {"age_range":"35-55","gender":"mixed","income_level":"$60k-$120k","education":"college","occupation":"professional","location":"USA/UK/AUS","family_status":"married or single"},
  "psychographics": "3-4 paragraphs about personality and lifestyle",
  "pains": "• Pain 1\\n• Pain 2\\n• Pain 3\\n• Pain 4\\n• Pain 5\\n• Pain 6\\n• Pain 7",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n• Frustration 3\\n• Frustration 4\\n• Frustration 5",
  "goals": "• Goal 1\\n• Goal 2\\n• Goal 3\\n• Goal 4\\n• Goal 5\\n• Goal 6",
  "values": "• Value 1\\n• Value 2\\n• Value 3\\n• Value 4\\n• Value 5",
  "objections": "• Objection 1\\n• Objection 2\\n• Objection 3\\n• Objection 4\\n• Objection 5",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n• Trigger 3\\n• Trigger 4\\n• Trigger 5",
  "mediaConsumption": "Where they consume content",
  "influencers": "Who they follow and trust",
  "communicationStyle": "How they prefer to communicate",
  "decisionMaking": "How they make purchasing decisions",
  "successMetrics": "How they measure success",
  "implementationBarriers": "What stops them from taking action"
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert marketing strategist. Always respond with valid JSON only, no markdown.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data) throw new Error('Failed to parse ICP JSON');

  const [result] = await conn.execute(
    `INSERT INTO idealCustomerProfiles (userId, serviceId, name, introduction, fears, hopesDreams, demographics, psychographics, pains, frustrations, goals, \`values\`, objections, buyingTriggers, mediaConsumption, influencers, communicationStyle, decisionMaking, successMetrics, implementationBarriers, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId, serviceId, `${service.targetCustomer} Profile`, data.introduction, data.fears, data.hopesDreams,
     JSON.stringify(data.demographics), data.psychographics, data.pains, data.frustrations, data.goals,
     data.values, data.objections, data.buyingTriggers, data.mediaConsumption, data.influencers,
     data.communicationStyle, data.decisionMaking, data.successMetrics, data.implementationBarriers]
  );
  console.log(`  [Node 2] ICP created (id: ${result.insertId})`);
  return result.insertId;
}

async function generateOffer(conn, userId, serviceId, service) {
  console.log(`  [Node 3] Generating Offer...`);
  const prompt = `Create a compelling sales offer for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Generate 3 offer angles as JSON:
{
  "godfather": {
    "offerName": "Irresistible offer name",
    "headline": "Compelling headline",
    "subheadline": "Supporting subheadline",
    "whatYouGet": "• Deliverable 1\\n• Deliverable 2\\n• Deliverable 3\\n• Deliverable 4\\n• Deliverable 5",
    "bonuses": "• Bonus 1 (Value $X)\\n• Bonus 2 (Value $X)\\n• Bonus 3 (Value $X)",
    "guarantee": "30-day money back guarantee description",
    "price": "Price and payment options",
    "urgency": "Why act now"
  },
  "free": {
    "offerName": "Free value offer name",
    "headline": "Free angle headline",
    "subheadline": "Free angle subheadline",
    "whatYouGet": "• Free deliverable 1\\n• Free deliverable 2\\n• Free deliverable 3",
    "bonuses": "• Free bonus 1\\n• Free bonus 2",
    "guarantee": "Guarantee for free offer",
    "price": "Free + upsell path",
    "urgency": "Limited availability"
  },
  "dollar": {
    "offerName": "Dollar value offer name",
    "headline": "Value-focused headline",
    "subheadline": "Value subheadline",
    "whatYouGet": "• High-value deliverable 1\\n• High-value deliverable 2\\n• High-value deliverable 3",
    "bonuses": "• Premium bonus 1\\n• Premium bonus 2",
    "guarantee": "Premium guarantee",
    "price": "Premium pricing",
    "urgency": "Exclusive access"
  }
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert sales copywriter. Always respond with valid JSON only, no markdown.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data) throw new Error('Failed to parse Offer JSON');

  const [result] = await conn.execute(
    `INSERT INTO offers (userId, serviceId, productName, offerType, godfatherAngle, freeAngle, dollarAngle, activeAngle, rating, createdAt, updatedAt)
     VALUES (?, ?, ?, 'standard', ?, ?, ?, 'godfather', 0, NOW(), NOW())`,
    [userId, serviceId, service.name, JSON.stringify(data.godfather), JSON.stringify(data.free), JSON.stringify(data.dollar)]
  );
  console.log(`  [Node 3] Offer created (id: ${result.insertId})`);
  return result.insertId;
}

async function generateHeroMechanism(conn, userId, serviceId, service) {
  console.log(`  [Node 4] Generating Hero Mechanism...`);
  const prompt = `Create a unique mechanism/method for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Suggested Name: ${service.uniqueMechanismSuggestion}

Generate 3 unique mechanism names and descriptions as JSON:
{
  "mechanisms": [
    {
      "name": "${service.uniqueMechanismSuggestion}",
      "description": "3-4 paragraph explanation of how this proprietary method works and why it gets results faster than anything else"
    },
    {
      "name": "Alternative mechanism name 2",
      "description": "3-4 paragraph explanation"
    },
    {
      "name": "Alternative mechanism name 3",
      "description": "3-4 paragraph explanation"
    }
  ]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert marketing strategist specializing in unique mechanisms. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data?.mechanisms?.length) throw new Error('Failed to parse HeroMechanism JSON');

  const setId = nanoid(21);
  for (const mech of data.mechanisms) {
    await conn.execute(
      `INSERT INTO heroMechanisms (userId, serviceId, mechanismSetId, tabType, mechanismName, mechanismDescription, targetMarket, pressingProblem, whyProblem, whatTried, whyExistingNotWork, desiredOutcome, credibility, socialProof, createdAt, updatedAt)
       VALUES (?, ?, ?, 'hero_mechanisms', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, serviceId, setId, mech.name, mech.description,
       service.targetCustomer, service.painPoints,
       `Traditional solutions don't address the root cause`,
       `Generic programs and advice that don't account for individual circumstances`,
       `They treat symptoms not causes and lack personalization`,
       service.mainBenefit,
       `Proven results with hundreds of clients achieving ${service.mainBenefit}`,
       `Clients consistently achieve ${service.mainBenefit} using this method`]
    );
  }
  const [[row]] = await conn.execute(`SELECT id FROM heroMechanisms WHERE userId=? AND mechanismSetId=? LIMIT 1`, [userId, setId]);
  console.log(`  [Node 4] Hero Mechanism created (setId: ${setId})`);
  return row.id;
}

async function generateHVCO(conn, userId, serviceId, service) {
  console.log(`  [Node 5] Generating HVCO titles...`);
  const prompt = `Generate high-value content offer titles for this service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
HVCO Topic: ${service.hvcoTopic}

Generate 10 compelling titles as JSON:
{
  "longTitles": [
    "Long title 1 (10-15 words)",
    "Long title 2",
    "Long title 3",
    "Long title 4",
    "Long title 5"
  ],
  "shortTitles": [
    "Short title 1 (5-7 words)",
    "Short title 2",
    "Short title 3",
    "Short title 4",
    "Short title 5"
  ]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert copywriter specializing in lead magnets and free offers. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data) throw new Error('Failed to parse HVCO JSON');

  const setId = nanoid(21);
  const allTitles = [
    ...(data.longTitles || []).map(t => ({ title: t, tabType: 'long' })),
    ...(data.shortTitles || []).map(t => ({ title: t, tabType: 'short' })),
  ];

  for (const item of allTitles) {
    await conn.execute(
      `INSERT INTO hvcoTitles (userId, serviceId, hvcoSetId, tabType, title, targetMarket, hvcoTopic, rating, isFavorite, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [userId, serviceId, setId, item.tabType, item.title.substring(0, 499), service.targetCustomer.substring(0, 499), service.hvcoTopic]
    );
  }
  const [[row]] = await conn.execute(`SELECT id FROM hvcoTitles WHERE userId=? AND hvcoSetId=? LIMIT 1`, [userId, setId]);
  console.log(`  [Node 5] HVCO titles created (setId: ${setId})`);
  return row.id;
}

async function generateHeadlines(conn, userId, serviceId, service) {
  console.log(`  [Node 6] Generating Headlines...`);
  const prompt = `Generate 15 powerful ad headlines for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Point: ${service.painPoints}

Generate headlines in these categories as JSON:
{
  "story": ["Story headline 1", "Story headline 2", "Story headline 3"],
  "eyebrow": ["Eyebrow headline 1 (with eyebrow text)", "Eyebrow headline 2", "Eyebrow headline 3"],
  "question": ["Question headline 1?", "Question headline 2?", "Question headline 3?"],
  "authority": ["Authority headline 1", "Authority headline 2", "Authority headline 3"],
  "urgency": ["Urgency headline 1", "Urgency headline 2", "Urgency headline 3"]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert direct response copywriter. Always respond with valid JSON only, no markdown.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data) throw new Error('Failed to parse Headlines JSON');

  const setId = nanoid(21);
  const formulaTypes = ['story', 'eyebrow', 'question', 'authority', 'urgency'];
  for (const formula of formulaTypes) {
    const items = data[formula] || [];
    for (const headline of items) {
      await conn.execute(
        `INSERT INTO headlines (userId, serviceId, headlineSetId, formulaType, headline, targetMarket, pressingProblem, desiredOutcome, uniqueMechanism, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, serviceId, setId, formula, headline, service.targetCustomer, service.painPoints, service.mainBenefit, service.uniqueMechanismSuggestion]
      );
    }
  }
  const [[row]] = await conn.execute(`SELECT id FROM headlines WHERE userId=? AND headlineSetId=? LIMIT 1`, [userId, setId]);
  console.log(`  [Node 6] Headlines created (setId: ${setId})`);
  return row.id;
}

async function generateAdCopy(conn, userId, serviceId, service) {
  console.log(`  [Node 7] Generating Ad Copy...`);
  const prompt = `Generate Meta-compliant ad copy for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Point: ${service.painPoints}
Unique Method: ${service.uniqueMechanismSuggestion}

Generate 3 complete ad sets as JSON:
{
  "ads": [
    {
      "headline": "Compelling ad headline (under 40 chars)",
      "body": "Full ad body copy (150-300 words). Tell a story, address the pain, introduce the solution, include a CTA.",
      "link": "Click here to discover [benefit] →"
    },
    {
      "headline": "Second ad headline variation",
      "body": "Second ad body copy variation with different angle",
      "link": "Second link text variation →"
    },
    {
      "headline": "Third ad headline variation",
      "body": "Third ad body copy with testimonial angle",
      "link": "Third link text →"
    }
  ]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert Meta ads copywriter. Write compliant, compelling ad copy. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data?.ads?.length) throw new Error('Failed to parse AdCopy JSON');

  const adSetId = nanoid(21);
  for (const ad of data.ads) {
    // Insert headline
    await conn.execute(
      `INSERT INTO adCopy (userId, serviceId, adSetId, adType, contentType, content, targetMarket, pressingProblem, desiredOutcome, uniqueMechanism, createdAt, updatedAt)
       VALUES (?, ?, ?, 'lead_gen', 'headline', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, serviceId, adSetId, ad.headline, service.targetCustomer, service.painPoints, service.mainBenefit, service.uniqueMechanismSuggestion]
    );
    // Insert body
    await conn.execute(
      `INSERT INTO adCopy (userId, serviceId, adSetId, adType, contentType, content, targetMarket, pressingProblem, desiredOutcome, uniqueMechanism, createdAt, updatedAt)
       VALUES (?, ?, ?, 'lead_gen', 'body', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, serviceId, adSetId, ad.body, service.targetCustomer, service.painPoints, service.mainBenefit, service.uniqueMechanismSuggestion]
    );
    // Insert link
    await conn.execute(
      `INSERT INTO adCopy (userId, serviceId, adSetId, adType, contentType, content, targetMarket, pressingProblem, desiredOutcome, uniqueMechanism, createdAt, updatedAt)
       VALUES (?, ?, ?, 'lead_gen', 'link', ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, serviceId, adSetId, ad.link, service.targetCustomer, service.painPoints, service.mainBenefit, service.uniqueMechanismSuggestion]
    );
  }
  const [[row]] = await conn.execute(`SELECT id FROM adCopy WHERE userId=? AND adSetId=? LIMIT 1`, [userId, adSetId]);
  console.log(`  [Node 7] Ad Copy created (adSetId: ${adSetId})`);
  return row.id;
}

async function generateLandingPage(conn, userId, serviceId, service) {
  console.log(`  [Node 8] Generating Landing Page...`);
  const prompt = `Create a complete landing page for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Unique Method: ${service.uniqueMechanismSuggestion}
HVCO: ${service.hvcoTopic}

Generate a full landing page as JSON with this structure:
{
  "headline": "Main headline (benefit-focused)",
  "subheadline": "Supporting subheadline",
  "heroSection": "Opening paragraph that hooks the reader",
  "problemSection": "2-3 paragraphs describing the problem",
  "solutionSection": "2-3 paragraphs introducing the solution",
  "mechanismSection": "2-3 paragraphs explaining the unique method",
  "benefitsSection": "• Benefit 1\\n• Benefit 2\\n• Benefit 3\\n• Benefit 4\\n• Benefit 5",
  "socialProof": "Testimonial or social proof section",
  "offerSection": "What they get when they sign up",
  "ctaSection": "Call to action copy",
  "faqSection": "3 common questions and answers",
  "closingSection": "Final urgency/closing paragraph"
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert landing page copywriter. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data) throw new Error('Failed to parse LandingPage JSON');

  // Store as originalAngle content
  const [result] = await conn.execute(
    `INSERT INTO landingPages (userId, serviceId, productName, productDescription, avatarName, avatarDescription, originalAngle, activeAngle, rating, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'original', 0, NOW(), NOW())`,
    [userId, serviceId, service.name, `${service.mainBenefit} for ${service.targetCustomer}`,
     `Ideal ${service.targetCustomer}`, service.targetCustomer, JSON.stringify(data)]
  );
  console.log(`  [Node 8] Landing Page created (id: ${result.insertId})`);
  return result.insertId;
}

async function generateEmailSequence(conn, userId, serviceId, service) {
  console.log(`  [Node 9] Generating Email Sequence...`);
  const prompt = `Create a 7-email welcome sequence for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Point: ${service.painPoints}

Generate a 7-email sequence as JSON:
{
  "emails": [
    {
      "day": 1,
      "subject": "Email 1 subject line",
      "body": "Full email body (200-400 words). Warm welcome, set expectations, quick win.",
      "timing": "Immediately after opt-in"
    },
    {
      "day": 2,
      "subject": "Email 2 subject line",
      "body": "Full email body. Share your story, build connection.",
      "timing": "Day 2"
    },
    {
      "day": 3,
      "subject": "Email 3 subject line",
      "body": "Full email body. Deliver value, address main pain point.",
      "timing": "Day 3"
    },
    {
      "day": 4,
      "subject": "Email 4 subject line",
      "body": "Full email body. Social proof, case study.",
      "timing": "Day 4"
    },
    {
      "day": 5,
      "subject": "Email 5 subject line",
      "body": "Full email body. Introduce the solution/method.",
      "timing": "Day 5"
    },
    {
      "day": 7,
      "subject": "Email 6 subject line",
      "body": "Full email body. Soft pitch, offer introduction.",
      "timing": "Day 7"
    },
    {
      "day": 10,
      "subject": "Email 7 subject line",
      "body": "Full email body. Final CTA, urgency close.",
      "timing": "Day 10"
    }
  ]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert email marketing copywriter. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data?.emails?.length) throw new Error('Failed to parse EmailSequence JSON');

  const [result] = await conn.execute(
    `INSERT INTO emailSequences (userId, serviceId, sequenceType, name, emails, automationEnabled, rating, createdAt, updatedAt)
     VALUES (?, ?, 'welcome', ?, ?, 0, 0, NOW(), NOW())`,
    [userId, serviceId, `${service.name} Welcome Sequence`, JSON.stringify(data.emails)]
  );
  console.log(`  [Node 9] Email Sequence created (id: ${result.insertId})`);
  return result.insertId;
}

async function generateWhatsAppSequence(conn, userId, serviceId, service) {
  console.log(`  [Node 10] Generating WhatsApp Sequence...`);
  const prompt = `Create a 7-message WhatsApp follow-up sequence for this coaching service:
Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Generate a 7-message WhatsApp sequence as JSON:
{
  "messages": [
    {
      "day": 1,
      "message": "WhatsApp message 1 (conversational, 50-100 words, use emojis naturally)",
      "timing": "1 hour after opt-in",
      "emojis": ["👋", "🎯"]
    },
    {
      "day": 1,
      "message": "WhatsApp message 2",
      "timing": "Day 1 evening",
      "emojis": ["💪", "✅"]
    },
    {
      "day": 2,
      "message": "WhatsApp message 3 - value tip",
      "timing": "Day 2 morning",
      "emojis": ["💡", "🔥"]
    },
    {
      "day": 3,
      "message": "WhatsApp message 4 - social proof",
      "timing": "Day 3",
      "emojis": ["⭐", "🏆"]
    },
    {
      "day": 5,
      "message": "WhatsApp message 5 - case study",
      "timing": "Day 5",
      "emojis": ["📈", "🎉"]
    },
    {
      "day": 7,
      "message": "WhatsApp message 6 - soft offer",
      "timing": "Day 7",
      "emojis": ["🚀", "💰"]
    },
    {
      "day": 10,
      "message": "WhatsApp message 7 - final CTA",
      "timing": "Day 10",
      "emojis": ["⏰", "🎯"]
    }
  ]
}`;

  const text = await callClaude([
    { role: 'system', content: 'You are an expert WhatsApp marketing copywriter. Always respond with valid JSON only.' },
    { role: 'user', content: prompt },
  ]);
  const data = parseJSON(text);
  if (!data?.messages?.length) throw new Error('Failed to parse WhatsApp JSON');

  const [result] = await conn.execute(
    `INSERT INTO whatsappSequences (userId, serviceId, sequenceType, name, messages, automationEnabled, rating, createdAt, updatedAt)
     VALUES (?, ?, 'engagement', ?, ?, 0, 0, NOW(), NOW())`,
    [userId, serviceId, `${service.name} WhatsApp Sequence`, JSON.stringify(data.messages)]
  );
  console.log(`  [Node 10] WhatsApp Sequence created (id: ${result.insertId})`);
  return result.insertId;
}

async function insertMetaPublished(conn, userId, service) {
  console.log(`  [Node 11] Inserting Push to Meta record...`);
  const adSetId = nanoid(21);
  const [result] = await conn.execute(
    `INSERT INTO meta_published_ads (userId, adSetId, metaCampaignId, metaAdSetId, metaAdId, metaCreativeId, campaignName, status, objective, dailyBudget, publishedAt, lastSyncedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PAUSED', 'LEAD_GENERATION', 25.00, NOW(), NOW(), NOW(), NOW())`,
    [userId, adSetId, `camp_test_${adSetId}`, `adset_test_${adSetId}`, `ad_test_${adSetId}`, `creative_test_${adSetId}`,
     `${service.name} - Lead Gen Campaign`]
  );
  console.log(`  [Node 11] Meta Published record created (id: ${result.insertId})`);
  return result.insertId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('Connected to database');

  const results = [];

  for (const campaign of CAMPAIGNS) {
    console.log(`\n=== Processing: ${campaign.email} ===`);
    const { userId, service } = campaign;

    try {
      // Node 1: Insert service
      console.log(`  [Node 1] Creating service...`);
      const [svcResult] = await conn.execute(
        `INSERT INTO services (userId, name, category, description, targetCustomer, mainBenefit, painPoints, hvcoTopic, uniqueMechanismSuggestion, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, service.name, service.category, service.description, service.targetCustomer, service.mainBenefit,
         service.painPoints, service.hvcoTopic, service.uniqueMechanismSuggestion]
      );
      const serviceId = svcResult.insertId;
      console.log(`  [Node 1] Service created (id: ${serviceId})`);

      // Nodes 2-11: Generate all content
      await generateICP(conn, userId, serviceId, service);
      await generateOffer(conn, userId, serviceId, service);
      await generateHeroMechanism(conn, userId, serviceId, service);
      await generateHVCO(conn, userId, serviceId, service);
      await generateHeadlines(conn, userId, serviceId, service);
      await generateAdCopy(conn, userId, serviceId, service);
      await generateLandingPage(conn, userId, serviceId, service);
      await generateEmailSequence(conn, userId, serviceId, service);
      await generateWhatsAppSequence(conn, userId, serviceId, service);
      await insertMetaPublished(conn, userId, service);

      results.push({ email: campaign.email, status: 'SUCCESS', serviceId });
      console.log(`  ✅ All 11 nodes complete for ${campaign.email}`);

    } catch (err) {
      console.error(`  ❌ Error for ${campaign.email}:`, err.message);
      results.push({ email: campaign.email, status: 'ERROR', error: err.message });
    }
  }

  await conn.end();

  console.log('\n=== GENERATION COMPLETE ===');
  for (const r of results) {
    console.log(`${r.status === 'SUCCESS' ? '✅' : '❌'} ${r.email}: ${r.status}${r.error ? ' - ' + r.error : ''}`);
  }

  // Write results to file for reference
  const fs = await import('fs');
  fs.writeFileSync('/home/ubuntu/campaign_results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to /home/ubuntu/campaign_results.json');
}

main().catch(console.error);
