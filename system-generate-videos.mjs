/**
 * System-based video generation
 * Uses the existing tRPC videosRouter.generate procedure
 * This is the proper way - not standalone scripts
 */

import mysql from 'mysql2/promise';
import { videosRouter } from './server/routers/videos.ts';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== SYSTEM-BASED VIDEO GENERATION ===\n');

// Mock context for tRPC caller
const mockCtx = {
  user: { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin' },
  req: { headers: {} },
  res: {},
};

// Create tRPC caller
const caller = videosRouter.createCaller(mockCtx);

console.log('Script IDs:');
console.log('- 240007: Crypto Trader');
console.log('- 240008: ZAP');
console.log('');

// Generate Crypto Trader video
console.log('=== GENERATING CRYPTO TRADER VIDEO ===');
try {
  const result = await caller.generate({
    scriptId: 240007,
    visualStyle: 'kinetic_typography',
    brandColor: '#3B82F6',
    isZapDemo: false,
  });
  console.log('✅ Crypto Trader video queued');
  console.log('   Video ID:', result.videoId);
  console.log('   Status:', result.status);
  console.log('   Credits used:', result.creditCost);
} catch (error) {
  console.error('❌ Failed:', error.message);
}

console.log('');

// Generate ZAP video
console.log('=== GENERATING ZAP VIDEO ===');
try {
  const result = await caller.generate({
    scriptId: 240008,
    visualStyle: 'kinetic_typography',
    brandColor: '#FF6B35', // ZAP brand color
    isZapDemo: false,
  });
  console.log('✅ ZAP video queued');
  console.log('   Video ID:', result.videoId);
  console.log('   Status:', result.status);
  console.log('   Credits used:', result.creditCost);
} catch (error) {
  console.error('❌ Failed:', error.message);
}

console.log('');
console.log('=== WAITING 60 SECONDS FOR RENDERS ===');
await new Promise(resolve => setTimeout(resolve, 60000));

// Check final status
const [videos] = await conn.execute(`
  SELECT id, scriptId, creatomateStatus, videoUrl 
  FROM videos 
  WHERE scriptId IN (240007, 240008) 
  ORDER BY id DESC 
  LIMIT 2
`);

console.log('');
console.log('=== FINAL STATUS ===');
videos.forEach(v => {
  const name = v.scriptId === 240007 ? 'Crypto Trader' : 'ZAP';
  console.log(`${name} (Video ID ${v.id}):`);
  console.log(`  Status: ${v.creatomateStatus}`);
  if (v.videoUrl) {
    console.log(`  URL: ${v.videoUrl}`);
  }
});

await conn.end();
console.log('');
console.log('=== DONE ===');
