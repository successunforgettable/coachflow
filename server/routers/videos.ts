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
import { eq, desc, and } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { searchPexelsVideos, selectBestHDVideo, extractKeywords } from "../pexels";
import { fetchSceneFootageWithFallback, fetchMultipleClipsForScene } from "../pexels-scene-fetcher";
import { generateVoiceover, VOICE_IDS } from "../elevenlabs";
import { storagePut } from "../storage";
import * as mm from 'music-metadata';
import { buildScriptPrompt } from "./videoScripts";
import { services } from "../../drizzle/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY!;
const BACKGROUND_MUSIC_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026750612/jQsGzEaS9E2xgaK8jEKUPB/video-assets/background-music.mp3";

// Credit cost based on duration
function getCreditCost(duration: string): number {
  const durationNum = parseInt(duration);
  if (durationNum <= 30) return 1;
  if (durationNum <= 60) return 2;
  return 3; // 90 seconds
}

// Load RenderScript templates
// Inline templates to avoid file system path issues in production
const TEMPLATES = {
  text_only: {
    "canvas": { "width": 1920, "height": 1080, "color": "#000000" },
    "elements": []
  },
  kinetic_typography: {
    "canvas": { "width": 1920, "height": 1080, "color": "#000000" },
    "elements": []
  },
  motion_graphics: {
    "canvas": { "width": 1920, "height": 1080, "color": "#000000" },
    "elements": []
  },
  stats_card: {
    "canvas": { "width": 1920, "height": 1080, "color": "#000000" },
    "elements": []
  },
};

console.log("[Templates] Loaded successfully:", Object.keys(TEMPLATES));

