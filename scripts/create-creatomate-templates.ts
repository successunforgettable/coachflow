/**
 * Create 3 Creatomate video templates programmatically
 * 
 * Templates:
 * 1. Kinetic Typography - Text animates word by word
 * 2. Motion Graphics - Animated shapes/icons behind text
 * 3. Stats Card - Large hero numbers with counting animation
 */

// Using native fetch (Node.js 18+)

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY!;
const API_BASE = 'https://api.creatomate.com/v1';

interface CreatomateTemplate {
  name: string;
  width: number;
  height: number;
  frame_rate: number;
  duration: number;
  elements: any[];
}

// Template 1: Kinetic Typography
const kineticTypographyTemplate: CreatomateTemplate = {
  name: 'ZAP Kinetic Typography - Square',
  width: 1080,
  height: 1080,
  frame_rate: 30,
  duration: 60, // Will be dynamic based on voiceover
  elements: [
    // Background
    {
      type: 'shape',
      track: 1,
      time: 0,
      duration: null, // Full duration
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      shape_type: 'rectangle',
      fill_color: '#0a0a0a', // Dark background
    },
    // Brand logo (optional, top left)
    {
      type: 'image',
      track: 2,
      time: 0,
      duration: null,
      source: '{{logo_url}}',
      x: '10%',
      y: '10%',
      width: '15%',
      height: null,
      fit: 'contain',
      animations: [
        {
          time: 0,
          duration: 0.5,
          easing: 'quadratic-out',
          fade: [0, 1],
          scale: [0.8, 1],
        },
      ],
    },
    // Scene 1 text (kinetic animation)
    {
      type: 'text',
      track: 3,
      time: 0,
      duration: 15,
      text: '{{scene_1_text}}',
      x: '50%',
      y: '50%',
      width: '80%',
      height: null,
      font_family: 'Montserrat',
      font_weight: '700',
      font_size: '72px',
      fill_color: '#ffffff',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 0,
          duration: 1,
          easing: 'cubic-out',
          fade: [0, 1],
          y: ['55%', '50%'],
        },
        {
          time: 13,
          duration: 1,
          easing: 'cubic-in',
          fade: [1, 0],
          y: ['50%', '45%'],
        },
      ],
    },
    // Scene 2 text
    {
      type: 'text',
      track: 4,
      time: 15,
      duration: 15,
      text: '{{scene_2_text}}',
      x: '50%',
      y: '50%',
      width: '80%',
      height: null,
      font_family: 'Montserrat',
      font_weight: '700',
      font_size: '72px',
      fill_color: '{{brand_color}}', // Dynamic brand color
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 15,
          duration: 1,
          easing: 'cubic-out',
          fade: [0, 1],
          y: ['55%', '50%'],
        },
        {
          time: 28,
          duration: 1,
          easing: 'cubic-in',
          fade: [1, 0],
          y: ['50%', '45%'],
        },
      ],
    },
    // Scene 3 text
    {
      type: 'text',
      track: 5,
      time: 30,
      duration: 15,
      text: '{{scene_3_text}}',
      x: '50%',
      y: '50%',
      width: '80%',
      height: null,
      font_family: 'Montserrat',
      font_weight: '700',
      font_size: '72px',
      fill_color: '#ffffff',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 30,
          duration: 1,
          easing: 'cubic-out',
          fade: [0, 1],
          y: ['55%', '50%'],
        },
        {
          time: 43,
          duration: 1,
          easing: 'cubic-in',
          fade: [1, 0],
          y: ['50%', '45%'],
        },
      ],
    },
    // Scene 4 text (CTA)
    {
      type: 'text',
      track: 6,
      time: 45,
      duration: 15,
      text: '{{scene_4_text}}',
      x: '50%',
      y: '50%',
      width: '80%',
      height: null,
      font_family: 'Montserrat',
      font_weight: '800',
      font_size: '84px',
      fill_color: '{{brand_color}}',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 45,
          duration: 1.2,
          easing: 'elastic-out',
          fade: [0, 1],
          scale: [0.8, 1],
        },
      ],
    },
    // Voiceover audio
    {
      type: 'audio',
      track: 10,
      time: 0,
      duration: null,
      source: '{{voiceover_url}}',
      volume: 1,
    },
  ],
};

