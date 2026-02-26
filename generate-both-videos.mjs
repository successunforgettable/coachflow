import mysql from 'mysql2/promise';
import { renderVideo } from './server/routers/videos.ts';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== GENERATING VIDEOS FOR CRYPTO TRADER AND ZAP ===\n');

// Get both scripts
const [scripts] = await conn.execute('SELECT * FROM videoScripts WHERE id IN (240005, 240006) ORDER BY id');

console.log('Found scripts:');
scripts.forEach(s => {
  const serviceName = s.serviceId === 870003 ? 'Crypto Trader' : 'ZAP';
  console.log(`- Script ID ${s.id}: ${serviceName} (Service ID: ${s.serviceId})`);
});

// Create video records in database
console.log('\n=== CREATING VIDEO RECORDS ===');

const [cryptoVideoResult] = await conn.execute(`
  INSERT INTO videos (
    userId, scriptId, serviceId, videoType, duration, visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
  ) VALUES (1, 240005, 870003, 'explainer', '30', 'kinetic_typography', 'queued', 1, NOW(), NOW())
`);
const cryptoVideoId = cryptoVideoResult.insertId;
console.log(`✅ Created Crypto Trader video record: ID ${cryptoVideoId}`);

const [zapVideoResult] = await conn.execute(`
  INSERT INTO videos (
    userId, scriptId, serviceId, videoType, duration, visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
  ) VALUES (1, 240006, 780001, 'explainer', '30', 'kinetic_typography', 'queued', 1, NOW(), NOW())
`);
const zapVideoId = zapVideoResult.insertId;
console.log(`✅ Created ZAP video record: ID ${zapVideoId}`);

// Parse scenes for both scripts
const cryptoScript = scripts.find(s => s.id === 240005);
const zapScript = scripts.find(s => s.id === 240006);

cryptoScript.scenes = typeof cryptoScript.scenes === 'string' ? JSON.parse(cryptoScript.scenes) : cryptoScript.scenes;
zapScript.scenes = typeof zapScript.scenes === 'string' ? JSON.parse(zapScript.scenes) : zapScript.scenes;

// Render Crypto Trader video
console.log('\n=== RENDERING CRYPTO TRADER VIDEO ===');
try {
  await renderVideo({
    videoId: cryptoVideoId,
    script: cryptoScript,
    visualStyle: 'kinetic_typography',
    brandColor: '#3B82F6',
    userId: 1,
    creditCost: 1,
    originalBalance: 100, // Dummy value
    isZapDemo: false,
  });
  console.log(`✅ Crypto Trader video rendering started (Video ID: ${cryptoVideoId})`);
} catch (error) {
  console.error('❌ Crypto Trader video failed:', error.message);
  console.error(error.stack);
}

// Render ZAP video
console.log('\n=== RENDERING ZAP VIDEO ===');
try {
  await renderVideo({
    videoId: zapVideoId,
    script: zapScript,
    visualStyle: 'kinetic_typography',
    brandColor: '#FF6B35', // ZAP brand color
    userId: 1,
    creditCost: 1,
    originalBalance: 100, // Dummy value
    isZapDemo: false,
  });
  console.log(`✅ ZAP video rendering started (Video ID: ${zapVideoId})`);
} catch (error) {
  console.error('❌ ZAP video failed:', error.message);
  console.error(error.stack);
}

// Wait a bit then check status
console.log('\n=== WAITING 30 SECONDS FOR RENDERS TO COMPLETE ===');
await new Promise(resolve => setTimeout(resolve, 30000));

// Check status
const [finalVideos] = await conn.execute(`SELECT id, creatomateStatus, videoUrl FROM videos WHERE id IN (${cryptoVideoId}, ${zapVideoId})`);
console.log('\n=== FINAL STATUS ===');
finalVideos.forEach(v => {
  console.log(`Video ID ${v.id}: ${v.creatomateStatus}`);
  if (v.videoUrl) {
    console.log(`  URL: ${v.videoUrl}`);
  }
});

await conn.end();
console.log('\n=== DONE ===');
