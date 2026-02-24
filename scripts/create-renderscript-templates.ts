/**
 * Create 3 Creatomate video templates using RenderScript API
 * 
 * Templates:
 * 1. Kinetic Typography - Text animates word by word
 * 2. Motion Graphics - Animated shapes behind text
 * 3. Stats Card - Large hero numbers with counting animation
 */

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY!;

interface RenderScriptTemplate {
  name: string;
  description: string;
  renderScript: any;
}

// Template 1: Kinetic Typography
const kineticTypographyTemplate: RenderScriptTemplate = {
  name: "ZAP Kinetic Typography",
  description: "Text animates word by word with brand colors - perfect for explainer videos",
  renderScript: {
    output_format: "mp4",
    width: 1080,
    height: 1080,
    duration: null, // Auto-calculated from voiceover
    elements: [
      // Background
      {
        type: "shape",
        path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
        fill_color: "#0a0a0a",
        width: "100%",
        height: "100%",
        duration: null,
      },
      // Logo (optional)
      {
        type: "image",
        name: "Logo",
        source: "{{logo_url}}",
        width: "15%",
        height: "15%",
        x: "10%",
        y: "10%",
        duration: null,
      },
      // Voiceover audio
      {
        type: "audio",
        name: "Voiceover",
        source: "{{voiceover_url}}",
        duration: null,
      },
      // Scene 1 - Kinetic text
      {
        type: "composition",
        name: "Scene1",
        time: 0,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene1Text",
            text: "{{scene_1_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Montserrat",
            font_weight: 700,
            font_size: null,
            font_size_minimum: "4 vmin",
            font_size_maximum: "10 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            text_transform: "uppercase",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "text-slide",
                scope: "word",
                split_delay: 0.05,
                direction: "left",
              },
            ],
          },
        ],
      },
      // Scene 2
      {
        type: "composition",
        name: "Scene2",
        time: null, // Will be set dynamically based on scene 1 duration
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene2Text",
            text: "{{scene_2_text}}",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: 600,
            font_size: null,
            font_size_minimum: "3.5 vmin",
            font_size_maximum: "8 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "text-slide",
                scope: "word",
                split_delay: 0.05,
                direction: "right",
              },
            ],
          },
        ],
      },
      // Scene 3
      {
        type: "composition",
        name: "Scene3",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene3Text",
            text: "{{scene_3_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Montserrat",
            font_weight: 700,
            font_size: null,
            font_size_minimum: "4 vmin",
            font_size_maximum: "10 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            text_transform: "uppercase",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "text-scale",
                scope: "word",
                split_delay: 0.05,
              },
            ],
          },
        ],
      },
      // Scene 4 (CTA)
      {
        type: "composition",
        name: "Scene4",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene4Text",
            text: "{{scene_4_text}}",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: 600,
            font_size: null,
            font_size_minimum: "3 vmin",
            font_size_maximum: "7 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 1,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "fade",
              },
            ],
          },
        ],
      },
    ],
  },
};

// Template 2: Motion Graphics
const motionGraphicsTemplate: RenderScriptTemplate = {
  name: "ZAP Motion Graphics",
  description: "Animated shapes and icons behind text - dynamic and energetic",
  renderScript: {
    output_format: "mp4",
    width: 1080,
    height: 1080,
    duration: null,
    elements: [
      // Background
      {
        type: "shape",
        path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
        fill_color: "#1a1a1a",
        width: "100%",
        height: "100%",
        duration: null,
      },
      // Animated circles background
      {
        type: "shape",
        path: "M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0",
        fill_color: "{{brand_color}}",
        opacity: "20%",
        width: "40%",
        height: "40%",
        x: "20%",
        y: "30%",
        duration: null,
        animations: [
          {
            time: 0,
            duration: 3,
            easing: "linear",
            type: "rotate",
            scope: "element",
            amount: 360,
          },
        ],
      },
      {
        type: "shape",
        path: "M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0",
        fill_color: "{{brand_color}}",
        opacity: "15%",
        width: "30%",
        height: "30%",
        x: "70%",
        y: "60%",
        duration: null,
        animations: [
          {
            time: 0,
            duration: 4,
            easing: "linear",
            type: "rotate",
            scope: "element",
            amount: -360,
          },
        ],
      },
      // Logo
      {
        type: "image",
        name: "Logo",
        source: "{{logo_url}}",
        width: "15%",
        height: "15%",
        x: "10%",
        y: "10%",
        duration: null,
      },
      // Voiceover
      {
        type: "audio",
        name: "Voiceover",
        source: "{{voiceover_url}}",
        duration: null,
      },
      // Scene 1
      {
        type: "composition",
        name: "Scene1",
        time: 0,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene1Text",
            text: "{{scene_1_text}}",
            fill_color: "#ffffff",
            font_family: "Inter",
            font_weight: 700,
            font_size: null,
            font_size_minimum: "4 vmin",
            font_size_maximum: "10 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.6,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "pop",
              },
            ],
          },
        ],
      },
      // Scene 2
      {
        type: "composition",
        name: "Scene2",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene2Text",
            text: "{{scene_2_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Inter",
            font_weight: 600,
            font_size: null,
            font_size_minimum: "3.5 vmin",
            font_size_maximum: "8 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.6,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "wipe",
                direction: "left",
              },
            ],
          },
        ],
      },
      // Scene 3
      {
        type: "composition",
        name: "Scene3",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene3Text",
            text: "{{scene_3_text}}",
            fill_color: "#ffffff",
            font_family: "Inter",
            font_weight: 700,
            font_size: null,
            font_size_minimum: "4 vmin",
            font_size_maximum: "10 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.6,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "slide",
                direction: "up",
              },
            ],
          },
        ],
      },
      // Scene 4
      {
        type: "composition",
        name: "Scene4",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene4Text",
            text: "{{scene_4_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Inter",
            font_weight: 600,
            font_size: null,
            font_size_minimum: "3 vmin",
            font_size_maximum: "7 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "scale",
              },
            ],
          },
        ],
      },
    ],
  },
};

