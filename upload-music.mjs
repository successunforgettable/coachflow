/**
 * Upload background music to S3
 * Run once to get permanent music URL
 */

import { readFileSync } from 'fs';
import { storagePut } from './server/storage.js';

async function uploadMusic() {
  console.log('Reading music file...');
  const musicBuffer = readFileSync('/tmp/background-music.mp3');
  
  console.log(`Uploading ${musicBuffer.length} bytes to S3...`);
  const result = await storagePut(
    'video-assets/background-music.mp3',
    musicBuffer,
    'audio/mpeg'
  );
  
  console.log('✅ Upload complete!');
  console.log('Music URL:', result.url);
  console.log('\nTest this URL in your browser before using it in videos.');
  
  return result.url;
}

uploadMusic().catch(console.error);
