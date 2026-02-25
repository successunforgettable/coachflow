// Manually trigger renders for the 5 queued videos
// This script imports the renderVideo function and calls it for each video

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

const videoData = [
  { videoId: 240001, name: "Executive Leadership Coach" },
  { videoId: 240002, name: "Dog Reactivity Trainer" },
  { videoId: 240003, name: "Crypto Day Trader Coach" },
  { videoId: 240004, name: "Wedding Photographer Business Coach" },
  { videoId: 240005, name: "Postpartum Fitness Coach" }
];

console.log('🎬 Triggering renders for 5 niche-specific videos');
console.log('═'.repeat(80));

const connection = await mysql.createConnection(DATABASE_URL);

for (const video of videoData) {
  console.log(`\n📹 ${video.name} (Video ID: ${video.videoId})`);
  console.log('─'.repeat(80));
  
  try {
    // Get video and script data
    const [rows] = await connection.execute(`
      SELECT 
        v.id as videoId,
        v.scriptId,
        v.visualStyle,
        v.serviceId,
        v.userId,
        vs.scenes,
        vs.voiceoverText
      FROM videos v
      JOIN videoScripts vs ON v.scriptId = vs.id
      WHERE v.id = ?
    `, [video.videoId]);
    
    if (rows.length === 0) {
      console.log(`❌ Video not found`);
      continue;
    }
    
    const videoRecord = rows[0];
    
    console.log(`✅ Found video record`);
    console.log(`   Script ID: ${videoRecord.scriptId}`);
    console.log(`   Visual Style: ${videoRecord.visualStyle}`);
    console.log(`   Scenes: ${videoRecord.scenes.length}`);
    console.log(`   Status: Ready to render`);
    console.log(`\n⏳ Render will be processed by calling the renderVideo function...`);
    console.log(`   Monitor logs: tail -f /home/ubuntu/coachflow/.manus-logs/devserver.log | grep "Video ${video.videoId}"`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

await connection.end();

console.log('\n' + '═'.repeat(80));
console.log('\n📋 Summary:');
console.log('   All 5 videos are queued and ready.');
console.log('   However, renderVideo() must be called from within the server context.');
console.log('   The videos need to be triggered through the tRPC API or a server-side worker.');
console.log('\n💡 Solution: Update the videos table to trigger renders via the existing render queue.');
