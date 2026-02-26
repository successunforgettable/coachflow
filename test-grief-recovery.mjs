import mysql from 'mysql2/promise';
import { buildScriptPrompt } from './server/routers/videoScripts.ts';
import { invokeLLM } from './server/_core/llm.ts';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get the Grief Recovery service
const [services] = await conn.execute('SELECT * FROM services WHERE id = 870002');
const service = services[0];

console.log('=== GENERATING SCRIPT FOR GRIEF RECOVERY ===');
console.log('Service:', service.name);
console.log('Target:', service.targetCustomer);
console.log('Problem:', service.whyProblemExists);
console.log('');

// Build the prompt
const prompt = buildScriptPrompt('explainer', 30, service);

// Call LLM
console.log('Calling LLM...');
const response = await invokeLLM({
  messages: [{ role: 'user', content: prompt }]
});

let content = response.choices[0].message.content;
// Remove markdown code blocks if present
if (content.includes('```')) {
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
}
const scriptData = JSON.parse(content);

console.log('');
console.log('=== GENERATED SCRIPT ===');
scriptData.scenes.forEach(scene => {
  console.log(`\nScene ${scene.sceneNumber} (${scene.duration}s):`);
  console.log('Voiceover:', scene.voiceoverText);
  console.log('On-screen:', scene.onScreenText);
});

// Save to database
const voiceoverText = scriptData.scenes.map(s => s.voiceoverText).join(' ');
const [result] = await conn.execute(`
  INSERT INTO videoScripts (
    userId, serviceId, videoType, duration, scenes, voiceoverText, status, createdAt, updatedAt
  ) VALUES (1, 870002, 'explainer', '30', ?, ?, 'approved', NOW(), NOW())
`, [JSON.stringify(scriptData.scenes), voiceoverText]);

console.log('');
console.log('✅ Script saved with ID:', result.insertId);

await conn.end();
