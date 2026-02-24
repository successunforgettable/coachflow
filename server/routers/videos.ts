/**
 * Video Generation Router
 * 
 * Handles video rendering via Creatomate with ElevenLabs voiceover
 * Credit-based system: 1/2/3 credits based on duration
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { videos, videoScripts, videoCredits, videoCreditTransactions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY!;

// Credit cost based on duration
function getCreditCost(duration: string): number {
  const durationNum = parseInt(duration);
  if (durationNum <= 30) return 1;
  if (durationNum <= 60) return 2;
  return 3; // 90 seconds
}

// Load RenderScript templates
// Use absolute path from project root to avoid path resolution issues
const PROJECT_ROOT = join(__dirname, "../..");
console.log("[Templates] __dirname:", __dirname);
console.log("[Templates] PROJECT_ROOT:", PROJECT_ROOT);
console.log("[Templates] Template path:", join(PROJECT_ROOT, "server/creatomate-templates/kinetic-typography.json"));

const TEMPLATES = {
  kinetic_typography: JSON.parse(
    readFileSync(join(PROJECT_ROOT, "server/creatomate-templates/kinetic-typography.json"), "utf-8")
  ),
  motion_graphics: JSON.parse(
    readFileSync(join(PROJECT_ROOT, "server/creatomate-templates/motion-graphics.json"), "utf-8")
  ),
  stats_card: JSON.parse(
    readFileSync(join(PROJECT_ROOT, "server/creatomate-templates/stats-card.json"), "utf-8")
  ),
};

console.log("[Templates] Loaded successfully:", Object.keys(TEMPLATES));

export const videosRouter = router({
  // Generate video from script
  generate: protectedProcedure
    .input(
      z.object({
        scriptId: z.number(),
        visualStyle: z.enum(["kinetic_typography", "motion_graphics", "stats_card"]),
        brandColor: z.string().optional().default("#3B82F6"),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get script
      const [script] = await db
        .select()
        .from(videoScripts)
        .where(eq(videoScripts.id, input.scriptId))
        .limit(1);

      if (!script) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Script not found",
        });
      }

      // Check if user owns the script
      if (script.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to use this script",
        });
      }

      // Calculate credit cost
      const creditCost = getCreditCost(script.duration);

      // Check credit balance
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [creditBalance] = await db
        .select()
        .from(videoCredits)
        .where(eq(videoCredits.userId, ctx.user.id))
        .limit(1);

      if (!creditBalance || creditBalance.balance < creditCost) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Insufficient credits. This video requires ${creditCost} credit${creditCost > 1 ? "s" : ""}, but you have ${creditBalance?.balance || 0}.`,
        });
      }

      // Deduct credits BEFORE rendering
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .update(videoCredits)
        .set({
          balance: creditBalance.balance - creditCost,
          updatedAt: new Date(),
        })
        .where(eq(videoCredits.userId, ctx.user.id));

      // Record transaction
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(videoCreditTransactions).values({
        userId: ctx.user.id,
        type: "deduction",
        amount: -creditCost,
        balanceAfter: creditBalance.balance - creditCost,
        description: `Video generation (${script.duration}s, ${input.visualStyle})`,
      });

      // Create video record
      const [newVideo] = await db.insert(videos).values({
        userId: ctx.user.id,
        scriptId: input.scriptId,
        serviceId: script.serviceId,
        videoType: script.videoType,
        duration: script.duration,
        visualStyle: input.visualStyle,
        creatomateStatus: "queued",
        creditsUsed: creditCost,
      });

      const videoId = newVideo.insertId;

      // Start async rendering (don't await)
      renderVideo({
        videoId,
        script,
        visualStyle: input.visualStyle,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl,
        userId: ctx.user.id,
        creditCost,
        originalBalance: creditBalance.balance,
      }).catch(async (error) => {
        console.error(`[Video ${videoId}] Render failed:`, error);

        // Refund credits on failure
        const db = await getDb();
        if (!db) return;
        await db
          .update(videoCredits)
          .set({
            balance: creditBalance.balance, // Restore original balance
            updatedAt: new Date(),
          })
          .where(eq(videoCredits.userId, ctx.user.id));

        // Record refund transaction
        if (!db) return;
        await db.insert(videoCreditTransactions).values({
          userId: ctx.user.id,
          amount: creditCost,
          type: "refund",
          description: `Refund for failed video generation`,
          balanceAfter: creditBalance.balance,
        });

        // Update video status
        await db
          .update(videos)
          .set({
            creatomateStatus: "failed",
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      });

      return {
        videoId,
        status: "queued",
        creditCost,
      };
    }),

  // Get video by ID
  getById: protectedProcedure
    .input(z.object({ videoId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, input.videoId))
        .limit(1);

      if (!video) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      if (video.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this video",
        });
      }

      return video;
    }),

  // List user's videos
  list: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        status: z.enum(["queued", "rendering", "succeeded", "failed"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const results = await db
        .select()
        .from(videos)
        .where(eq(videos.userId, ctx.user.id))
        .orderBy(desc(videos.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Filter in memory if needed (serviceId, status)
      let filtered = results;
      if (input.serviceId) {
        filtered = filtered.filter((v) => v.serviceId === input.serviceId);
      }
      if (input.status) {
        filtered = filtered.filter((v) => v.creatomateStatus === input.status);
      }

      return filtered;
    }),

  // Delete video
  delete: protectedProcedure
    .input(z.object({ videoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, input.videoId))
        .limit(1);

      if (!video) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      if (video.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this video",
        });
      }

      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.delete(videos).where(eq(videos.id, input.videoId));

      return { success: true };
    }),
});

/**
 * Async video rendering function
 * Calls Creatomate API with RenderScript + ElevenLabs voiceover
 */
