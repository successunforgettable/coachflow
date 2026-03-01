/**
 * Evidence B — Retry suggestion ID 4 (Corporate Escapee Seeking Purpose)
 * Uses a shorter prompt to avoid token truncation
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [suggRows] = await conn.execute('SELECT * FROM icp_angle_suggestions WHERE id = 4 LIMIT 1');
const suggestion = suggRows[0];
const [svcRows] = await conn.execute('SELECT * FROM services WHERE id = ? LIMIT 1', [suggestion.service_id]);
const service = svcRows[0];

console.log(`Generating ICP for: "${suggestion.angle_name}"`);

const prompt = `Create a detailed Ideal Customer Profile (ICP) for this coaching service.

Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

AUDIENCE ANGLE TO FOCUS ON:
Angle: ${suggestion.angle_name}
Who: ${suggestion.description}
Primary Pain: ${suggestion.primary_pain}
Buying Trigger: ${suggestion.primary_buying_trigger}

Return JSON with these keys only:
{
  "introduction": "2-3 paragraphs about who this person is",
  "fears": "• Fear 1\\n• Fear 2\\n• Fear 3\\n• Fear 4\\n• Fear 5",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n• Dream 3\\n• Dream 4\\n• Dream 5",
  "demographics": {"age_range": "...", "gender": "...", "income_level": "...", "education": "...", "occupation": "...", "location": "...", "family_status": "..."},
  "psychographics": "2-3 paragraphs about personality and lifestyle",
  "pains": "• Pain 1\\n• Pain 2\\n• Pain 3\\n• Pain 4\\n• Pain 5\\n• Pain 6\\n• Pain 7",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n• Frustration 3\\n• Frustration 4\\n• Frustration 5",
  "goals": "• Goal 1\\n• Goal 2\\n• Goal 3\\n• Goal 4\\n• Goal 5\\n• Goal 6",
  "values": "• Value 1\\n• Value 2\\n• Value 3\\n• Value 4\\n• Value 5",
  "objections": "• Objection 1\\n• Objection 2\\n• Objection 3\\n• Objection 4\\n• Objection 5",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n• Trigger 3\\n• Trigger 4\\n• Trigger 5",
  "mediaConsumption": "Platforms and content formats they use",
  "influencers": "Who they follow and trust",
  "communicationStyle": "How they prefer to communicate",
  "decisionMaking": "How they make purchasing decisions",
  "successMetrics": "How they measure success",
  "implementationBarriers": "What stops them from taking action"
}

Valid JSON only. No markdown.`;

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000);

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  signal: controller.signal,
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    system: 'You are an expert marketing strategist. Always respond with valid JSON only. No markdown.',
    messages: [{ role: 'user', content: prompt }],
  }),
});
clearTimeout(timeoutId);

if (!response.ok) {
  const err = await response.text();
  console.error('API error:', response.status, err);
  process.exit(1);
}

const claudeResponse = await response.json();
let content = claudeResponse.content?.[0]?.text ?? '';
if (content.trim().startsWith('```')) {
  content = content.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
}

let icpData;
try {
  icpData = JSON.parse(content);
} catch (e) {
  console.error('JSON parse failed:', e.message);
  console.error('Content length:', content.length);
  console.error('Last 200 chars:', content.slice(-200));
  process.exit(1);
}

console.log('ICP generated successfully. Inserting...');

const [insertResult] = await conn.execute(
  `INSERT INTO idealCustomerProfiles 
   (userId, serviceId, name, angle_name, introduction, fears, hopesDreams, demographics, psychographics, 
    pains, frustrations, goals, \`values\`, objections, buyingTriggers, mediaConsumption, influencers, 
    communicationStyle, decisionMaking, successMetrics, implementationBarriers, painPoints, desiredOutcomes, valuesMotivations)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    1, suggestion.service_id,
    suggestion.angle_name, suggestion.angle_name,
    icpData.introduction, icpData.fears, icpData.hopesDreams,
    JSON.stringify(icpData.demographics), icpData.psychographics,
    icpData.pains, icpData.frustrations, icpData.goals, icpData.values,
    icpData.objections, icpData.buyingTriggers, icpData.mediaConsumption,
    icpData.influencers, icpData.communicationStyle, icpData.decisionMaking,
    icpData.successMetrics, icpData.implementationBarriers,
    icpData.pains, icpData.goals, icpData.values,
  ]
);

const newIcpId = insertResult.insertId;
console.log(`ICP inserted: id=${newIcpId}, angleName="${suggestion.angle_name}"`);

await conn.execute(
  'UPDATE icp_angle_suggestions SET status = ?, icp_id = ? WHERE id = 4',
  ['generated', newIcpId]
);
console.log(`Suggestion 4 updated: status='generated', icp_id=${newIcpId}`);

console.log('\n=== FINAL DB CONFIRMATION 1 — idealCustomerProfiles.angle_name ===');
console.log('SQL: SELECT id, name, angle_name FROM idealCustomerProfiles WHERE angle_name IS NOT NULL ORDER BY id DESC LIMIT 5;\n');
const [icpRows] = await conn.execute(
  'SELECT id, name, angle_name FROM idealCustomerProfiles WHERE angle_name IS NOT NULL ORDER BY id DESC LIMIT 5'
);
console.table(icpRows);

console.log('\n=== FINAL DB CONFIRMATION 2 — icp_angle_suggestions ===');
console.log('SQL: SELECT id, angle_name, status, icp_id FROM icp_angle_suggestions WHERE service_id = 960001 ORDER BY id;\n');
const [suggRows2] = await conn.execute(
  'SELECT id, angle_name, status, icp_id FROM icp_angle_suggestions WHERE service_id = 960001 ORDER BY id'
);
console.table(suggRows2);

await conn.end();
console.log('\nEvidence B retry complete.\n');
