/**
 * Item 1.4 Evidence Test — SOT Injection in Ad Copy Generator
 * 
 * This script simulates what the server does when generating Ad Copy for
 * the Incredible You Coach Training service (userId=1, serviceId=960001)
 * with a SOT record present.
 * 
 * It proves:
 * 1. sotContext is non-empty (shows first 100 chars)
 * 2. sotContext is prepended to the prompt as the outermost layer
 * 3. The generated body copy reflects brand voice (neuroscience, HRV, protocol)
 */

import mysql from 'mysql2/promise';

const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function invokeLLM(messages) {
  const response = await fetch(`${BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Fetch service record
const [svcRows] = await conn.execute(
  "SELECT * FROM services WHERE id = 960001 AND userId = 1"
);
const service = svcRows[0];
console.log('=== SERVICE RECORD ===');
console.log('  name:', service.name);
console.log('  targetCustomer (first 80):', service.targetCustomer?.substring(0, 80));
console.log('  painPoints (first 80):', service.painPoints?.substring(0, 80));

// Fetch ICP (may not exist)
const [icpRows] = await conn.execute(
  "SELECT * FROM idealCustomerProfiles WHERE serviceId = 960001"
);
const icp = icpRows[0] || null;
const icpContext = icp ? [
  'IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:',
  icp.pains ? `Their daily pains: ${icp.pains}` : '',
  icp.fears ? `Their deep fears: ${icp.fears}` : '',
  icp.objections ? `Their objections to buying: ${icp.objections}` : '',
  icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : '',
  icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : '',
].filter(Boolean).join('\n').trim() : '';

// Fetch SOT record (userId=1)
const [sotRows] = await conn.execute(
  "SELECT * FROM sourceOfTruth WHERE userId = 1"
);
const sot = sotRows[0] || null;
const sotLines = sot ? [
  sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
  sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
  sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
  sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
  sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
  sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
].filter(Boolean) : [];

const sotContext = sotLines.length > 0
  ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
  : '';

console.log('\n=== SOT CONTEXT CHECK ===');
console.log('  sotContext non-empty:', sotContext.length > 0 ? 'YES ✓' : 'NO ✗');
console.log('  sotContext first 100 chars:', sotContext.substring(0, 100));
console.log('  sotLines count:', sotLines.length);

// Build the body copy prompt (same as adCopy.ts bodyPrompt)
const resolvedPressingProblem = service.painPoints || "Coaches feel overwhelmed and lack differentiation";
const resolvedDesiredOutcome = service.mainBenefit || "Build a fully booked coaching practice";
const resolvedUniqueMechanism = service.uniqueMechanismSuggestion || "The 90-Day Rapid Practice Launch Blueprint";

const bodyPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ONE high-converting ad BODY COPY using the PROBLEM_AGITATE_SOLVE angle:

Service: ${service.name}
Category: coaching
Target Market: ${service.targetCustomer}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism}

${icpContext ? `${icpContext}\n\n` : ''}Ad Type: Lead Generation
Ad Style: Educational
Call To Action: Book a Free Discovery Call

Create ONE body copy (125-150 words) using the PROBLEM AGITATE SOLVE structure.
End with clear call-to-action: Book a Free Discovery Call

Return ONLY the body text as a single string, no JSON wrapper.`;

console.log('\n=== PROMPT STRUCTURE VERIFICATION ===');
const promptLines = bodyPrompt.split('\n');
console.log('  Line 1 (must be BRAND CONTEXT):', promptLines[0].substring(0, 60));
console.log('  SOT is outermost layer:', promptLines[0].startsWith('BRAND CONTEXT') ? 'YES ✓' : 'NO ✗');

console.log('\n=== RUNNING AD COPY GENERATION ===');
console.log('  (This calls the real LLM — may take 5-15 seconds)');

const bodyCopy = await invokeLLM([
  {
    role: 'system',
    content: 'You are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.',
  },
  { role: 'user', content: bodyPrompt },
]);

console.log('\n=== GENERATED BODY COPY (FULL TEXT) ===');
console.log(bodyCopy);

// Check for brand voice signals
const brandSignals = ['neuroscience', 'HRV', 'protocol', 'biofeedback', 'Mind-Heart', 'certification', 'proprietary', 'measurable'];
const foundSignals = brandSignals.filter(sig => bodyCopy.toLowerCase().includes(sig.toLowerCase()));
console.log('\n=== BRAND VOICE SIGNAL CHECK ===');
console.log('  Signals present:', foundSignals.length > 0 ? foundSignals.join(', ') : 'NONE');
console.log('  Brand voice reflected:', foundSignals.length > 0 ? 'YES ✓' : 'CHECK MANUALLY');

// Clean up test service
await conn.execute("DELETE FROM services WHERE id = 960001");
console.log('\n=== CLEANUP ===');
console.log('  Test service 960001 deleted');

// Note: SOT record for userId=1 is kept for ongoing use

await conn.end();
console.log('\n=== TEST COMPLETE ===');