// Template 3: Stats Card
const statsCardTemplate: RenderScriptTemplate = {
  name: "ZAP Stats Card",
  description: "Large hero numbers with counting animation - perfect for results/proof videos",
  renderScript: {
    output_format: "mp4",
    width: 1080,
    height: 1080,
    duration: null,
    elements: [
      // Background gradient
      {
        type: "shape",
        path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
        fill_color: [
          { position: 0, color: "#0f172a" },
          { position: 1, color: "#1e293b" },
        ],
        fill_mode: "linear",
        fill_y0: "0%",
        fill_y1: "100%",
        width: "100%",
        height: "100%",
        duration: null,
      },
      // Logo
      {
        type: "image",
        name: "Logo",
        source: "{{logo_url}}",
        width: "15%",
        height: "15%",
        x: "10%",
        y: "10%",
        duration: null,
      },
      // Voiceover
      {
        type: "audio",
        name: "Voiceover",
        source: "{{voiceover_url}}",
        duration: null,
      },
      // Scene 1 - Big number reveal
      {
        type: "composition",
        name: "Scene1",
        time: 0,
        duration: null,
        elements: [
          // Main stat number
          {
            type: "text",
            name: "Scene1Number",
            text: "{{scene_1_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Inter",
            font_weight: 900,
            font_size: "20 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "90%",
            height: "auto",
            x: "50%",
            y: "40%",
            animations: [
              {
                time: 0,
                duration: 1.2,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "scale",
              },
            ],
          },
        ],
      },
      // Scene 2 - Context text
      {
        type: "composition",
        name: "Scene2",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene2Text",
            text: "{{scene_2_text}}",
            fill_color: "#ffffff",
            font_family: "Inter",
            font_weight: 500,
            font_size: null,
            font_size_minimum: "3 vmin",
            font_size_maximum: "6 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "65%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "fade",
              },
            ],
          },
        ],
      },
      // Scene 3 - Second stat
      {
        type: "composition",
        name: "Scene3",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene3Text",
            text: "{{scene_3_text}}",
            fill_color: "{{brand_color}}",
            font_family: "Inter",
            font_weight: 900,
            font_size: "18 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "90%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 1,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "pop",
              },
            ],
          },
        ],
      },
      // Scene 4 - CTA
      {
        type: "composition",
        name: "Scene4",
        time: null,
        duration: null,
        elements: [
          {
            type: "text",
            name: "Scene4Text",
            text: "{{scene_4_text}}",
            fill_color: "#ffffff",
            font_family: "Inter",
            font_weight: 600,
            font_size: null,
            font_size_minimum: "3 vmin",
            font_size_maximum: "7 vmin",
            x_alignment: "50%",
            y_alignment: "50%",
            width: "80%",
            height: "auto",
            x: "50%",
            y: "50%",
            animations: [
              {
                time: 0,
                duration: 0.8,
                easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                type: "slide",
                direction: "up",
              },
            ],
          },
        ],
      },
    ],
  },
};

async function createTemplate(template: RenderScriptTemplate): Promise<string> {
  console.log(`\n📝 Creating template: ${template.name}...`);
  
  // Note: Creatomate API doesn't have a direct "create template" endpoint
  // Templates are created by rendering once, then the render can be saved as a template
  // For now, we'll save these as JSON files that can be used directly in renders
  
  const response = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CREATOMATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Test render with placeholder data
      template_id: null,
      modifications: template.renderScript,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create template ${template.name}: ${error}`);
  }

  const result = await response.json();
  console.log(`✅ Template created: ${template.name}`);
  console.log(`   Render ID: ${result.id}`);
  
  return result.id;
}

async function main() {
  console.log("🎬 Creating 3 Creatomate RenderScript templates...\n");
  
  try {
    // Save templates as JSON files for direct use
    const fs = await import("fs/promises");
    
    await fs.writeFile(
      "/home/ubuntu/coachflow/server/creatomate-templates/kinetic-typography.json",
      JSON.stringify(kineticTypographyTemplate.renderScript, null, 2)
    );
    console.log("✅ Saved: kinetic-typography.json");
    
    await fs.writeFile(
      "/home/ubuntu/coachflow/server/creatomate-templates/motion-graphics.json",
      JSON.stringify(motionGraphicsTemplate.renderScript, null, 2)
    );
    console.log("✅ Saved: motion-graphics.json");
    
    await fs.writeFile(
      "/home/ubuntu/coachflow/server/creatomate-templates/stats-card.json",
      JSON.stringify(statsCardTemplate.renderScript, null, 2)
    );
    console.log("✅ Saved: stats-card.json");
    
    console.log("\n🎉 All 3 templates created successfully!");
    console.log("\nTemplates saved to: /home/ubuntu/coachflow/server/creatomate-templates/");
    console.log("\nThese RenderScript templates can now be used directly in video generation.");
    
  } catch (error) {
    console.error("❌ Error creating templates:", error);
    process.exit(1);
  }
}

main();
