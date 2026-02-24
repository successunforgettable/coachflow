// server/routers/videoScripts.ts
// Generates AI scripts for video ads — FREE, no credits consumed
// Credit is only consumed when the user hits Generate Video

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { videoScripts, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export interface Scene {
  sceneNumber: number;
  duration: number;
  voiceoverText: string;
  visualDirection: string;
  onScreenText: string;
}

// ─── CREDIT COST BY DURATION ──────────────────────────────────────────────────
export function getCreditCost(duration: string): number {
  if (duration === "15" || duration === "30") return 1;
  if (duration === "60") return 2;
  if (duration === "90") return 3;
  return 1;
}

// ─── SCRIPT GENERATION PROMPTS ────────────────────────────────────────────────
function buildScriptPrompt(
  videoType: string,
  duration: number,
  service: any
): string {
  const baseContext = `
PRODUCT NAME: ${service.name}
TARGET AUDIENCE: ${service.targetCustomer || service.targetMarket || "Coaches and consultants"}
PRESSING PROBLEM: ${service.whyProblemExists || service.mainBenefit || "Wasting time on manual tasks"}
DESIRED OUTCOME: ${service.desiredOutcome || service.mainBenefit || "Save time and scale faster"}
UNIQUE MECHANISM: ${service.mechanismDescriptor || service.uniqueMechanism || "AI-powered automation"}
KEY BENEFITS: ${service.mainBenefit || "Save time, make more money"}
AUTHORITY: ${service.authority || "Industry expert"}
SOCIAL PROOF: ${
    service.totalCustomers
      ? `${service.totalCustomers}+ customers${service.averageRating ? `, ${service.averageRating}/5 stars` : ""}`
      : "Proven results — use outcome-based language only, no fabricated numbers"
  }
TESTIMONIAL: ${
    service.testimonial1Quote
      ? `"${service.testimonial1Quote}" — ${service.testimonial1Name}, ${service.testimonial1Title}`
      : "None provided — do not fabricate a testimonial"
  }
`;

  const globalRules = `
MANDATORY RULES (never violate):
1. NEVER use prohibited Meta language: banned, forbidden, leaked, exposed, glitch, secret they don't want you to know
2. NEVER fabricate statistics, customer counts, or testimonials not provided above
3. NEVER make income guarantees or specific financial return claims
4. Keep voiceover text conversational — contractions, short sentences, spoken naturally
5. On-screen text must be 3-7 words MAXIMUM — punchy visual overlay
6. Visual direction must be achievable with motion graphics or kinetic typography
7. First scene must be a pattern interrupt — the hook that stops the scroll

RESPOND WITH VALID JSON ONLY. No markdown, no preamble, no explanation.
Format:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "voiceoverText": "Exact spoken words",
      "visualDirection": "What appears on screen — specific, achievable",
      "onScreenText": "3-7 word text overlay"
    }
  ]
}`;

  if (videoType === "explainer") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second EXPLAINER video ad script. Structure: Problem → Agitation → Solution → Mechanism → CTA.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Pattern interrupt question or bold claim
Scene 2 (5-12s): PROBLEM — Name the pain clearly
Scene 3 (12-22s): SOLUTION + MECHANISM — Introduce product and how it works
Scene 4 (22-${duration}s): CTA — Specific action`
    : duration === 60
    ? `Scene 1 (0-5s): HOOK — Pattern interrupt
Scene 2 (5-15s): PROBLEM AGITATION — Make the pain real
Scene 3 (15-30s): SOLUTION — Introduce the product
Scene 4 (30-45s): MECHANISM — How it works simply
Scene 5 (45-55s): PROOF — Social proof or authority (only if data provided above)
Scene 6 (55-60s): CTA — Single specific action`
    : `Scene 1 (0-5s): HOOK
Scene 2 (5-15s): PROBLEM AGITATION
Scene 3 (15-30s): RELATABLE STORY SCENARIO
Scene 4 (30-50s): SOLUTION + MECHANISM
Scene 5 (50-70s): PROOF + TESTIMONIAL (only if provided above)
Scene 6 (70-85s): BENEFITS STACK
Scene 7 (85-90s): CTA`
}

${globalRules}`;
  }

  if (videoType === "proof_results") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second PROOF/RESULTS video ad script. Lead with outcomes, not problems.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Bold result claim
Scene 2 (5-15s): BEFORE STATE — Where they were
Scene 3 (15-25s): AFTER STATE — Where they are now
Scene 4 (25-${duration}s): CTA`
    : `Scene 1 (0-5s): HOOK — Bold result claim
Scene 2 (5-15s): BEFORE STATE — Pain and struggle
Scene 3 (15-30s): TRANSFORMATION — What changed
Scene 4 (30-45s): AFTER STATE — Results achieved
Scene 5 (45-55s): SOCIAL PROOF (only use numbers provided above)
Scene 6 (55-${duration}s): CTA — Invite them to get same results`
}

EXTRA RULES FOR PROOF/RESULTS:
- Lead with the result, not the problem
- Use "from X to Y" transformation language where possible
- If no social proof numbers are provided, use directional language: "hundreds of coaches", "most of our clients"
- CTA should be: "Get the same results" or "Start your transformation"

${globalRules}`;
  }

  if (videoType === "testimonial") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second TESTIMONIAL video ad script.

SERVICE DATA:
${baseContext}

