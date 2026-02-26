import { appRouter } from './server/_core/trpc.ts';

const ctx = {
  user: {
    id: 1,
    openId: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    createdAt: new Date(),
  },
  req: { headers: { origin: 'http://localhost:3000' } },
  res: {},
};

const caller = appRouter.createCaller(ctx);

console.log('=== RENDERING CRYPTO TRADER VIDEO ===\n');
console.log('Script ID: 270001 (42 seconds, 5 scenes with pexelsQuery fields)');
console.log('Expected: Full-color stock footage from Pexels\n');

try {
  const result = await caller.videos.generate({ scriptId: 270001 });
  console.log('\n✅ VIDEO GENERATION STARTED');
  console.log(`Video ID: ${result.videoId}`);
  console.log(`Render ID: ${result.renderId}`);
  console.log('\nPolling for completion...\n');
  
  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const video = await caller.videos.getById({ videoId: result.videoId });
    console.log(`[${attempts + 1}/${maxAttempts}] Render status: ${video.renderStatus || 'unknown'}`);
    
    if (video.renderStatus === 'succeeded') {
      console.log('\n✅ VIDEO RENDER COMPLETE!');
      console.log(`URL: ${video.url}`);
      console.log(`Duration: ${video.duration}s`);
      break;
    }
    
    if (video.renderStatus === 'failed') {
      console.log('\n❌ VIDEO RENDER FAILED');
      break;
    }
    
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏱️ TIMEOUT: Render took longer than 5 minutes');
  }
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  if (error.data) {
    console.error('Details:', error.data);
  }
}

console.log('\n=== RENDER COMPLETE ===');
