// Test script to generate ZAP demo video with hardcoded script
import { getDb } from "./server/db.js";
import { videoScripts } from "./drizzle/schema.js";
import { ZAP_DEMO_SCRIPT, ZAP_DEMO_VOICEOVER } from "./server/zapDemoScript.js";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  // Create a dummy script record for ZAP demo
  const [scriptRecord] = await db.insert(videoScripts).values({
    userId: 1, // Owner user ID
    serviceId: 1, // ZAP service ID
    campaignId: null,
    videoType: "explainer",
    duration: "30",
    visualStyle: "text_only",
    scenes: ZAP_DEMO_SCRIPT.scenes,
    voiceoverText: ZAP_DEMO_VOICEOVER,
    status: "draft",
  });

  const scriptId = scriptRecord.insertId;
  console.log(`✅ Created ZAP demo script: ID ${scriptId}`);
  console.log(`\n📝 Script has ${ZAP_DEMO_SCRIPT.scenes.length} scenes:`);
  ZAP_DEMO_SCRIPT.scenes.forEach((scene, i) => {
    console.log(`   Scene ${i + 1} (${scene.duration}s): "${scene.onScreenText}"`);
    console.log(`   Pexels: "${scene.pexelsQuery}"`);
  });

  console.log(`\n🎬 Now generate video in UI:`);
  console.log(`   1. Go to Video Creator`);
  console.log(`   2. Load script ID: ${scriptId}`);
  console.log(`   3. Click Generate Video with isZapDemo=true flag`);
  console.log(`\nOr call API directly:`);
  console.log(`   POST /api/trpc/videos.generate`);
  console.log(`   { scriptId: ${scriptId}, visualStyle: "text_only", isZapDemo: true }`);

  process.exit(0);
}

main().catch(console.error);
