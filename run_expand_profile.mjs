/**
 * Run expandProfile on service 900004 to populate AI fields for evidence testing
 */
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get the service
const [[service]] = await db.execute(`SELECT * FROM services WHERE id = 900004`);
if (!service) {
  console.log('Service 900004 not found');
  process.exit(1);
}

console.log(`Service: ${service.name}`);
console.log(`Target: ${service.targetCustomer}`);
console.log(`Benefit: ${service.mainBenefit}`);
console.log(`Description: ${service.description}`);

// Call the expandProfile via the LLM API directly
const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!apiUrl || !apiKey) {
  console.log('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

const prompt = `You are a direct response marketing expert. Given this service, generate a comprehensive marketing profile.

Service Name: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Description: ${service.description}

Generate a JSON object with EXACTLY these 10 fields:
{
  "avatarName": "A realistic first name for the ideal customer (e.g., Sarah)",
  "avatarTitle": "Their job title or life role (e.g., Corporate Manager)",
  "painPoints": "2-3 sentences describing their daily frustrations and pain points",
  "whyProblemExists": "1-2 sentences explaining the root cause of their problem",
  "falseBeliefsVsRealReasons": "2-3 sentences about what they think is stopping them vs the real reason",
  "failedSolutions": "2-3 sentences about what they've already tried that didn't work",
  "hiddenReasons": "1-2 sentences about the deeper emotional reason they want this transformation",
  "riskReversal": "1-2 sentences about what guarantee or proof would make them feel safe to buy",
  "uniqueMechanismSuggestion": "A creative name for the proprietary method/system (e.g., The 5-Step Clarity Framework)",
  "hvcoTopic": "A compelling free guide title that would attract this avatar (e.g., The 7 Mistakes Coaches Make)"
}

Return ONLY valid JSON, no markdown, no explanation.`;

const response = await fetch(`${apiUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'system', content: 'You are a direct response marketing expert. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1000,
  }),
});

const data = await response.json();
const content = data.choices?.[0]?.message?.content;
if (!content) {
  console.log('No content from LLM:', JSON.stringify(data));
  process.exit(1);
}

console.log('\nLLM Response:');
console.log(content.substring(0, 200) + '...');

let parsed;
try {
  parsed = JSON.parse(content);
} catch (e) {
  // Try stripping markdown
  const stripped = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  parsed = JSON.parse(stripped);
}

console.log('\nParsed fields:');
Object.entries(parsed).forEach(([k, v]) => console.log(`  ${k}: ${String(v).substring(0, 60)}...`));

// Update the service
await db.execute(
  `UPDATE services SET 
    avatarName = ?, avatarTitle = ?, painPoints = ?, whyProblemExists = ?,
    falseBeliefsVsRealReasons = ?, failedSolutions = ?, hiddenReasons = ?,
    riskReversal = ?, uniqueMechanismSuggestion = ?, hvcoTopic = ?
   WHERE id = 900004`,
  [
    parsed.avatarName, parsed.avatarTitle, parsed.painPoints, parsed.whyProblemExists,
    parsed.falseBeliefsVsRealReasons, parsed.failedSolutions, parsed.hiddenReasons,
    parsed.riskReversal, parsed.uniqueMechanismSuggestion, parsed.hvcoTopic,
  ]
);

console.log('\n✅ Service 900004 updated with AI-expanded fields');
await db.end();
