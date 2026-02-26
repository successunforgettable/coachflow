import { videosRouter } from './server/routers/videos.ts';

console.log('=== REGENERATING CRYPTO TRADER VIDEO WITH FIXED TEMPLATE ===\n');

// Mock context for tRPC caller
const mockCtx = {
  user: { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin' },
  req: { headers: {} },
  res: {},
};

// Create tRPC caller
const caller = videosRouter.createCaller(mockCtx);

console.log('Generating Crypto Trader video...');
console.log('Script ID: 240007');
console.log('Template: kinetic_typography (FIXED - black background removed)');
console.log('');

try {
  const result = await caller.generate({
    scriptId: 240007,
    visualStyle: 'kinetic_typography',
    brandColor: '#3B82F6',
    isZapDemo: false,
  });
  
  console.log('✅ Video queued successfully');
  console.log('Video ID:', result.videoId);
  console.log('Status:', result.status);
  console.log('Credits used:', result.creditCost);
  console.log('');
  console.log('Waiting 60 seconds for render to complete...');
  
  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // Check status
  const video = await caller.getById({ videoId: result.videoId });
  console.log('');
  console.log('=== FINAL STATUS ===');
  console.log('Status:', video.creatomateStatus);
  if (video.videoUrl) {
    console.log('Video URL:', video.videoUrl);
    console.log('');
    console.log('✅ VIDEO READY - Please verify it has stock footage from Pexels');
  } else if (video.creatomateStatus === 'failed') {
    console.log('❌ Render failed');
  } else {
    console.log('⏳ Still rendering...');
  }
  
} catch (error) {
  console.error('❌ Failed:', error.message);
}