// Template 2: Motion Graphics
const motionGraphicsTemplate: CreatomateTemplate = {
  name: 'ZAP Motion Graphics - Square',
  width: 1080,
  height: 1080,
  frame_rate: 30,
  duration: 60,
  elements: [
    // Background gradient
    {
      type: 'shape',
      track: 1,
      time: 0,
      duration: null,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      shape_type: 'rectangle',
      fill_color: '#0a0a0a',
    },
    // Animated circle 1 (background decoration)
    {
      type: 'shape',
      track: 2,
      time: 0,
      duration: null,
      x: '20%',
      y: '30%',
      width: '40%',
      height: '40%',
      shape_type: 'ellipse',
      fill_color: '{{brand_color}}',
      opacity: 0.1,
      animations: [
        {
          time: 0,
          duration: 60,
          easing: 'linear',
          rotation: [0, 360],
          scale: [1, 1.2, 1],
        },
      ],
    },
    // Animated circle 2
    {
      type: 'shape',
      track: 3,
      time: 0,
      duration: null,
      x: '80%',
      y: '70%',
      width: '50%',
      height: '50%',
      shape_type: 'ellipse',
      fill_color: '#ffffff',
      opacity: 0.05,
      animations: [
        {
          time: 0,
          duration: 60,
          easing: 'linear',
          rotation: [360, 0],
          scale: [1, 0.8, 1],
        },
      ],
    },
    // Logo
    {
      type: 'image',
      track: 4,
      time: 0,
      duration: null,
      source: '{{logo_url}}',
      x: '10%',
      y: '10%',
      width: '15%',
      height: null,
      fit: 'contain',
      animations: [
        {
          time: 0,
          duration: 0.8,
          easing: 'back-out',
          fade: [0, 1],
          scale: [0, 1],
        },
      ],
    },
    // Scene 1 text
    {
      type: 'text',
      track: 5,
      time: 0,
      duration: 15,
      text: '{{scene_1_text}}',
      x: '50%',
      y: '50%',
      width: '75%',
      height: null,
      font_family: 'Inter',
      font_weight: '700',
      font_size: '68px',
      fill_color: '#ffffff',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 0,
          duration: 0.8,
          easing: 'cubic-out',
          fade: [0, 1],
          x: ['45%', '50%'],
        },
        {
          time: 13.5,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
          x: ['50%', '55%'],
        },
      ],
    },
    // Scene 2 text
    {
      type: 'text',
      track: 6,
      time: 15,
      duration: 15,
      text: '{{scene_2_text}}',
      x: '50%',
      y: '50%',
      width: '75%',
      height: null,
      font_family: 'Inter',
      font_weight: '700',
      font_size: '68px',
      fill_color: '{{brand_color}}',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 15,
          duration: 0.8,
          easing: 'cubic-out',
          fade: [0, 1],
          x: ['45%', '50%'],
        },
        {
          time: 28.5,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
          x: ['50%', '55%'],
        },
      ],
    },
    // Scene 3 text
    {
      type: 'text',
      track: 7,
      time: 30,
      duration: 15,
      text: '{{scene_3_text}}',
      x: '50%',
      y: '50%',
      width: '75%',
      height: null,
      font_family: 'Inter',
      font_weight: '700',
      font_size: '68px',
      fill_color: '#ffffff',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 30,
          duration: 0.8,
          easing: 'cubic-out',
          fade: [0, 1],
          x: ['45%', '50%'],
        },
        {
          time: 43.5,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
          x: ['50%', '55%'],
        },
      ],
    },
    // Scene 4 text (CTA)
    {
      type: 'text',
      track: 8,
      time: 45,
      duration: 15,
      text: '{{scene_4_text}}',
      x: '50%',
      y: '50%',
      width: '75%',
      height: null,
      font_family: 'Inter',
      font_weight: '800',
      font_size: '80px',
      fill_color: '{{brand_color}}',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 45,
          duration: 1,
          easing: 'elastic-out',
          fade: [0, 1],
          scale: [0.7, 1],
        },
      ],
    },
    // Voiceover
    {
      type: 'audio',
      track: 10,
      time: 0,
      duration: null,
      source: '{{voiceover_url}}',
      volume: 1,
    },
  ],
};

