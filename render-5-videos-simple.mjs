/**
 * Simple Video Render Script
 * 
 * Renders 5 videos by directly calling renderVideo with hardcoded data.
 */

import { renderVideo } from "./server/routers/videos.js";

const videos = [
  { id: 250001, scriptId: 210001, serviceId: 840001, name: "Executive Leadership Coach" },
  { id: 250002, scriptId: 210002, serviceId: 840002, name: "Dog Reactivity Trainer" },
  { id: 250003, scriptId: 210003, serviceId: 840003, name: "Crypto Day Trader Coach" },
  { id: 250004, scriptId: 210004, serviceId: 840004, name: "Wedding Photographer Business Coach" },
  { id: 250005, scriptId: 210005, serviceId: 840005, name: "Postpartum Fitness Coach" },
];

async function main() {
  console.log('🎬 Rendering 5 Videos');
  console.log('═'.repeat(80));

  for (const video of videos) {
    console.log(`\n[${video.id}] Rendering: ${video.name}`);
    
    try {
      await renderVideo({
        videoId: video.id,
        scriptId: video.scriptId,
        serviceId: video.serviceId,
        userId: 1,
        brandColor: '#8B5CF6',
        originalBalance: 100,
        visualStyle: 'text_only',
        isZapDemo: false, // Use actual LLM-generated scripts
      });
      
      console.log(`✅ [${video.id}] Render started successfully`);
    } catch (error) {
      console.error(`❌ [${video.id}] Render failed:`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ All 5 videos submitted to Creatomate');
}

main().catch(console.error);
