/**
 * Video Queue Processor
 * 
 * Processes queued videos by calling the renderVideo function.
 * This script should be run from the server context.
 */

import { getDb } from "./server/db";
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL!;

async function processVideoQueue() {
  console.log('🎬 Processing Video Queue');
  console.log('═'.repeat(80));

  const db = await getDb();
  if (!db) {
    console.error('❌ Database connection failed');
    return;
  }

  const connection = await mysql.createConnection(DATABASE_URL);

  // Get all queued videos
  const [videos] = await connection.execute(`
    SELECT 
      v.id as videoId,
      v.scriptId,
      v.visualStyle,
      v.serviceId,
      v.userId,
      v.creditsUsed,
      vs.scenes,
      vs.voiceoverText,
      vs.videoType,
      vs.duration
    FROM videos v
    JOIN videoScripts vs ON v.scriptId = vs.id
    WHERE v.creatomateStatus = 'queued'
    AND v.id IN (240001, 240002, 240003, 240004, 240005)
    ORDER BY v.id
  `) as any;

  console.log(`\n📊 Found ${videos.length} queued videos\n`);

  for (const video of videos) {
    console.log(`\n📹 Processing Video ${video.videoId}`);
    console.log('─'.repeat(80));

    try {
      // Get user's current credit balance
      const [userRows] = await connection.execute(
        'SELECT balance FROM videoCredits WHERE userId = ?',
        [video.userId]
      ) as any;

      const originalBalance = userRows[0]?.balance || 0;

      // Prepare script object
      const script = {
        id: video.scriptId,
        scenes: video.scenes,
        voiceoverText: video.voiceoverText,
        videoType: video.videoType,
        duration: video.duration,
      };

      console.log(`   Script ID: ${script.id}`);
      console.log(`   Scenes: ${script.scenes.length}`);
      console.log(`   Visual Style: ${video.visualStyle}`);
      console.log(`   Credits: ${video.creditsUsed}`);
      console.log(`   User Balance: ${originalBalance}`);

      // Import and call renderVideo
      // Note: This requires the renderVideo function to be exported from videos.ts
      console.log(`\n⚠️  Cannot call renderVideo directly - it's not exported`);
      console.log(`   Solution: Call the tRPC endpoint or export the function`);

    } catch (error: any) {
      console.error(`❌ Error processing video ${video.videoId}: ${error.message}`);
    }
  }

  await connection.end();

  console.log('\n' + '═'.repeat(80));
  console.log('\n📋 Queue Processing Complete');
  console.log('   Note: renderVideo() is not exported, so videos cannot be triggered this way.');
  console.log('   Alternative: Use the UI to manually trigger renders, or export renderVideo().');
}

processVideoQueue().catch(console.error);