async function renderVideo(params: {
  videoId: number;
  script: any;
  visualStyle: string;
  brandColor: string;
  logoUrl?: string;
  userId: number;
  creditCost: number;
  originalBalance: number;
}) {
  const { videoId, script, visualStyle, brandColor, logoUrl, userId, creditCost, originalBalance } = params;

  console.log(`[Video ${videoId}] Starting render...`);

  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Update status to rendering
  await db
    .update(videos)
    .set({
      creatomateStatus: "rendering",
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  // Get template RenderScript
  const template = TEMPLATES[visualStyle as keyof typeof TEMPLATES];
  if (!template) {
    throw new Error(`Template not found: ${visualStyle}`);
  }

  // Get script scenes (already parsed from database)
  const scenes = script.scenes || [];
  console.log(`[Video ${videoId}] Scenes data:`, JSON.stringify(scenes, null, 2));

  // Calculate cumulative time for each scene
  let cumulativeTime = 0;
  const sceneTimes: number[] = [];
  scenes.forEach((scene: any) => {
    sceneTimes.push(cumulativeTime);
    cumulativeTime += scene.duration || 0;
  });
  console.log(`[Video ${videoId}] Scene times:`, sceneTimes);

  // Build modifications for Creatomate
  const modifications: any = {
    ...template,
    elements: template.elements.map((element: any) => {
      // Replace voiceover with ElevenLabs AI generation
      if (element.type === "audio" && element.name === "Voiceover") {
        return {
          ...element,
          source: null, // Remove source URL
          audio_ai_provider: "elevenlabs",
          audio_ai_voice: "Rachel", // Default voice, can be customized
          audio_ai_text: scenes.map((s: any) => s.voiceoverText).join(" "), // Full voiceover script
        };
      }

      // Replace logo URL or remove logo element if no URL provided
      if (element.name === "Logo") {
        if (logoUrl) {
          return {
            ...element,
            source: logoUrl,
          };
        } else {
          // Remove logo element by setting it to null (will be filtered out)
          return null;
        }
      }

      // Replace brand color
      if (element.fill_color === "{{brand_color}}") {
        return {
          ...element,
          fill_color: brandColor,
        };
      }

      // Replace scene texts in compositions
      if (element.type === "composition") {
        const sceneName = element.name; // e.g., "Scene1"
        const sceneIndex = parseInt(sceneName.replace("Scene", "")) - 1;
        const sceneData = scenes[sceneIndex];
        
        return {
          ...element,
          time: sceneTimes[sceneIndex] || 0, // Set cumulative start time
          duration: sceneData?.duration || element.duration, // Set scene duration from database
          elements: element.elements.map((child: any) => {
            // Use sceneData from parent scope

            if (child.name?.includes("Text") && sceneData) {
              return {
                ...child,
                text: sceneData.onScreenText, // Use onScreenText from database schema
                fill_color: child.fill_color === "{{brand_color}}" ? brandColor : child.fill_color,
              };
            }

            return child;
          }),
        };
      }

      return element;
    }).filter((element: any) => element !== null), // Remove null elements (e.g., logo when no URL)
  };

  // Debug: Log the final modifications being sent
  console.log(`[Video ${videoId}] Final modifications:`, JSON.stringify(modifications, null, 2));

  // Call Creatomate API
  const response = await fetch("https://api.creatomate.com/v2/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CREATOMATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(modifications), // Send RenderScript directly (v2 API format)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Creatomate API error: ${error}`);
  }

  const renderData = await response.json();
  console.log(`[Video ${videoId}] Creatomate response:`, JSON.stringify(renderData, null, 2));
  
  // Creatomate returns an array of render objects
  const render = Array.isArray(renderData) ? renderData[0] : renderData;
  const renderId = render.id;

  console.log(`[Video ${videoId}] Render started: ${renderId}`);

  // Save render ID
  if (!db) throw new Error("Database connection lost");
  await db
    .update(videos)
    .set({
      creatomateRenderId: renderId,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s intervals)

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    const statusResponse = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: {
        Authorization: `Bearer ${CREATOMATE_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check render status`);
    }

    const statusData = await statusResponse.json();

    if (statusData.status === "succeeded") {
      console.log(`[Video ${videoId}] Render completed!`);

      // Update video record
      if (!db) throw new Error("Database connection lost");
      await db
        .update(videos)
        .set({
          creatomateStatus: "succeeded",
          videoUrl: statusData.url,
          thumbnailUrl: statusData.snapshot_url,
          fileSize: statusData.file_size,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId));

      return;
    }

    if (statusData.status === "failed") {
      throw new Error(`Render failed: ${statusData.error_message || "Unknown error"}`);
    }

    attempts++;
  }

  throw new Error("Render timeout: Video took too long to process");
}