export const videosRouter = router({
  // Generate video from script
  generate: protectedProcedure
    .input(
      z.object({
        scriptId: z.number(),
        visualStyle: z.enum(["text_only", "kinetic_typography", "motion_graphics", "stats_card"]),
        duration: z.enum(["15", "30", "60", "90"]).optional(),
        brandColor: z.string().optional().default("#FF5B1D"),
        logoUrl: z.string().optional(),
        isZapDemo: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[Video Render] Received — visualStyle: ${input.visualStyle}, duration: ${input.duration ?? "not sent"}, brandColor: ${input.brandColor}, scriptId: ${input.scriptId}`);

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

      // Generate video title from script metadata
      const scenes: any[] = Array.isArray(script.scenes) ? script.scenes : [];
      const firstScene = scenes[0] || {};
      const videoAngle = firstScene._angle || script.videoType?.toUpperCase() || "AD";
      const videoNicheWorld = firstScene._nicheWorld || "";
      const videoWordCount = firstScene._wordCount ||
        scenes.reduce((sum: number, s: any) => sum + (s.voiceoverText?.trim().split(/\s+/).length || 0), 0);
      const serviceName = script.serviceId ? "" : "";
      // Fetch service name for title
      const [svcForTitle] = await db.select({ name: services.name }).from(services).where(eq(services.id, script.serviceId)).limit(1);
      const titleServiceName = svcForTitle?.name || "Video";
      const videoTitle = `${titleServiceName} — ${videoAngle} Ad (${scenes.length} scenes, ${videoWordCount} words)`;
      console.log(`[Video] Generated title: "${videoTitle}"`);

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
        title: videoTitle,
        angle: videoAngle,
        nicheWorld: videoNicheWorld || null,
        wordCount: videoWordCount,
      });

      const videoId = newVideo.insertId;
      
      // Trigger async render (non-blocking)
      renderVideo({
        videoId: newVideo.insertId,
        script,
        visualStyle: input.visualStyle,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl,
        userId: ctx.user.id,
        creditCost,
        originalBalance: creditBalance.balance,
        isZapDemo: input.isZapDemo,
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

  // Regenerate a single failed/errored video by ID (no credit charge)
  regenerateSingle: protectedProcedure
    .input(z.object({ videoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Fetch the existing video record
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, input.videoId))
        .limit(1);

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Video not found" });
      }

      if (video.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to regenerate this video" });
      }

      // Fetch the associated script
      const [script] = await db
        .select()
        .from(videoScripts)
        .where(eq(videoScripts.id, video.scriptId))
        .limit(1);

      if (!script) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Associated script not found" });
      }

      // Re-generate the script via buildScriptPrompt so every Regen uses a fresh ZAP script
      let freshScript = script;
      try {
        const [service] = await db
          .select()
          .from(services)
          .where(eq(services.id, script.serviceId!))
          .limit(1);

        if (service) {
          console.log(`[Video ${input.videoId}] Re-generating script via buildScriptPrompt for: ${service.name}`);
          const prompt = buildScriptPrompt(
            script.videoType as any,
            parseInt(script.duration),
            service
          );
          const { invokeLLM } = await import("../_core/llm.js");
          const response = await invokeLLM({
            messages: [{ role: "user", content: prompt }],
            maxTokens: 2000,
          });
          const rawContent = response.choices[0]?.message?.content;
          if (rawContent && typeof rawContent === "string") {
            const cleaned = rawContent.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.scenes && parsed.scenes.length >= 3) {
              const voiceoverTextFull = parsed.scenes.map((s: any) => s.voiceoverText ?? "").join(" ");
              // Update the script record with fresh scenes
              await db.update(videoScripts).set({
                scenes: parsed.scenes,
                voiceoverText: voiceoverTextFull,
                updatedAt: new Date(),
              }).where(eq(videoScripts.id, script.id));
              freshScript = { ...script, scenes: parsed.scenes, voiceoverText: voiceoverTextFull };
              console.log(`[Video ${input.videoId}] ✅ Fresh script generated: ${parsed.scenes.length} scenes, angle=${parsed.angle}`);
            }
          }
        }
      } catch (scriptErr) {
        console.warn(`[Video ${input.videoId}] Script re-generation failed, using existing script:`, scriptErr);
        // Fall through — use the existing script
      }

      // Reset video status to queued
      await db
        .update(videos)
        .set({ creatomateStatus: "queued", videoUrl: null, updatedAt: new Date() })
        .where(eq(videos.id, input.videoId));

      // Re-trigger render (non-blocking, no credit deduction)
      renderVideo({
        videoId: input.videoId,
        script: freshScript,
        visualStyle: video.visualStyle,
        brandColor: "#3B82F6",
        userId: ctx.user.id,
        creditCost: 0, // No credit charge for regeneration
        originalBalance: 0,
      }).catch(async (error) => {
        console.error(`[Video ${input.videoId}] Regen render failed:`, error);
        const db2 = await getDb();
        if (!db2) return;
        await db2.update(videos).set({ creatomateStatus: "failed", updatedAt: new Date() }).where(eq(videos.id, input.videoId));
      });

      return { videoId: input.videoId, status: "queued" };
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

  /**
   * getLatestByServiceId — returns the most recent succeeded video for a service.
   * Used by V2VideoCreator to restore the last result on Tool Library re-open.
   */
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [video] = await db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.userId, ctx.user.id),
            eq(videos.serviceId, input.serviceId),
            eq(videos.creatomateStatus, "succeeded")
          )
        )
        .orderBy(desc(videos.createdAt))
        .limit(1);
      if (!video) return null;
      // Fetch the associated script
      const [script] = video.scriptId
        ? await db
            .select()
            .from(videoScripts)
            .where(eq(videoScripts.id, video.scriptId))
            .limit(1)
        : [];
      return { ...video, script: script ?? null };
    }),
});

// Scene type mapping for Pexels footage queries (25s structure)
const SCENE_TYPE_MAP: Array<'hook' | 'problem' | 'authority' | 'solution' | 'cta'> = [
  'hook',       // Scene 1: 0-3s   — Hook / Pattern Interrupt
  'problem',    // Scene 2: 3-7s   — Problem / Pain
  'authority',  // Scene 3: 7-12s  — Authority / Proof
  'solution',   // Scene 4: 12-18s — Solution / Relief
  'cta',        // Scene 5: 18-25s — CTA / Drive Action
];

/**
 * Get audio duration in seconds from audio buffer
 */
async function getAudioDurationSeconds(audioBuffer: Buffer): Promise<number> {
  try {
    const metadata = await mm.parseBuffer(audioBuffer, 'audio/mpeg');
    return metadata.format.duration ?? 30; // fallback to 30s if detection fails
  } catch (error) {
    console.error('[Audio Duration] Failed to parse audio metadata:', error);
    return 30; // fallback
  }
}

/**
 * Calculate scene durations proportionally based on word counts
 */
export function calculateSceneDurations(
  scenes: any[],
  totalAudioDuration: number
): number[] {
  // Count words per scene — voiceoverText is the canonical field name
  const wordCounts = scenes.map(scene => {
    const text = scene.voiceoverText ?? "";
    return text.trim().split(/\s+/).filter(Boolean).length || 1;
  });
  
  const totalWords = wordCounts.reduce((sum: number, count: number) => sum + count, 0);
  
  // Allocate duration proportionally to word count
  const durations = wordCounts.map(wordCount => {
    const proportion = wordCount / totalWords;
    const rawDuration = proportion * totalAudioDuration;
    // Minimum 2s per scene, round to 1 decimal
    return Math.max(2, Math.round(rawDuration * 10) / 10);
  });

  // Trim/extend last scene so it ends exactly at totalAudioDuration
  const sumWithoutLast = durations.slice(0, -1).reduce((a: number, b: number) => a + b, 0);
  const lastDuration = Math.max(2, Math.round((totalAudioDuration - sumWithoutLast) * 10) / 10);
  durations[durations.length - 1] = lastDuration;

  // Validate: last scene must end exactly at audioDuration
  const lastSceneEnd = durations.reduce((a: number, b: number) => a + b, 0);
  if (Math.abs(lastSceneEnd - totalAudioDuration) > 0.1) {
    console.error(`Last scene ends at ${lastSceneEnd} but audio ends at ${totalAudioDuration} — trimming`);
    durations[durations.length - 1] = Math.max(2, Math.round((totalAudioDuration - sumWithoutLast) * 10) / 10);
  }

  return durations;
}

/**
 * Calculate scene start times from durations
 */
function calculateSceneStartTimes(durations: number[]): number[] {
  const startTimes: number[] = [];
  let currentTime = 0;
  
  for (const duration of durations) {
    startTimes.push(Math.round(currentTime * 10) / 10);
    currentTime += duration;
  }
  
  return startTimes;
}

/**
 * Validate video durations before rendering
 */
function validateVideoDurations(
  scenes: any[],
  sceneDurations: number[],
  totalAudioDuration: number,
  totalVideoDuration: number
): void {
  // Check scene count matches
  if (scenes.length !== sceneDurations.length) {
    throw new Error(`Scene count mismatch: ${scenes.length} scenes but ${sceneDurations.length} durations`);
  }
  
  // Check no scene is impossibly short
  const tooShort = sceneDurations.filter(d => d < 1.5);
  if (tooShort.length > 0) {
    throw new Error(`Scene durations too short: ${tooShort}. Script may be too brief.`);
  }
  
  // Check total video is reasonable
  if (totalVideoDuration < 15 || totalVideoDuration > 120) {
    throw new Error(`Total video duration ${totalVideoDuration}s is outside acceptable range (15-120s)`);
  }
  
  // Check video is longer than audio (must have buffer)
  if (totalVideoDuration < totalAudioDuration) {
    throw new Error(`Video duration ${totalVideoDuration}s is shorter than audio ${totalAudioDuration}s`);
  }
  
  console.log('✅ Duration validation passed');
  console.log(`Audio: ${totalAudioDuration}s | Video: ${totalVideoDuration}s | Buffer: ${(totalVideoDuration - totalAudioDuration).toFixed(1)}s`);
}

/**
 * COMPLETE PIPELINE SEQUENCE — Final Order
 * 
 * 1. Generate script → get scenes[] with voiceoverText per scene
 * 2. Concatenate all voiceover text → single string for ElevenLabs
 * 3. Call ElevenLabs → get audioBuffer
 * 4. Measure audioBuffer duration → totalAudioDuration (seconds)
 * 5. Upload audioBuffer to S3 → voiceoverUrl
 * 6. Calculate sceneDurations[] from totalAudioDuration + word counts
 * 7. Calculate sceneStartTimes[] from sceneDurations[]
 * 8. Calculate totalVideoDuration = last start + last duration + 1s fade
 * 9. Run validateVideoDurations()
 * 10. Fetch Pexels footage for each scene (parallel)
 * 11. Build Creatomate elements using sceneStartTimes + sceneDurations
 * 12. Set source.duration = totalVideoDuration explicitly
 * 13. Call Creatomate render API
 * 14. Return render URL
 * 
 * Render a video using Creatomate
 * Calls Creatomate API with RenderScript + ElevenLabs voiceover
 */
export async function renderVideo(params: {
  videoId: number;
  script: any;
  visualStyle: string;
  brandColor: string;
  logoUrl?: string;
  userId: number;
  creditCost: number;
  originalBalance: number;
  isZapDemo?: boolean;
}) {
  const { videoId, script, visualStyle, brandColor, logoUrl, userId, creditCost, originalBalance, isZapDemo } = params;

  console.log(`[Video ${videoId}] Starting render...`);

  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // ─── REMOTION LAMBDA PATH ────────────────────────────────────────────────
  // If Remotion Lambda is configured, use it instead of Creatomate
  try {
    const { isRemotionConfigured, renderVideoWithRemotion } = await import("../lib/remotionRenderer");
    if (isRemotionConfigured()) {
      console.log(`[Video ${videoId}] Using Remotion Lambda renderer`);

      await db.update(videos).set({ creatomateStatus: "rendering", updatedAt: new Date() }).where(eq(videos.id, videoId));

      const scenes = (script.scenes || []).map((s: any) => ({
        voiceoverText: s.voiceoverText ?? "",
        visualDirection: s.visualDirection ?? "",
        onScreenText: s.onScreenText ?? "",
        pexelsQuery: s.pexelsQuery ?? "",
        footageUrl: s.footageUrl ?? undefined,
      }));

      // Generate voiceover via ElevenLabs (reuse existing pipeline)
      let voiceoverUrl: string | null = null;
      try {
        const fullVoiceoverText = scenes.map((s: any) => s.voiceoverText).join(" ");
        if (fullVoiceoverText.trim()) {
          const { generateVoiceover, VOICE_IDS } = await import("../elevenlabs");
          const voiceoverBuffer = await generateVoiceover({ text: fullVoiceoverText, voiceId: VOICE_IDS.charlie });
          const { storagePut } = await import("../storage");
          const { url } = await storagePut(`voiceovers/video-${videoId}.mp3`, voiceoverBuffer, "audio/mpeg");
          voiceoverUrl = url;
          console.log(`[Video ${videoId}] Voiceover uploaded: ${voiceoverUrl}`);
        }
      } catch (e: any) {
        console.warn(`[Video ${videoId}] Voiceover generation failed, rendering without audio:`, e.message);
      }

      // Fetch stock footage URLs from Pexels for scenes that need them
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].pexelsQuery && !scenes[i].footageUrl) {
          try {
            const { fetchStockFootageWithFallback } = await import("../pixabay.js");
            const footageUrl = await fetchStockFootageWithFallback(scenes[i].pexelsQuery, "portrait", i);
            if (footageUrl) scenes[i].footageUrl = footageUrl;
          } catch (e: any) {
            console.warn(`[Video ${videoId}] Scene ${i + 1} footage fetch failed:`, e.message);
          }
        }
      }

      // Calculate total duration from scene count
      const totalDurationInSeconds = scenes.length * 5; // ~5 seconds per scene

      const { videoUrl } = await renderVideoWithRemotion({
        scenes,
        primaryColor: brandColor || "#FF5B1D",
        coachName: "", // TODO: pass from user profile
        logoUrl: logoUrl || null,
        voiceoverUrl,
        totalDurationInSeconds,
      });

      await db.update(videos).set({
        videoUrl,
        creatomateStatus: "succeeded",
        updatedAt: new Date(),
      }).where(eq(videos.id, videoId));

      console.log(`[Video ${videoId}] Remotion render COMPLETE: ${videoUrl}`);
      return;
    }
  } catch (remotionError: any) {
    console.warn(`[Video ${videoId}] Remotion Lambda not available, falling back to Creatomate:`, remotionError.message);
  }
  // ─── END REMOTION PATH ───────────────────────────────────────────────────

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

  // ✅ Always use the live ZAP-generated script — no hardcoded bypass
  const scenes = script.scenes || [];
  console.log(`[Video ${videoId}] ✅ Using ZAP-generated script (${scenes.length} scenes)`);
  console.log(`[Video ${videoId}] Scenes data:`, JSON.stringify(scenes, null, 2));

  // STEP 2: Concatenate all voiceover text
  console.log(`[Video ${videoId}] Concatenating voiceover text...`);
  const fullVoiceoverText = scenes.map((s: any) => s.voiceoverText ?? "").join(" ");
  
  // STEP 3: Call ElevenLabs to generate voiceover audio
  console.log(`[Video ${videoId}] Generating voiceover with ElevenLabs... (${fullVoiceoverText.length} chars)`);
  let voiceoverBuffer: Buffer;
  try {
    voiceoverBuffer = await generateVoiceover({
      text: fullVoiceoverText,
      voiceId: VOICE_IDS.charlie,
    });
    console.log(`[Video ${videoId}] ElevenLabs SUCCESS — ${voiceoverBuffer.length} bytes`);
  } catch (e: any) {
    console.error(`[Video ${videoId}] ElevenLabs FAILED:`, e.message || e);
    throw new Error(`ElevenLabs voiceover failed: ${e.message}`);
  }
  
  // STEP 4: Measure audio duration
  console.log(`[Video ${videoId}] Measuring audio duration...`);
  const totalAudioDuration = await getAudioDurationSeconds(voiceoverBuffer);
  console.log(`[Video ${videoId}] Measured audio duration: ${totalAudioDuration}s`);
  
  // STEP 5: Upload audio to Cloudinary
  console.log(`[Video ${videoId}] Uploading voiceover to Cloudinary... (${voiceoverBuffer.length} bytes)`);
  let voiceoverUrl: string;
  try {
    const result = await storagePut(
      `voiceovers/video-${videoId}.mp3`,
      voiceoverBuffer,
      'audio/mpeg'
    );
    voiceoverUrl = result.url;
    console.log(`[Video ${videoId}] Cloudinary upload SUCCESS: ${voiceoverUrl}`);
  } catch (e: any) {
    console.error(`[Video ${videoId}] Cloudinary upload FAILED:`, e.message || e);
    throw new Error(`Audio upload failed: ${e.message}`);
  }
  
  // STEP 6: Calculate scene durations from audio duration + word counts
  console.log(`[Video ${videoId}] Calculating scene durations proportionally...`);
  const sceneDurations = calculateSceneDurations(scenes, totalAudioDuration);
  console.log(`[Video ${videoId}] Scene durations:`, sceneDurations);
  
  // STEP 7: Calculate scene start times
  const sceneStartTimes = calculateSceneStartTimes(sceneDurations);
  console.log(`[Video ${videoId}] Scene start times:`, sceneStartTimes);
  
  // STEP 8: Calculate total video duration
  // totalVideoDuration = audio duration + exactly 5 seconds closing sequence
  const totalVideoDuration = totalAudioDuration + 5;
  console.log(`[Video ${videoId}] Total video duration: ${totalVideoDuration}s`);
  
  // STEP 9: Validate durations
  validateVideoDurations(scenes, sceneDurations, totalAudioDuration, totalVideoDuration);
  
  // STEP 10: Fetch stock footage for each scene from Pexels (parallel fetch)
  console.log(`[Video ${videoId}] Fetching stock footage for ${scenes.length} scenes...`);
  
  // Fetch MULTIPLE clips per scene for b-roll variety (2-3 clips per scene)
  // NOTE: Stagger requests by 300ms each to avoid Pexels concurrent connection throttling
  const sceneFootage = await Promise.all(
    scenes.map(async (scene: any, index: number) => {
      // Stagger requests to avoid hitting Pexels rate limits with concurrent connections
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * 300));
      }
      // If scene has pexelsQuery field, use it directly with fallback
      if (scene.pexelsQuery) {
        const { fetchStockFootageWithFallback } = await import("../pixabay.js");
        const footageUrl = await fetchStockFootageWithFallback(scene.pexelsQuery, 'portrait', index);
        if (!footageUrl) {
          throw new Error(`Pexels fetch failed for scene ${index + 1}: query="${scene.pexelsQuery}" — no footage returned`);
        }
        console.log(`[Video ${videoId}] Scene ${index + 1} (${scene.pexelsQuery}): ✓ ${footageUrl.substring(0, 60)}...`);
        return [footageUrl];
      }
      
      // For regular videos, fetch multiple clips for variety
      const sceneType = SCENE_TYPE_MAP[index];
      if (!sceneType) {
        console.warn(`[Video ${videoId}] Scene ${index + 1}: No scene type mapping`);
        return [];
      }
      
      const clipCount = Math.max(2, Math.min(4, Math.ceil(sceneDurations[index] / 3.5)));
      const clips = await fetchMultipleClipsForScene(sceneType, clipCount);
      if (!clips || clips.length === 0) {
        throw new Error(`Pexels fetch failed for scene ${index + 1}: ${sceneType} — no clips returned`);
      }
      console.log(`[Video ${videoId}] Scene ${index + 1} (${sceneType}): fetched ${clips.length} clips for ${sceneDurations[index]}s scene`);
      return clips;
    })
  );
  
  console.log(`[Video ${videoId}] Footage clip counts per scene:`, sceneFootage.map((clips: string[]) => clips.length));
  
  // Wait 3 seconds for CDN propagation before calling Creatomate
  console.log(`[Video ${videoId}] Waiting 3s for CDN propagation...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log(`[Video ${videoId}] CDN propagation wait complete`);
  
  // STEP 11: Fetch service profile for authority badge (socialProofStat)
  let serviceProfile: { socialProofStat?: string | null } | null = null;
  if (script.serviceId) {
    try {
      const [svc] = await db.select({ socialProofStat: services.socialProofStat }).from(services).where(eq(services.id, script.serviceId)).limit(1);
      serviceProfile = svc || null;
      console.log(`[Video ${videoId}] serviceProfile.socialProofStat:`, serviceProfile?.socialProofStat);
    } catch (e) {
      console.warn(`[Video ${videoId}] Could not fetch serviceProfile:`, e);
    }
  }
  const musicUrl: string | null = BACKGROUND_MUSIC_URL; // Background music enabled

  // ─── UNIVERSAL PIPELINE — all styles, no branches ────────────────────────
  // Build the Creatomate JSON from scratch using the exact spec
  const COLOR_GRADING: Record<string, string> = {
    hook:      "brightness(0.85) saturate(0.7)",
    problem:   "brightness(0.8) saturate(0.6)",
    authority: "brightness(1.0) saturate(0.9)",
    solution:  "brightness(1.1) saturate(1.2)",
    cta:       "brightness(1.15) saturate(1.3)",
  };

  const allElements: any[] = [];

  // ─── SCENES ───────────────────────────────────────────────────────────────
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const sceneType = SCENE_TYPE_MAP[index] || "hook";
    const filter = COLOR_GRADING[sceneType] || "brightness(1) saturate(1)";
    const sceneDur = sceneDurations[index];
    const sceneElements: any[] = [];

    // 2-3 B-roll clips — always, no condition
    const clips: string[] = sceneFootage[index] || [];
    if (clips.length === 0) {
      throw new Error(`Scene ${index + 1} has no footage clips — render aborted. Fix Pexels fetcher.`);
    }
    const clipDuration = Math.round((sceneDur / clips.length) * 100) / 100;

    clips.forEach((url: string, i: number) => {
      const clipStart = Math.round(i * clipDuration * 100) / 100;
      const actualClipDur = i === clips.length - 1
        ? Math.round((sceneDur - clipStart) * 100) / 100
        : clipDuration;

      // Detect gradient fallback strings (not valid video URLs) — NEVER silently fall back
      if (url.startsWith('gradient:')) {
        throw new Error(`Scene ${index + 1} clip ${i + 1} returned a gradient fallback instead of a real video URL — Pexels and Pixabay both failed. Fix the footage fetcher or pexelsQuery.`);
      }

      sceneElements.push({
        type: "video",
        source: url,
        time: clipStart,
        duration: actualClipDur,
        x: "50%",
        y: "50%",
        width: "100%",
        height: "100%",
        fit: "cover",
        muted: true,
        audio_volume: 0,
        trim_start: 0,
        trim_duration: actualClipDur,
        filter,
        animations: [{
          type: "scale",
          time: 0,
          duration: actualClipDur,
          start_scale: i % 2 === 0 ? "100%" : "108%",
          end_scale: i % 2 === 0 ? "108%" : "100%",
          easing: "linear"
        }]
      });
      sceneElements.push({
        type: "shape",
        shape: "rect",
        time: clipStart,
        duration: actualClipDur,
        width: "100%",
        height: "100%",
        fill_color: "rgba(0,0,0,0.45)"
      });
    });

    // Headline text — always, no condition
    sceneElements.push({
      type: "text",
      text: scene.onScreenText || "",
      time: 0,
      duration: sceneDur,
      y: "18%",
      x: "50%",
      width: "88%",
      height: "auto",
      x_alignment: "50%",
      y_alignment: "50%",
      fill_color: "#FFFFFF",
      stroke_color: "#000000",
      stroke_width: "0.8 vmin",
      font_family: "Montserrat",
      font_weight: "900",
      font_size: "9 vmin",
      text_transform: "uppercase",
      animations: [{
        type: "text-slide",
        scope: "word",
        duration: 0.6,
        easing: "quadratic-out",
        direction: "up"
      }]
    });

    // Authority badge — always evaluated, only renders on Scene 3 (index === 2)
    if (index === 2) {
      const statBadge = (serviceProfile?.socialProofStat || "")?.toUpperCase() || null;
      if (statBadge) {
        sceneElements.push({
          type: "text",
          text: statBadge,
          time: 0.5,
          duration: sceneDur - 0.5,
          y: "68%",
          x: "50%",
          width: "80%",
          height: "auto",
          x_alignment: "50%",
          y_alignment: "50%",
          fill_color: "#FFFFFF",
          font_family: "Montserrat",
          font_weight: "800",
          font_size: "5 vmin",
          background_color: "#2563EB",
          background_x_padding: "35%",
          background_y_padding: "22%",
          background_border_radius: "50%",
          animations: [{
            type: "scale",
            time: 0,
            duration: 0.4,
            start_scale: "0%",
            end_scale: "100%",
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)"
          }]
        });
      }
    }

    allElements.push({
      name: `Scene${index + 1}`,
      type: "composition",
      time: sceneStartTimes[index],
      duration: sceneDur,
      elements: sceneElements
    });
  }

  // ─── VOICEOVER — named so transcript_source can reference it ──────────────
  allElements.push({
    name: "MainVoiceover",
    type: "audio",
    source: voiceoverUrl,
    time: 0,
    duration: totalAudioDuration,
    audio_volume: 100
  });

  // ─── BACKGROUND MUSIC ─────────────────────────────────────────────────────
  if (musicUrl) {
    allElements.push({
      type: "audio",
      source: musicUrl,
      time: 0,
      duration: totalVideoDuration,
      audio_volume: 15,
      audio_fade_out: 2
    });
  }

  // ─── AUTO-CAPTIONS — always, references MainVoiceover ─────────────────────
  allElements.push({
    type: "text",
    transcript_source: "MainVoiceover",
    transcript_effect: "highlight",
    transcript_color: "#FFD700",
    transcript_maximum_length: 4,
    time: 0,
    duration: totalAudioDuration,
    y: "82%",
    x: "50%",
    width: "88%",
    height: "20%",
    x_alignment: "50%",
    y_alignment: "50%",
    fill_color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: "1.2 vmin",
    font_family: "Montserrat",
    font_weight: "800",
    font_size: "6.5 vmin"
  });

  // ─── CLOSING SEQUENCE — always, 5 seconds after voiceover ends ────────────
  const closingStart = totalAudioDuration;

  // Dark overlay fades in
  allElements.push({
    type: "shape",
    shape: "rect",
    time: closingStart,
    duration: 5,
    width: "100%",
    height: "100%",
    fill_color: "rgba(0,0,0,0.95)",
    animations: [{ type: "fade", time: 0, duration: 1, fade_start: 0, fade_end: 100, easing: "quadratic-in-out" }]
  });
  // Brand name
  allElements.push({
    type: "text",
    text: "ZAP CAMPAIGNS",
    time: closingStart + 0.8,
    duration: 3.2,
    y: "38%",
    x: "50%",
    x_alignment: "50%",
    y_alignment: "50%",
    fill_color: "#FFFFFF",
    font_family: "Montserrat",
    font_weight: "900",
    font_size: "10 vmin",
    letter_spacing: "8%",
    animations: [{ type: "fade", time: 0, duration: 0.4, fade_start: 0, fade_end: 100, easing: "quadratic-out" }]
  });
  // URL in gold
  allElements.push({
    type: "text",
    text: "zapcampaigns.com",
    time: closingStart + 1.2,
    duration: 2.8,
    y: "50%",
    x: "50%",
    x_alignment: "50%",
    y_alignment: "50%",
    fill_color: "#FFD700",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "5.5 vmin",
    animations: [{ type: "fade", time: 0, duration: 0.4, fade_start: 0, fade_end: 100, easing: "quadratic-out" }]
  });
  // CTA button
  allElements.push({
    type: "text",
    text: "START FREE TODAY",
    time: closingStart + 2,
    duration: 2,
    y: "63%",
    x: "50%",
    x_alignment: "50%",
    y_alignment: "50%",
    fill_color: "#FFFFFF",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "4.5 vmin",
    background_color: "#1d4ed8",
    background_x_padding: "40%",
    background_y_padding: "25%",
    background_border_radius: "50%",
    animations: [{ type: "scale", time: 0, duration: 0.4, start_scale: "0%", end_scale: "100%", easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }]
  });
  // Final fade to black
  allElements.push({
    type: "shape",
    shape: "rect",
    time: closingStart + 4,
    duration: 1,
    width: "100%",
    height: "100%",
    fill_color: "#000000",
    animations: [{ type: "fade", time: 0, duration: 1, fade_start: 0, fade_end: 100, easing: "quadratic-in" }]
  });

  const modifications: any = {
    output_format: "mp4",
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration: totalVideoDuration,
    elements: allElements
  };


  // Debug: Log the final modifications being sent
  console.log(`[Video ${videoId}] Final modifications:`, JSON.stringify(modifications, null, 2));

  // Write render payload to file for grep verification
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync('/tmp/render_payload.json', JSON.stringify(modifications, null, 2));
    console.log(`[Video ${videoId}] render_payload.json written to /tmp/render_payload.json`);
  } catch (e) {
    console.warn(`[Video ${videoId}] Could not write render_payload.json:`, e);
  }

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

    // Fetch with retry for transient network errors (ECONNRESET, etc.)
    let statusData: any = null;
    let fetchAttempts = 0;
    const maxFetchAttempts = 3;
    while (fetchAttempts < maxFetchAttempts) {
      try {
        const statusResponse = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
          headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
        });
        if (!statusResponse.ok) {
          throw new Error(`Failed to check render status: HTTP ${statusResponse.status}`);
        }
        statusData = await statusResponse.json();
        break; // success
      } catch (fetchErr: any) {
        fetchAttempts++;
        if (fetchAttempts >= maxFetchAttempts) {
          console.warn(`[Video ${videoId}] Status fetch failed after ${maxFetchAttempts} attempts:`, fetchErr?.message);
          // Don't throw — just skip this polling cycle and try again next interval
          break;
        }
        console.warn(`[Video ${videoId}] Status fetch attempt ${fetchAttempts} failed, retrying in 2s:`, fetchErr?.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!statusData) {
      attempts++;
      continue; // Skip this cycle, try again
    }

    if (statusData.status === "succeeded") {
      console.log(`[Video ${videoId}] Render completed! duration=${statusData.duration} output_duration=${statusData.output_duration} keys=${Object.keys(statusData).join(',')}`);

      // Update video record
      if (!db) throw new Error("Database connection lost");
      await db
        .update(videos)
        .set({
          creatomateStatus: "succeeded",
          videoUrl: statusData.url,
          thumbnailUrl: statusData.snapshot_url,
          fileSize: statusData.file_size,
          actualDuration: statusData.duration ? Math.round(statusData.duration) : undefined,
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
