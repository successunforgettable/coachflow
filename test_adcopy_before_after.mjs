/**
 * Item 1.2 Fix — Before/After Ad Copy Evidence Test
 * Uses exact Incredible You inputs from the rejection document.
 * Run 1: No ICP — icpContext is empty string
 * Run 2: With ICP — icpContext contains the exact ICP values specified
 */

import { config } from 'dotenv';
config({ path: '/home/ubuntu/coachflow/.env' });

const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!LLM_URL || !LLM_KEY) {
  console.error('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

async function invokeLLM(messages) {
  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({ messages, model: 'claude-3-5-haiku-20241022' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// Exact service inputs from rejection document
const service = {
  name: 'Incredible You Coach Training',
  targetCustomer: 'Aspiring coaches aged 30-55 who want a science-backed methodology',
  mainBenefit: 'Become a certified coach with a proprietary protocol that produces measurable results',
};

// Exact ICP values from rejection document
const icpValues = {
  pains: 'Clients achieve short-term results but relapse within 90 days. Difficulty justifying premium pricing without a proprietary system. Imposter syndrome when competing against coaches with larger audiences.',
  fears: 'Being seen as just another life coach with no real differentiation. Clients not getting lasting results and asking for refunds. Not being taken seriously by corporate clients.',
  objections: 'Is this just another NLP rehash? Will my existing clients notice a difference? Can I afford the investment while my practice is still growing?',
  buyingTriggers: 'Seeing a peer charge 3x more after certification. A client relapse that shakes confidence in current methods. Attending a live event where the protocol is demonstrated with measurable HRV data.',
  communicationStyle: 'Prefers direct, evidence-backed communication. Responds to stories of transformation with measurable outcomes. Dislikes hype and income guarantees.',
};

function buildBodyPrompt(icpContext) {
  return `You are an expert Facebook ad copywriter specializing in direct response advertising.

Service: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
${icpContext ? `\n${icpContext}\n` : ''}
Write 2 Facebook ad body copy variations (150-200 words each).

Each variation must:
- Open with a hook that speaks directly to the target customer's situation
- Build desire for the main benefit
- Include a clear call to action
- Use conversational, direct language

Return ONLY a JSON array of 2 strings (the body copy variations), nothing else.`;
}

// Build ICP context string (mirrors server code exactly)
const icpContextParts = [
  'IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:',
  `Their daily pains: ${icpValues.pains}`,
  `Their deep fears: ${icpValues.fears}`,
  `Their objections to buying: ${icpValues.objections}`,
  `What makes them buy: ${icpValues.buyingTriggers}`,
  `How they communicate: ${icpValues.communicationStyle}`,
];
const icpContext = icpContextParts.join('\n').trim();

console.log('=== ITEM 1.2 — BEFORE/AFTER AD COPY EVIDENCE ===\n');
console.log('Service: Incredible You Coach Training');
console.log('Test: 2 body copy variations from Run 1 (no ICP) and 2 from Run 2 (with ICP)\n');
console.log('Running Run 1 (no ICP)...');

let run1Variations, run2Variations;

try {
  const run1Raw = await invokeLLM([
    { role: 'system', content: 'You are a direct response copywriting expert. Return ONLY valid JSON arrays.' },
    { role: 'user', content: buildBodyPrompt('') },
  ]);
  run1Variations = JSON.parse(run1Raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  console.log('Run 1 complete.\n');
} catch (e) {
  console.error('Run 1 failed:', e.message);
  process.exit(1);
}

console.log('Running Run 2 (with ICP)...');
try {
  const run2Raw = await invokeLLM([
    { role: 'system', content: 'You are a direct response copywriting expert. Return ONLY valid JSON arrays.' },
    { role: 'user', content: buildBodyPrompt(icpContext) },
  ]);
  run2Variations = JSON.parse(run2Raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  console.log('Run 2 complete.\n');
} catch (e) {
  console.error('Run 2 failed:', e.message);
  process.exit(1);
}

console.log('━'.repeat(70));
console.log('RUN 1 — NO ICP (generic copy)');
console.log('━'.repeat(70));
console.log('\nVariation 1:');
console.log(run1Variations[0]);
console.log('\nVariation 2:');
console.log(run1Variations[1]);

console.log('\n' + '━'.repeat(70));
console.log('RUN 2 — WITH ICP (Incredible You avatar data injected)');
console.log('━'.repeat(70));
console.log('\nVariation 1:');
console.log(run2Variations[0]);
console.log('\nVariation 2:');
console.log(run2Variations[1]);

console.log('\n' + '━'.repeat(70));
console.log('ICP SIGNAL CHECK — Run 2 must contain at least one of these phrases:');
const signals = ['relapse', 'imposter', 'premium pricing', 'HRV', 'differentiat', 'proprietary', 'refund', 'corporate'];
const run2Combined = (run2Variations[0] + ' ' + run2Variations[1]).toLowerCase();
const run1Combined = (run1Variations[0] + ' ' + run1Variations[1]).toLowerCase();
let signalsFound = 0;
for (const signal of signals) {
  const inRun2 = run2Combined.includes(signal.toLowerCase());
  const inRun1 = run1Combined.includes(signal.toLowerCase());
  if (inRun2) signalsFound++;
  console.log(`  "${signal}": Run1=${inRun1 ? 'YES' : 'no'} Run2=${inRun2 ? 'YES' : 'no'}`);
}
console.log(`\nICP signals found in Run 2: ${signalsFound}/${signals.length}`);
console.log(signalsFound >= 2 ? 'PASS: Run 2 contains ICP-specific language that Run 1 cannot produce' : 'FAIL: Run 2 does not show clear ICP influence');
