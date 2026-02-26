import { searchPexelsVideos } from './server/pexels.ts';

console.log('Testing Pexels API with query: crypto charts FOMO');
try {
  const results = await searchPexelsVideos('crypto charts FOMO', 'portrait', 5);
  console.log('✅ Pexels API working');
  console.log('Found', results.videos.length, 'videos');
  if (results.videos.length > 0) {
    console.log('First video:', results.videos[0].video_files[0]?.link?.substring(0, 80));
  }
} catch (error) {
  console.error('❌ Pexels API error:', error.message);
}
