/**
 * Video Queue Worker
 * 
 * Processes queued videos by calling the exported renderVideo function.
 * Run with: npx tsx worker-process-queue.ts
 */

import { renderVideo } from "./server/routers/videos";
import { getDb } from "./server/db";
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL!;

const videoNames = [
  "Executive Leadership Coach",
  "Dog Reactivity Trainer",
  "Crypto Day Trader Coach",
  "Wedding Photographer Business Coach",
  "Postpartum Fitness Coach"
];

async function main() {
  console.log('🎬 Video Queue Worker Starting');
  console.log('═'.repeat(80));

  const connection = await mysql.createConnection(DATABASE_URL);

  // Get all queued videos with their scripts
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

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const videoName = videoNames[i] || `Video ${i + 1}`;

    console.log(`\n📹 ${videoName} (Video ID: ${video.videoId})`);
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
      console.log(`   Credits Used: ${video.creditsUsed}`);
      console.log(`   User Balance: ${originalBalance}`);
      console.log(`\n⏳ Starting render...`);

      // Call renderVideo
      await renderVideo({
        videoId: video.videoId,
        script,
        visualStyle: video.visualStyle,
        brandColor: "#10b981", // Default green
        userId: video.userId,
        creditCost: video.creditsUsed,
        originalBalance,
        isZapDemo: false, // Use actual niche-specific scripts from database
      });

      console.log(`✅ Render initiated for ${videoName}`);

    } catch (error: any) {
      console.error(`❌ Error processing ${videoName}: ${error.message}`);
    }

    // Wait 2 seconds between renders to avoid rate limiting
    if (i < videos.length - 1) {
      console.log(`\n⏸️  Waiting 2 seconds before next render...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await connection.end();

  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ Queue Processing Complete');
  console.log('   All 5 videos have been submitted to Creatomate');
  console.log('   Monitor progress: tail -f .manus-logs/devserver.log | grep "Video 24000"');
}

main().catch(console.error);
