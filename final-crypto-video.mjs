import { videosRouter } from './server/routers/videos.ts';

console.log('=== GENERATING CRYPTO TRADER VIDEO WITH NICHE-SPECIFIC FOOTAGE ===\n');

// Mock context for tRPC caller
const mockCtx = {
  user: { id: 1, name: 'Test User', email: 'test@example.com', role: 'admin' },
  req: { headers: {} },
  res: {},
};

// Create tRPC caller
const caller = videosRouter.createCaller(mockCtx);

console.log('Generating Crypto Trader video...');
console.log('Script ID: 270001 (with pexelsQuery fields)');
console.log('Expected footage:');
console.log('  Scene 1: crypto trader frustrated');
console.log('  Scene 2: crypto market volatility');
console.log('  Scene 3: crypto trading success');
console.log('  Scene 4: crypto portfolio growth');
console.log('  Scene 5: crypto trading strategy');
console.log('');

try {
  const result = await caller.generate({
    scriptId: 270001,
    visualStyle: 'kinetic_typography',
    brandColor: '#3B82F6',
    isZapDemo: false,
  });
  
  console.log('✅ Video queued successfully');
  console.log('Video ID:', result.videoId);
  console.log('Status:', result.status);
  console.log('Credits used:', result.creditCost);
  console.log('');
  console.log('Waiting 90 seconds for render to complete...');
  
  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 90000));
  
  // Check status
  const video = await caller.getById({ videoId: result.videoId });
  console.log('');
  console.log('=== FINAL STATUS ===');
  console.log('Status:', video.creatomateStatus);
  if (video.videoUrl) {
    console.log('Video URL:', video.videoUrl);
    console.log('');
    console.log('✅ VIDEO READY - Verify it has crypto-specific footage (charts, trading, bitcoin)');
  } else if (video.creatomateStatus === 'failed') {
    console.log('❌ Render failed');
  } else {
    console.log('⏳ Still rendering... check database for final status');
  }
  
} catch (error) {
  console.error('❌ Failed:', error.message);
}
