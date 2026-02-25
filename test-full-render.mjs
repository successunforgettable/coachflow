/**
 * Test 3: Full video render with ZAP service data
 */

const DEV_URL = 'http://localhost:3000';

async function testFullRender() {
  console.log('=== TEST 3: Full Video Render ===\n');
  
  // Step 1: Login to get session cookie
  console.log('1. Logging in as owner...');
  const loginRes = await fetch(`${DEV_URL}/api/oauth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const cookies = loginRes.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('Failed to get session cookie');
  }
  console.log('✓ Logged in\n');
  
  // Step 2: Create test service
  console.log('2. Creating ZAP test service...');
  const serviceRes = await fetch(`${DEV_URL}/api/trpc/services.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({
      name: 'ZAP Campaigns',
      targetCustomer: 'Coaches who tried ads before and got burned',
      whyProblemExists: 'Wasted money on ads that got no results',
      desiredOutcome: 'A full Meta campaign live today without an agency',
      uniqueMechanism: 'Built by a coach who scaled to 900,000 students',
      mainBenefit: 'Launch profitable Meta campaigns without hiring an agency',
    }),
  });
  
  const serviceData = await serviceRes.json();
  const serviceId = serviceData.result?.data?.id;
  
  if (!serviceId) {
    console.error('Service creation failed:', serviceData);
    throw new Error('Failed to create service');
  }
  console.log(`✓ Service created: ID ${serviceId}\n`);
  
  // Step 3: Generate script
  console.log('3. Generating video script...');
  const scriptRes = await fetch(`${DEV_URL}/api/trpc/videoScripts.generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({
      serviceId,
      videoType: 'explainer',
      duration: '30',
    }),
  });
  
  const scriptData = await scriptRes.json();
  const scriptId = scriptData.result?.data?.id;
  
  if (!scriptId) {
    console.error('Script generation failed:', scriptData);
    throw new Error('Failed to generate script');
  }
  console.log(`✓ Script generated: ID ${scriptId}\n`);
  
  // Step 4: Generate video
  console.log('4. Triggering video render...');
  console.log('   This will take 30-60 seconds...\n');
  
  const videoRes = await fetch(`${DEV_URL}/api/trpc/videos.generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
    },
    body: JSON.stringify({
      scriptId,
      visualStyle: 'text_only',
      brandColor: '#8B5CF6',
    }),
  });
  
  const videoData = await videoRes.json();
  const videoId = videoData.result?.data?.id;
  
  if (!videoId) {
    console.error('Video generation failed:', videoData);
    throw new Error('Failed to start video generation');
  }
  console.log(`✓ Video generation started: ID ${videoId}\n`);
  
  // Step 5: Poll for completion
  console.log('5. Waiting for render to complete...');
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusRes = await fetch(`${DEV_URL}/api/trpc/videos.getById?input=${videoId}`, {
      headers: { 'Cookie': cookies },
    });
    
    const statusData = await statusRes.json();
    const video = statusData.result?.data;
    
    if (!video) {
      throw new Error('Failed to fetch video status');
    }
    
    console.log(`   Status: ${video.creatomateStatus} (attempt ${attempts + 1}/${maxAttempts})`);
    
    if (video.creatomateStatus === 'completed' && video.renderUrl) {
      console.log('\n✓ Render completed!\n');
      console.log('=== RENDER URL ===');
      console.log(video.renderUrl);
      console.log('\n⚠️  OPEN THIS URL TO VERIFY:\n');
      console.log('   1. Does the video play?');
      console.log('   2. Does the voiceover play from second 0?');
      console.log('   3. Does music play underneath it?');
      console.log('   4. Does the text animate word by word?');
      console.log('   5. Is the text large enough to read easily?\n');
      return video.renderUrl;
    }
    
    if (video.creatomateStatus === 'failed') {
      throw new Error(`Render failed: ${video.errorMessage || 'Unknown error'}`);
    }
    
    attempts++;
  }
  
  throw new Error('Render timeout after 5 minutes');
}

testFullRender().catch(console.error);
