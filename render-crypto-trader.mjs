import mysql from 'mysql2/promise';
import Creatomate from 'creatomate';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get the Crypto Trader script
const [scripts] = await conn.execute('SELECT * FROM videoScripts WHERE id = 240005');
const script = scripts[0];

console.log('=== RENDERING CRYPTO TRADER VIDEO ===');
console.log('Script ID:', script.id);
console.log('');

// Parse scenes
let scenes;
if (typeof script.scenes === 'string') {
  scenes = JSON.parse(script.scenes);
} else {
  scenes = script.scenes;
}

// Initialize Creatomate
const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY);

// Calculate total duration
const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
console.log('Total duration:', totalDuration, 'seconds');

// Build text elements for each scene
let currentTime = 0;
const textElements = [];

for (const scene of scenes) {
  // Main on-screen text with word-by-word animation
  textElements.push(
    new Creatomate.Text({
      track: 1,
      time: currentTime,
      duration: scene.duration,
      text: scene.onScreenText,
      fontFamily: 'Montserrat',
      fontWeight: '900',
      fontSize: '15vmin',
      fillColor: '#ffffff',
      width: '90%',
      height: 'auto',
      x: '50%',
      y: '50%',
      xAlignment: '50%',
      yAlignment: '50%',
      xAnchor: '50%',
      yAnchor: '50%',
      enter: new Creatomate.TextSlide({
        duration: 0.8,
        easing: 'quadratic-out',
        split: 'word',
        scope: 'element',
        backgroundEffect: 'scaling-clip',
      }),
    })
  );

  currentTime += scene.duration;
}

// Build voiceover text
const voiceoverText = scenes.map(s => s.voiceoverText).join(' ');

// Create the source (EXACT copy from working demoVideos.ts)
const source = new Creatomate.Source({
  outputFormat: 'mp4',
  width: 1080,
  height: 1920,
  frameRate: 30,
  duration: totalDuration,

  elements: [
    // Background with radial gradient
    new Creatomate.Shape({
      track: 0,
      time: 0,
      duration: totalDuration,
      path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      fillColor: [
        { offset: 0, color: '#1a1a1a' },
        { offset: 1, color: '#000000' },
      ],
    }),

    // Text elements
    ...textElements,

    // Voiceover audio (ElevenLabs with Josh voice)
    new Creatomate.Audio({
      track: 10,
      source: {
        type: 'audio_ai',
        provider: 'elevenlabs',
        voice: 'TxGEqnHWrfWFTfGW9XjX',
        text: voiceoverText,
        settings: {
          stability: 0.25,
          similarity_boost: 0.75,
          style: 0.65,
          use_speaker_boost: true,
        },
      },
      volume: '100%',
    }),
  ],
});

// Render the video
console.log('Starting Creatomate render...');
const renders = await client.render({ source });
const render = renders[0];

console.log('Render ID:', render.id);
console.log('Status:', render.status);

// Poll for completion
console.log('Polling for render completion...');
let completedRender = render;
while (completedRender.status !== 'succeeded' && completedRender.status !== 'failed') {
  await new Promise(resolve => setTimeout(resolve, 5000));
  completedRender = await client.fetchRender(render.id);
  console.log('Status:', completedRender.status);
}

console.log('');
if (completedRender.status === 'succeeded') {
  console.log('✅ VIDEO RENDERED SUCCESSFULLY');
  console.log('Video URL:', completedRender.url);
} else {
  console.log('❌ VIDEO RENDER FAILED');
  console.log('Error:', completedRender.errorMessage);
}

await conn.end();
