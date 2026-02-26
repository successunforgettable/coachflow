import mysql from 'mysql2/promise';
import { renderVideo } from './server/routers/videos.js';

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('=== VIDEO RENDERING TEST ===\n');
    
    // Verify script exists
    const [scripts] = await conn.execute(
      'SELECT * FROM videoScripts WHERE id = ?',
      [330002]
    );
    
    if (scripts.length === 0) {
      console.error('❌ Script 330002 not found');
      process.exit(1);
    }
    
    const script = scripts[0];
    console.log(`✓ Script found: ${script.duration}s, Service ID: ${script.serviceId}\n`);
    
    // Create video record
    const [result] = await conn.execute(
      `INSERT INTO videos (
        scriptId, userId, serviceId, videoType, duration, 
        visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [330002, 1, script.serviceId, 'explainer', script.duration, 'kinetic_typography', 'queued', 0]
    );
    
    const videoId = result.insertId;
    console.log(`✓ Video record created: ID ${videoId}\n`);
    console.log('Starting render...\n');
    
    // Parse scenes
    const scenes = typeof script.scenes === 'string' ? JSON.parse(script.scenes) : script.scenes;
    
    // Render video with all required params
    await renderVideo({
      videoId,
      script: { ...script, scenes },
      visualStyle: 'kinetic_typography',
      brandColor: '#8B5CF6',
      userId: 1,
      creditCost: 1,
      originalBalance: 10,
      isZapDemo: false
    });
    
    // Poll for completion
    console.log('\nPolling for completion...\n');
    const maxAttempts = 36;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      
      const [videos] = await conn.execute('SELECT * FROM videos WHERE id = ?', [videoId]);
      const video = videos[0];
      attempts++;
      
      console.log(`[${attempts}/36] Status: ${video.creatomateStatus}`);
      
      if (video.creatomateStatus === 'succeeded') {
        console.log('\n🎉 SUCCESS!\n');
        console.log('Video URL:', video.videoUrl);
        console.log('Duration:', video.duration + 's');
        console.log('File Size:', (video.fileSize / 1024 / 1024).toFixed(2) + ' MB');
        console.log('\n✅ TEST PASSED');
        break;
      }
      
      if (video.creatomateStatus === 'failed') {
        console.log('\n❌ RENDER FAILED');
        process.exit(1);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏱️ TIMEOUT');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await conn.end();
  }
})();
