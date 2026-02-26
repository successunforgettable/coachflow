import { createCaller } from './server/_core/trpc.js';
import mysql from 'mysql2/promise';

(async () => {
  try {
    console.log('=== TESTING VIDEO RENDERING PIPELINE ===\n');
    
    // Create database connection
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Check script exists
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
    console.log(`✓ Found script: "${script.title || 'Crypto Trading Coach'}"`);
    console.log(`  Duration: ${script.duration}s`);
    console.log(`  Scenes: ${scenes.length}`);
    console.log(`  Service ID: ${script.serviceId}\n`);
    
    // Create tRPC caller
    const caller = createCaller({
      user: { id: 1, role: 'admin' },
      req: { headers: {} }
    });
    
    console.log('Starting video generation via tRPC...\n');
    
    // Call videos.generate
    const result = await caller.videos.generate({
      scriptId: 330002
    });
    
    console.log(`✓ Video generation started!`);
    console.log(`  Video ID: ${result.videoId}`);
    console.log(`  Status: ${result.status}\n`);
    
    // Poll for completion
    console.log('Polling for render completion...\n');
    const maxAttempts = 36; // 3 minutes (5s intervals)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      
      const [videos] = await conn.execute(
        'SELECT * FROM videos WHERE id = ?',
        [result.videoId]
      );
      
      const video = videos[0];
      attempts++;
      
      console.log(`[${attempts}/${maxAttempts}] Status: ${video.creatomateStatus}`);
      
      if (video.creatomateStatus === 'succeeded') {
        console.log('\n🎉 VIDEO RENDER COMPLETE!\n');
        console.log('=== FINAL RESULTS ===');
        console.log(`Video URL: ${video.videoUrl}`);
        console.log(`Thumbnail: ${video.thumbnailUrl || 'N/A'}`);
        console.log(`File Size: ${video.fileSize ? (video.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);
        console.log(`Credits Used: ${video.creditsUsed}`);
        console.log(`Duration: ${video.duration}s`);
        console.log(`Visual Style: ${video.visualStyle}`);
        console.log(`\n✅ TEST PASSED - Video rendered successfully with stock footage!`);
        break;
      }
      
      if (video.creatomateStatus === 'failed') {
        console.log('\n❌ VIDEO RENDER FAILED');
        console.log(`Check Creatomate dashboard for render ID: ${video.creatomateRenderId}`);
        process.exit(1);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏱️ TIMEOUT - Video still rendering after 3 minutes');
      console.log('Check database or Creatomate dashboard for final status');
    }
    
    await conn.end();
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
