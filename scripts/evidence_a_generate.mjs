/**
 * Evidence A — Angle Suggestion Generation
 * Calls the exact same logic as icpAngleSuggestions.generate
 * Service: Incredible You Coach Training (id=960001, userId=1)
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

const SERVICE_ID = 960001;
const USER_ID = 1;

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Fetch service
const [rows] = await conn.execute(
  'SELECT * FROM services WHERE id = ? AND userId = ? LIMIT 1',
  [SERVICE_ID, USER_ID]
);
const service = rows[0];
if (!service) { console.error('Service not found'); process.exit(1); }

console.log(`\nService: "${service.name}" (id=${service.id})\n`);

// Build prompt (verbatim from router)
const prompt = `You are a world-class market research strategist for coaches and consultants.

A coach/consultant has created this service:
Name: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Points: ${service.painPoints || "Not specified"}
Why Problem Exists: ${service.whyProblemExists || "Not specified"}
Unique Mechanism: ${service.uniqueMechanismSuggestion || "Not specified"}

Your task: Identify 10 distinct audience segments that could benefit from this service.
Each segment must be genuinely different — different demographics, different situations,
different primary pains, different reasons for buying.

Do not generate variations of the same person. Each of the 10 must be a meaningfully
different type of buyer.

Return a JSON array of exactly 10 objects with these exact fields:
[
  {
    "angleName": "4-6 word label for this audience segment",
    "description": "One sentence describing who this person is and their situation",
    "primaryPain": "The single most powerful pain this person feels that this service solves",
    "primaryBuyingTrigger": "The single event or realisation that would make this person buy now"
  }
]

Return valid JSON only. No markdown. No explanation.`;

console.log('Calling Anthropic API...\n');

// Call Anthropic directly (same path as invokeLLM when ANTHROPIC_API_KEY is set)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: 'You are a world-class market research strategist. Always respond with valid JSON only.\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanations, no code blocks.',
    messages: [{ role: 'user', content: prompt }],
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error('Anthropic API error:', response.status, err);
  process.exit(1);
}

const claudeResponse = await response.json();
const content = claudeResponse.content?.[0]?.text ?? '';

let suggestions = [];
try {
  // Strip markdown code fences if present
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  const parsed = JSON.parse(cleanContent);
  if (Array.isArray(parsed)) {
    suggestions = parsed;
  } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
    suggestions = parsed.suggestions;
  }
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  console.error('Raw content:', content.substring(0, 500));
  process.exit(1);
}

console.log(`LLM returned ${suggestions.length} suggestions.\n`);
console.log('=== FULL JSON ARRAY ===\n');
console.log(JSON.stringify(suggestions, null, 2));

// Delete existing suggestions for this service+user
await conn.execute(
  'DELETE FROM icp_angle_suggestions WHERE service_id = ? AND user_id = ?',
  [SERVICE_ID, USER_ID]
);

// Insert new suggestions (handle LLM typo: primaryBayingTrigger vs primaryBuyingTrigger)
for (const s of suggestions) {
  const trigger = s.primaryBuyingTrigger || s.primaryBayingTrigger || '';
  await conn.execute(
    `INSERT INTO icp_angle_suggestions (service_id, user_id, angle_name, description, primary_pain, primary_buying_trigger, status)
     VALUES (?, ?, ?, ?, ?, ?, 'suggested')`,
    [SERVICE_ID, USER_ID, s.angleName, s.description, s.primaryPain, trigger]
  );
}

console.log('\n=== DATABASE CONFIRMATION ===\n');
console.log('SQL: SELECT id, angle_name, status FROM icp_angle_suggestions WHERE service_id = 960001 ORDER BY id;\n');

const [dbRows] = await conn.execute(
  'SELECT id, angle_name, status FROM icp_angle_suggestions WHERE service_id = ? ORDER BY id',
  [SERVICE_ID]
);
console.table(dbRows);
console.log(`Total rows: ${dbRows.length}`);

await conn.end();
