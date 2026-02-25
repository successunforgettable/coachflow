// Test script to trigger video render and verify 30-second outro fix
import { createConnection } from 'mysql2/promise';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL!;

async function testVideoRender() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    console.log('🎬 Testing Video Render with 30-second outro fix...\n');
    
    // Get ZAP service and script
    const [services] = await conn.execute(
      'SELECT id, name FROM services WHERE id = 780001 LIMIT 1'
    );
    
    if (!services || (services as any[]).length === 0) {
      console.error('❌ ZAP service (ID 780001) not found');
      return;
    }
    
    const service = (services as any[])[0];
    console.log(`✅ Found service: ${service.name} (ID: ${service.id})`);
    
    // Get existing script for ZAP
    const [scripts] = await conn.execute(
      'SELECT id FROM videoScripts WHERE serviceId = 780001 ORDER BY id DESC LIMIT 1'
    );
    
    let scriptId: number;
    
    if (!scripts || (scripts as any[]).length === 0) {
      console.log('📝 No existing script found, creating new one...');
      
      // Create a new script (will use hardcoded ZAP demo script)
      const [result] = await conn.execute(
        `INSERT INTO videoScripts (userId, serviceId, videoType, duration, scenes, createdAt, updatedAt)
         VALUES (1, 780001, 'explainer', '30', '[]', NOW(), NOW())`
      );
      
      scriptId = (result as any).insertId;
      console.log(`✅ Created script ID: ${scriptId}`);
    } else {
      scriptId = (scripts as any[])[0].id;
      console.log(`✅ Using existing script ID: ${scriptId}`);
    }
    
    // Insert video record to trigger render
    console.log('\n🎥 Creating video render job...');
    const [videoResult] = await conn.execute(
      `INSERT INTO videos (
        userId, serviceId, scriptId, videoType, duration, 
        visualStyle, creatomateStatus, creditsUsed, createdAt, updatedAt
      ) VALUES (
        1, 780001, ?, 'explainer', '30',
        'text_only', 'queued', 1, NOW(), NOW()
      )`,
      [scriptId]
    );
    
    const videoId = (videoResult as any).insertId;
    console.log(`✅ Created video record ID: ${videoId}`);
    
    console.log('\n⏳ Triggering render via curl...\n');
    
    // Call the generate endpoint via curl
    const curlCommand = `curl -X POST http://localhost:3000/api/trpc/videos.generate?batch=1 \
      -H "Content-Type: application/json" \
      -d '{"0":{"json":{"scriptId":${scriptId},"visualStyle":"text_only","musicStyle":"energetic"}}}'`;
    
    try {
      const output = execSync(curlCommand, { encoding: 'utf-8', timeout: 120000 });
      console.log('Response:', output);
      
      // Parse response to get video ID
      const parsed = JSON.parse(output);
      if (parsed[0]?.result?.data?.json?.videoId) {
        const renderedVideoId = parsed[0].result.data.json.videoId;
        console.log(`\n✅ Render started for video ID: ${renderedVideoId}`);
        console.log('\n⏳ Waiting for render to complete (this may take 2-3 minutes)...');
        
        // Poll for completion
        await pollVideoStatus(conn, renderedVideoId);
      }
    } catch (error: any) {
      console.error('❌ Render failed:', error.message);
    }
    
  } finally {
    await conn.end();
  }
}

async function pollVideoStatus(conn: any, videoId: number) {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const [rows] = await conn.execute(
      'SELECT creatomateStatus, videoUrl FROM videos WHERE id = ?',
      [videoId]
    );
    
    if (rows && (rows as any[]).length > 0) {
      const video = (rows as any[])[0];
      
      if (video.creatomateStatus === 'succeeded') {
        console.log(`\n✅ Render completed!`);
        console.log(`📹 Video URL: ${video.videoUrl}`);
        
        // Download and check duration
        console.log('\n📥 Downloading video to check duration...');
        execSync(`wget -q -O /tmp/test-video-${videoId}.mp4 "${video.videoUrl}"`);
        
        const duration = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /tmp/test-video-${videoId}.mp4`,
          { encoding: 'utf-8' }
        ).trim();
        
        console.log(`\n⏱️  Video duration: ${duration} seconds`);
        
        if (parseFloat(duration) >= 29.9 && parseFloat(duration) <= 30.1) {
          console.log('✅ SUCCESS: Video is exactly 30 seconds!');
          console.log('✅ The outro fix is working correctly!');
        } else {
          console.log(`❌ FAILED: Video duration is ${duration}s instead of 30s`);
        }
        
        return;
      } else if (video.creatomateStatus === 'failed') {
        console.log('\n❌ Render failed');
        return;
      } else {
        process.stdout.write('.');
      }
    }
    
    attempts++;
  }
  
  console.log('\n⏱️  Timeout waiting for render to complete');
}

testVideoRender().catch(console.error);
