import { invokeLLM } from "./server/_core/llm.js";
import { getDb } from "./server/db.js";
import { videoScripts, services } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const serviceIds = [840001, 840002, 840003, 840004, 840005];
const serviceNames = [
  "The Executive Edge",
  "Calm Canine Protocol",
  "The Funded Trader Blueprint",
  "Premium Wedding Photography Accelerator",
  "Strong Mama Method"
];

console.log("═══════════════════════════════════════════════════════════");
console.log("Generating 5 Scripts via LLM with Enhanced Niche Detection");
console.log("═══════════════════════════════════════════════════════════\n");

const db = await getDb();

for (let i = 0; i < serviceIds.length; i++) {
  const serviceId = serviceIds[i];
  const serviceName = serviceNames[i];
  
  console.log(`\n[${ i + 1}/5] Generating script for: ${serviceName} (ID: ${serviceId})`);
  
  // Fetch service data
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
  
  if (!service) {
    console.error(`❌ Service ${serviceId} not found`);
    continue;
  }
  
  // Build prompt using the same logic as videoScripts.generate
  const { buildScriptPrompt } = await import("./server/routers/videoScripts.js");
  
  const prompt = buildScriptPrompt("explainer", 30, service);
  
  console.log(`📝 Calling LLM to generate script...`);
  
  // Call LLM
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a video script writer." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "video_script",
        strict: true,
        schema: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sceneNumber: { type: "integer" },
                  duration: { type: "integer" },
                  voiceoverText: { type: "string" },
                  onScreenText: { type: "string" },
                  pexelsQuery: { type: "string" }
                },
                required: ["sceneNumber", "duration", "voiceoverText", "onScreenText", "pexelsQuery"],
                additionalProperties: false
              }
            }
          },
          required: ["scenes"],
          additionalProperties: false
        }
      }
    }
  });
  
  const scriptData = JSON.parse(response.choices[0].message.content);
  
  console.log(`✅ Script generated with ${scriptData.scenes.length} scenes`);
  console.log(`   Scene 1 hook: "${scriptData.scenes[0].voiceoverText.substring(0, 60)}..."`);
  
  // Insert into database
  const fullVoiceoverText = scriptData.scenes.map(s => s.voiceoverText).join(" ");
  
  const [result] = await db
    .insert(videoScripts)
    .values({
      userId: 1,
      serviceId: serviceId,
      videoType: "explainer",
      duration: "30",
      scenes: scriptData.scenes,
      voiceoverText: fullVoiceoverText,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  
  console.log(`💾 Saved to database as script ID: ${result.insertId}`);
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("✅ All 5 scripts generated successfully!");
console.log("═══════════════════════════════════════════════════════════");

process.exit(0);
