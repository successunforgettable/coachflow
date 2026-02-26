import mysql from 'mysql2/promise';
import { renderVideo } from './server/routers/videos.ts';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== GENERATING VIDEOS FOR CRYPTO TRADER AND ZAP ===\n');

// Get both scripts
const [scripts] = await conn.execute('SELECT * FROM videoScripts WHERE id IN (240005, 240006) ORDER BY id');

console.log('Found scripts:');
scripts.forEach(s => {
  console.log(`- ID ${s.id}: ${s.serviceId === 870003 ? 'Crypto Trader' : 'ZAP'}`);
});

// Get user's credit balance
const [credits] = await conn.execute('SELECT * FROM videoCredits WHERE userId = 1');
console.log(`\nCredit balance: ${credits[0]?.balance || 0} credits`);

// Generate video for Crypto Trader (script 240005)
console.log('\n=== RENDERING CRYPTO TRADER VIDEO ===');
const cryptoScript = scripts.find(s => s.id === 240005);

try {
  await renderVideo({
    videoId: 999001, // Temporary ID for testing
    script: {
      ...cryptoScript,
      scenes: typeof cryptoScript.scenes === 'string' ? JSON.parse(cryptoScript.scenes) : cryptoScript.scenes
    },
    visualStyle: 'kinetic_typography',
    brandColor: '#3B82F6',
    userId: 1,
    creditCost: 1,
    originalBalance: credits[0]?.balance || 0,
    isZapDemo: false,
  });
  console.log('✅ Crypto Trader video rendering started');
} catch (error) {
  console.error('❌ Crypto Trader video failed:', error.message);
}

// Generate video for ZAP (script 240006)
console.log('\n=== RENDERING ZAP VIDEO ===');
const zapScript = scripts.find(s => s.id === 240006);

try {
  await renderVideo({
    videoId: 999002, // Temporary ID for testing
    script: {
      ...zapScript,
      scenes: typeof zapScript.scenes === 'string' ? JSON.parse(zapScript.scenes) : zapScript.scenes
    },
    visualStyle: 'kinetic_typography',
    brandColor: '#FF6B35', // ZAP brand color
    userId: 1,
    creditCost: 1,
    originalBalance: credits[0]?.balance || 0,
    isZapDemo: false,
  });
  console.log('✅ ZAP video rendering started');
} catch (error) {
  console.error('❌ ZAP video failed:', error.message);
}

await conn.end();
console.log('\n=== DONE ===');
