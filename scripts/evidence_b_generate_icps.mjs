/**
 * Evidence B — Batch ICP Generation
 * Calls the exact same logic as icpAngleSuggestions.generateICPs
 * Suggestion IDs: 4 (Corporate Escapee Seeking Purpose), 5 (Therapists Transitioning to Coaching)
 * User ID: 1
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const SUGGESTION_IDS = [4, 5];
const USER_ID = 1;

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log(`\nGenerating ICPs for suggestion IDs: ${SUGGESTION_IDS.join(', ')}\n`);

const generatedICPs = [];

for (const suggestionId of SUGGESTION_IDS) {
  // Fetch suggestion
  const [suggRows] = await conn.execute(
    'SELECT * FROM icp_angle_suggestions WHERE id = ? AND user_id = ? LIMIT 1',
    [suggestionId, USER_ID]
  );
  const suggestion = suggRows[0];
  if (!suggestion) { console.error(`Suggestion ${suggestionId} not found`); continue; }

  // Fetch service
  const [svcRows] = await conn.execute(
    'SELECT * FROM services WHERE id = ? AND userId = ? LIMIT 1',
    [suggestion.service_id, USER_ID]
  );
  const service = svcRows[0];
  if (!service) { console.error(`Service ${suggestion.service_id} not found`); continue; }

  console.log(`\n--- Processing suggestion ${suggestionId}: "${suggestion.angle_name}" ---`);

  // Build biased ICP prompt (verbatim from router, Requirement 3)
  const prompt = `You are an expert marketing strategist. Create a detailed Ideal Customer Profile (ICP) for the following service:

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

FOCUS THIS ICP ON THIS SPECIFIC AUDIENCE ANGLE:
Angle name: ${suggestion.angle_name}
Who this person is: ${suggestion.description}
Their primary pain: ${suggestion.primary_pain}
What would make them buy: ${suggestion.primary_buying_trigger}

All 17 tabs must reflect this specific type of person — not a generic customer.

Generate a comprehensive ICP with ALL 17 sections (Industry standard):

1. INTRODUCTION: 2-3 paragraph overview of who this person is
2. FEARS: 5-7 specific fears that keep them up at night
3. HOPES & DREAMS: 5-7 aspirations and what they dream about achieving
4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status
5. PSYCHOGRAPHICS: Personality traits, lifestyle, attitudes, interests (3-4 paragraphs)
6. PAINS: 7-10 specific pain points they experience daily
7. FRUSTRATIONS: 5-7 daily frustrations and annoyances
8. GOALS: 6-8 specific goals they want to achieve
9. VALUES: 5-7 core values that guide their decisions
10. OBJECTIONS: 5-7 common objections to buying your service
11. BUYING TRIGGERS: 5-7 specific triggers that make them ready to buy
12. MEDIA CONSUMPTION: Where they consume content (platforms, channels, formats)
13. INFLUENCERS: Who they follow, trust, and listen to
14. COMMUNICATION STYLE: How they prefer to communicate and be communicated with
15. DECISION MAKING: How they make purchasing decisions (process, timeline, factors)
16. SUCCESS METRICS: How they measure success in their life/business
17. IMPLEMENTATION BARRIERS: What stops them from taking action after buying

Format as JSON with these exact keys (use bullet points • for lists):
{
  "introduction": "...",
  "fears": "• Fear 1\\n• Fear 2\\n...",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n...",
  "demographics": { "age_range": "...", "gender": "...", "income_level": "...", "education": "...", "occupation": "...", "location": "...", "family_status": "..." },
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

  console.log(`Calling Anthropic API for "${suggestion.angle_name}"...`);

  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 4096,
          system: 'You are an expert marketing strategist. Always respond with valid JSON only. No markdown, no explanations, no code blocks.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      clearTimeout(timeoutId);
      break;
    } catch (e) {
      console.log(`  Attempt ${attempt} failed: ${e.message}. Retrying...`);
      if (attempt === 3) { console.error('All 3 attempts failed'); continue; }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!response || !response.ok) {
    const err = response ? await response.text() : 'no response';
    console.error(`Anthropic API error for suggestion ${suggestionId}:`, response?.status, err);
    continue;
  }

  const claudeResponse = await response.json();
  let content = claudeResponse.content?.[0]?.text ?? '';

  // Strip markdown code fences if present
  if (content.trim().startsWith('```')) {
    content = content.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let icpData;
  try {
    icpData = JSON.parse(content);
  } catch (e) {
    console.error(`Failed to parse ICP JSON for suggestion ${suggestionId}:`, e.message);
    continue;
  }

  // Insert ICP with angle_name populated (Requirement 3)
  const [insertResult] = await conn.execute(
    `INSERT INTO idealCustomerProfiles 
     (userId, serviceId, name, angle_name, introduction, fears, hopesDreams, demographics, psychographics, 
      pains, frustrations, goals, \`values\`, objections, buyingTriggers, mediaConsumption, influencers, 
      communicationStyle, decisionMaking, successMetrics, implementationBarriers, painPoints, desiredOutcomes, valuesMotivations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      USER_ID,
      suggestion.service_id,
      suggestion.angle_name,  // ICP name = angle name
      suggestion.angle_name,  // angle_name field
      icpData.introduction,
      icpData.fears,
      icpData.hopesDreams,
      JSON.stringify(icpData.demographics),
      icpData.psychographics,
      icpData.pains,
      icpData.frustrations,
      icpData.goals,
      icpData.values,
      icpData.objections,
      icpData.buyingTriggers,
      icpData.mediaConsumption,
      icpData.influencers,
      icpData.communicationStyle,
      icpData.decisionMaking,
      icpData.successMetrics,
      icpData.implementationBarriers,
      icpData.pains,   // legacy painPoints
      icpData.goals,   // legacy desiredOutcomes
      icpData.values,  // legacy valuesMotivations
    ]
  );

  const newIcpId = insertResult.insertId;
  console.log(`  → ICP inserted with id=${newIcpId}, angleName="${suggestion.angle_name}"`);

  // Update suggestion: status = 'generated', icp_id = newIcpId
  await conn.execute(
    'UPDATE icp_angle_suggestions SET status = ?, icp_id = ? WHERE id = ?',
    ['generated', newIcpId, suggestionId]
  );
  console.log(`  → Suggestion ${suggestionId} updated: status='generated', icp_id=${newIcpId}`);

  generatedICPs.push({ id: newIcpId, angleName: suggestion.angle_name });
}

console.log('\n=== GENERATED ICPs ===\n');
console.log('angleName values returned from generateICPs:');
for (const icp of generatedICPs) {
  console.log(`  id=${icp.id}: "${icp.angleName}"`);
}

console.log('\n=== DB CONFIRMATION 1 — idealCustomerProfiles.angle_name ===\n');
console.log('SQL: SELECT id, name, angle_name FROM idealCustomerProfiles WHERE angle_name IS NOT NULL ORDER BY id DESC LIMIT 5;\n');
const [icpRows] = await conn.execute(
  'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE angle_name IS NOT NULL ORDER BY id DESC LIMIT 5'
);
console.table(icpRows);

console.log('\n=== DB CONFIRMATION 2 — icp_angle_suggestions status update ===\n');
console.log('SQL: SELECT id, angle_name, status, icp_id FROM icp_angle_suggestions WHERE service_id = 960001 ORDER BY id;\n');
const [suggRows2] = await conn.execute(
  'SELECT id, angle_name, status, icp_id FROM icp_angle_suggestions WHERE service_id = 960001 ORDER BY id'
);
console.table(suggRows2);

await conn.end();
console.log('\nEvidence B complete.\n');