INSTRUCTIONS:
${
  service.testimonial1Quote
    ? `A real testimonial has been provided. Structure the video around this person's story.
Real testimonial: "${service.testimonial1Quote}" — ${service.testimonial1Name}, ${service.testimonial1Title}
Write the voiceover as if ${service.testimonial1Name} is speaking directly.`
    : `No real testimonial provided. Write a relatable third-person story using "imagine" framing.
DO NOT fabricate a named person. Use: "Imagine you're a coach who..." or "Picture this..."
This is not a real testimonial — it's an aspirational scenario.`
}

SCENE STRUCTURE for ${duration} seconds:
Scene 1 (0-5s): HOOK — Before state (struggle or challenge)
Scene 2 (5-15s): THE PROBLEM — What they were dealing with
Scene 3 (15-30s): DISCOVERY — How they found the solution
Scene 4 (30-45s): TRANSFORMATION — What changed
Scene 5 (45-55s): RESULTS — Where they are now
Scene 6 (55-${duration}s): CTA — Invite viewer to have same experience

EXTRA RULES:
- Write in first person if using real testimonial, third person/imagine framing if not
- Show emotional journey: frustration → relief → success
- On-screen text should use quote-style highlights
- Visual direction should suggest testimonial card layout

${globalRules}`;
  }

  if (videoType === "mechanism_reveal") {
    return `You are a world-class direct response video scriptwriter for Meta ads.

Generate a ${duration}-second MECHANISM REVEAL video ad script. The goal is to make the unique mechanism sound proprietary and revolutionary.

SERVICE DATA:
${baseContext}

SCENE STRUCTURE for ${duration} seconds:
${
  duration <= 30
    ? `Scene 1 (0-5s): HOOK — Question challenging the old approach
Scene 2 (5-15s): OLD WAY — Why current methods fail
Scene 3 (15-25s): NEW WAY — Reveal the mechanism
Scene 4 (25-${duration}s): CTA`
    : `Scene 1 (0-5s): HOOK — Question challenging the old approach
Scene 2 (5-15s): OLD WAY — Why current methods fail
Scene 3 (15-30s): NEW WAY — Reveal the mechanism
Scene 4 (30-45s): HOW IT WORKS — 3-step breakdown (simple, clear)
Scene 5 (45-55s): RESULTS — What this mechanism enables
Scene 6 (55-${duration}s): CTA`
}

EXTRA RULES:
- Position the mechanism as a fundamentally different approach
- Contrast old way vs new way explicitly
- Break mechanism into 3 steps maximum
- Make it sound proprietary even if it isn't
- On-screen text should emphasize the mechanism name
- Visual direction should suggest step-by-step reveal

${globalRules}`;
  }

  throw new Error(`Unknown video type: ${videoType}`);
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export const videoScriptsRouter = router({

  // Generate script — FREE, no credit consumed
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        videoType: z.enum(["explainer", "proof_results", "testimonial", "mechanism_reveal"]),
        duration: z.enum(["15", "30", "60", "90"]),
        visualStyle: z.enum(["kinetic_typography", "motion_graphics", "stats_card"]),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId));

      if (!service) throw new Error("Service not found");

      const prompt = buildScriptPrompt(
        input.videoType,
        parseInt(input.duration),
        service
      );

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        maxTokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("Invalid AI response");
      }

      let scriptData: { scenes: Scene[] };
      try {
        const clean = content.replace(/```json|```/g, "").trim();
        scriptData = JSON.parse(clean);
      } catch {
        throw new Error("Script generation failed — please try again");
      }

      if (!scriptData.scenes?.length) {
        throw new Error("No scenes returned — please try again");
      }

      const voiceoverText = scriptData.scenes.map((s) => s.voiceoverText).join(" ");

      const [record] = await db.insert(videoScripts).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId ?? null,
        videoType: input.videoType,
        duration: input.duration,
        visualStyle: input.visualStyle,
        scenes: scriptData.scenes,
        voiceoverText,
        status: "draft",
      });

      return {
        scriptId: (record as any).insertId,
        scenes: scriptData.scenes,
        voiceoverText,
        creditCost: getCreditCost(input.duration),
      };
    }),

  // Update script after user edits — FREE
  update: protectedProcedure
    .input(
      z.object({
        scriptId: z.number(),
        scenes: z.array(
          z.object({
            sceneNumber: z.number(),
            duration: z.number(),
            voiceoverText: z.string(),
            visualDirection: z.string(),
            onScreenText: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [script] = await db
        .select()
        .from(videoScripts)
        .where(
          and(
            eq(videoScripts.id, input.scriptId),
            eq(videoScripts.userId, ctx.user.id)
          )
        );

      if (!script) throw new Error("Script not found");

      const voiceoverText = input.scenes.map((s: any) => s.voiceoverText).join(" ");

      await db
        .update(videoScripts)
        .set({ scenes: input.scenes, voiceoverText, updatedAt: new Date() })
        .where(eq(videoScripts.id, input.scriptId));

      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ scriptId: z.number() }))
    .query(async ({ ctx, input }: { ctx: any; input: any }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [script] = await db
        .select()
        .from(videoScripts)
        .where(
          and(
            eq(videoScripts.id, input.scriptId),
            eq(videoScripts.userId, ctx.user.id)
          )
        );

      if (!script) throw new Error("Script not found");

      return {
        ...script,
        scenes: script.scenes as Scene[],
        creditCost: getCreditCost(script.duration),
      };
    }),

  list: protectedProcedure.query(async ({ ctx }: { ctx: any }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const scripts = await db
      .select()
      .from(videoScripts)
      .where(eq(videoScripts.userId, ctx.user.id))
      .orderBy(desc(videoScripts.createdAt))
      .limit(50);

    return scripts.map((s) => ({
      ...s,
      creditCost: getCreditCost(s.duration),
    }));
  }),
});
