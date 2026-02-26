import mysql from 'mysql2/promise';
import { renderVideo } from './server/routers/videos.ts';

const DATABASE_URL = process.env.DATABASE_URL;

console.log('=== RENDERING CRYPTO TRADER VIDEO ===\n');

(async () => {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get script 270001
    const [scripts] = await conn.execute(
      'SELECT * FROM videoScripts WHERE id = ?',
      [330002]
    );
    
    if (scripts.length === 0) {
      console.error('❌ Script 330002 not found');
      process.exit(1);
    }
    
    const script = scripts[0];
    const scenes = typeof script.scenes === 'string' ? JSON.parse(script.scenes) : script.scenes;
    console.log(`✓ Found script`);
    console.log(`  Duration: ${script.duration}s`);
    console.log(`  Scenes: ${scenes.length}\n`);
    
    // Create video record
    const [result] = await conn.execute(
      `INSERT INTO videos (
        scriptId, userId, serviceId, videoType, duration, visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [330002, 1, 870003, 'explainer', script.duration, 'kinetic_typography', 'queued', 0]
    );
    
    const videoId = result.insertId;
    console.log(`✓ Created video record: ID ${videoId}\n`);
    
    // Call renderVideo
    console.log('Starting render...\n');
    await renderVideo(videoId);
    
    // Check final status
    const [videos] = await conn.execute(
      'SELECT * FROM videos WHERE id = ?',
      [videoId]
    );
    
    const video = videos[0];
    console.log('\n=== RENDER COMPLETE ===');
    console.log(`Status: ${video.creatomateStatus}`);
    console.log(`URL: ${video.videoUrl || 'N/A'}`);
    console.log(`Duration: ${video.duration}s`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await conn.end();
  }
})();