// Template 3: Stats Card
const statsCardTemplate: CreatomateTemplate = {
  name: 'ZAP Stats Card - Square',
  width: 1080,
  height: 1080,
  frame_rate: 30,
  duration: 60,
  elements: [
    // Background
    {
      type: 'shape',
      track: 1,
      time: 0,
      duration: null,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      shape_type: 'rectangle',
      fill_color: '#ffffff', // Light background for stats
    },
    // Logo
    {
      type: 'image',
      track: 2,
      time: 0,
      duration: null,
      source: '{{logo_url}}',
      x: '50%',
      y: '15%',
      width: '20%',
      height: null,
      fit: 'contain',
      animations: [
        {
          time: 0,
          duration: 0.6,
          easing: 'back-out',
          fade: [0, 1],
          scale: [0, 1],
        },
      ],
    },
    // Hero stat number (Scene 1)
    {
      type: 'text',
      track: 3,
      time: 0,
      duration: 15,
      text: '{{scene_1_text}}',
      x: '50%',
      y: '45%',
      width: '80%',
      height: null,
      font_family: 'Inter',
      font_weight: '900',
      font_size: '140px',
      fill_color: '{{brand_color}}',
      text_align: 'center',
      animations: [
        {
          time: 0,
          duration: 1.2,
          easing: 'elastic-out',
          fade: [0, 1],
          scale: [0, 1],
        },
        {
          time: 13,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
          scale: [1, 0.8],
        },
      ],
    },
    // Stat description (below number)
    {
      type: 'text',
      track: 4,
      time: 0,
      duration: 15,
      text: '{{scene_2_text}}',
      x: '50%',
      y: '65%',
      width: '70%',
      height: null,
      font_family: 'Inter',
      font_weight: '600',
      font_size: '48px',
      fill_color: '#0a0a0a',
      text_align: 'center',
      animations: [
        {
          time: 0.5,
          duration: 0.8,
          easing: 'cubic-out',
          fade: [0, 1],
          y: ['70%', '65%'],
        },
        {
          time: 13.5,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
        },
      ],
    },
    // Scene 3 text (secondary message)
    {
      type: 'text',
      track: 5,
      time: 15,
      duration: 15,
      text: '{{scene_3_text}}',
      x: '50%',
      y: '50%',
      width: '75%',
      height: null,
      font_family: 'Inter',
      font_weight: '700',
      font_size: '64px',
      fill_color: '#0a0a0a',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 15,
          duration: 0.8,
          easing: 'cubic-out',
          fade: [0, 1],
          scale: [0.9, 1],
        },
        {
          time: 28.5,
          duration: 0.8,
          easing: 'cubic-in',
          fade: [1, 0],
        },
      ],
    },
    // Scene 4 text (CTA)
    {
      type: 'text',
      track: 6,
      time: 30,
      duration: 30,
      text: '{{scene_4_text}}',
      x: '50%',
      y: '50%',
      width: '80%',
      height: null,
      font_family: 'Inter',
      font_weight: '800',
      font_size: '72px',
      fill_color: '{{brand_color}}',
      text_align: 'center',
      line_height: '120%',
      animations: [
        {
          time: 30,
          duration: 1,
          easing: 'elastic-out',
          fade: [0, 1],
          scale: [0.8, 1],
        },
      ],
    },
    // Voiceover
    {
      type: 'audio',
      track: 10,
      time: 0,
      duration: null,
      source: '{{voiceover_url}}',
      volume: 1,
    },
  ],
};

async function createTemplate(template: CreatomateTemplate): Promise<string> {
  const response = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CREATOMATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create template: ${error}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

async function main() {
  console.log('Creating Creatomate templates...\n');

  try {
    // Create template 1
    console.log('1. Creating Kinetic Typography template...');
    const template1Id = await createTemplate(kineticTypographyTemplate);
    console.log(`   ✅ Created: ${template1Id}`);

    // Create template 2
    console.log('2. Creating Motion Graphics template...');
    const template2Id = await createTemplate(motionGraphicsTemplate);
    console.log(`   ✅ Created: ${template2Id}`);

    // Create template 3
    console.log('3. Creating Stats Card template...');
    const template3Id = await createTemplate(statsCardTemplate);
    console.log(`   ✅ Created: ${template3Id}`);

    console.log('\n✅ All templates created successfully!');
    console.log('\nTemplate IDs (add these to environment variables):');
    console.log(`CREATOMATE_TEMPLATE_KINETIC_TYPOGRAPHY=${template1Id}`);
    console.log(`CREATOMATE_TEMPLATE_MOTION_GRAPHICS=${template2Id}`);
    console.log(`CREATOMATE_TEMPLATE_STATS_CARD=${template3Id}`);
  } catch (error) {
    console.error('❌ Error creating templates:', error);
    process.exit(1);
  }
}

main();
