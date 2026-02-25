/**
 * Test voiceover generation and S3 upload
 */

import { generateVoiceover, VOICE_IDS } from './server/elevenlabs.js';
import { storagePut } from './server/storage.js';

async function testVoiceover() {
  console.log('=== TEST 1: Voiceover Generation ===\n');
  
  const testText = "Stop wasting money on ads that get no results. You've tried Facebook ads before and got burned. What if you could launch a full Meta campaign today without hiring an agency?";
  
  console.log('1. Generating voiceover with ElevenLabs...');
  console.log(`   Text: "${testText}"`);
  console.log(`   Voice: Charlie (${VOICE_IDS.charlie})`);
  
  const voiceoverBuffer = await generateVoiceover({
    text: testText,
    voiceId: VOICE_IDS.charlie,
  });
  
  console.log(`✓ Generated: ${voiceoverBuffer.length} bytes\n`);
  
  console.log('2. Uploading to S3...');
  const { url: voiceoverUrl } = await storagePut(
    'test-voiceover.mp3',
    voiceoverBuffer,
    'audio/mpeg'
  );
  
  console.log(`✓ Uploaded successfully\n`);
  console.log('=== VOICEOVER URL ===');
  console.log(voiceoverUrl);
  console.log('\n⚠️  OPEN THIS URL IN YOUR BROWSER TO VERIFY IT PLAYS AUDIO\n');
  
  return voiceoverUrl;
}

testVoiceover().catch(console.error);
