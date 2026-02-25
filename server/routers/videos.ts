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
import { searchPexelsVideos, selectBestHDVideo, extractKeywords } from "../pexels";
import { fetchSceneFootageWithFallback } from "../pexels-scene-fetcher";
import { generateVoiceover, VOICE_IDS } from "../elevenlabs";
import { storagePut } from "../storage";
import * as mm from 'music-metadata';

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
// Use absolute path from project root to avoid path resolution issues
const PROJECT_ROOT = join(__dirname, "../..");
console.log("[Templates] __dirname:", __dirname);
console.log("[Templates] PROJECT_ROOT:", PROJECT_ROOT);
console.log("[Templates] Template path:", join(PROJECT_ROOT, "server/creatomate-templates/kinetic-typography.json"));

const TEMPLATES = {
  text_only: JSON.parse(
    readFileSync(join(PROJECT_ROOT, "server/creatomate-templates/text-only-black.json"), "utf-8")
  ),
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
        visualStyle: z.enum(["text_only", "kinetic_typography", "motion_graphics", "stats_card"]),
        brandColor: z.string().optional().default("#3B82F6"),
        logoUrl: z.string().optional(),
        isZapDemo: z.boolean().optional().default(false),
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
function calculateSceneDurations(
  scenes: any[],
  totalAudioDuration: number
): number[] {
  // Count words per scene
  const wordCounts = scenes.map(scene => 
    scene.voiceoverText.trim().split(/\s+/).length
  );
  
  const totalWords = wordCounts.reduce((sum: number, count: number) => sum + count, 0);
  
  // Allocate duration proportionally to word count
  const durations = wordCounts.map(wordCount => {
    const proportion = wordCount / totalWords;
    const rawDuration = proportion * totalAudioDuration;
    // Minimum 2s per scene, round to 1 decimal
    return Math.max(2, Math.round(rawDuration * 10) / 10);
  });

  // Adjust last scene to include 2s URL display after voiceover ends
  durations[durations.length - 1] += 2;
  
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
async function renderVideo(params: {
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

  // Get script scenes (use hardcoded ZAP demo script if isZapDemo flag is set)
  let scenes;
  if (isZapDemo) {
    const { ZAP_DEMO_SCRIPT } = await import("../zapDemoScript.js");
    scenes = ZAP_DEMO_SCRIPT.scenes;
    console.log(`[Video ${videoId}] Using hardcoded ZAP demo script`);
  } else {
    scenes = script.scenes || [];
  }
  console.log(`[Video ${videoId}] Scenes data:`, JSON.stringify(scenes, null, 2));

  // STEP 2: Concatenate all voiceover text
  console.log(`[Video ${videoId}] Concatenating voiceover text...`);
  const fullVoiceoverText = scenes.map((s: any) => s.voiceoverText).join(" ");
  
  // STEP 3: Call ElevenLabs to generate voiceover audio
  console.log(`[Video ${videoId}] Generating voiceover with ElevenLabs...`);
  const voiceoverBuffer = await generateVoiceover({
    text: fullVoiceoverText,
    voiceId: VOICE_IDS.charlie, // Deep, Confident, Energetic
  });
  
  // STEP 4: Measure audio duration
  console.log(`[Video ${videoId}] Measuring audio duration...`);
  const totalAudioDuration = await getAudioDurationSeconds(voiceoverBuffer);
  console.log(`[Video ${videoId}] Measured audio duration: ${totalAudioDuration}s`);
  
  // STEP 5: Upload audio to S3
  console.log(`[Video ${videoId}] Uploading voiceover to S3...`);
  const { url: voiceoverUrl } = await storagePut(
    `voiceovers/video-${videoId}.mp3`,
    voiceoverBuffer,
    'audio/mpeg'
  );
  console.log(`[Video ${videoId}] Voiceover URL: ${voiceoverUrl}`);
  
  // STEP 6: Calculate scene durations from audio duration + word counts
  console.log(`[Video ${videoId}] Calculating scene durations proportionally...`);
  const sceneDurations = calculateSceneDurations(scenes, totalAudioDuration);
  console.log(`[Video ${videoId}] Scene durations:`, sceneDurations);
  
  // STEP 7: Calculate scene start times
  const sceneStartTimes = calculateSceneStartTimes(sceneDurations);
  console.log(`[Video ${videoId}] Scene start times:`, sceneStartTimes);
  
  // STEP 8: Calculate total video duration
  const totalVideoDuration = 
    sceneStartTimes[sceneStartTimes.length - 1] + 
    sceneDurations[sceneDurations.length - 1] + 
    1; // 1 second fade to black
  console.log(`[Video ${videoId}] Total video duration: ${totalVideoDuration}s`);
  
  // STEP 9: Validate durations
  validateVideoDurations(scenes, sceneDurations, totalAudioDuration, totalVideoDuration);
  
  // STEP 10: Fetch stock footage for each scene from Pexels (parallel fetch)
  console.log(`[Video ${videoId}] Fetching stock footage for ${scenes.length} scenes...`);
  
  const sceneFootage = await Promise.all(
    scenes.map(async (scene: any, index: number) => {
      // If scene has pexelsQuery field, use it directly (ZAP demo or custom scripts)
      if (scene.pexelsQuery) {
        try {
          const { searchPexelsVideos, selectBestHDVideo } = await import("../pexels.js");
          const results = await searchPexelsVideos(scene.pexelsQuery, 'portrait', 5);
          const footageUrl = selectBestHDVideo(results.videos);
          if (footageUrl) {
            console.log(`[Video ${videoId}] Scene ${index + 1} (${scene.pexelsQuery}): ✓ ${footageUrl.substring(0, 60)}...`);
          } else {
            console.warn(`[Video ${videoId}] Scene ${index + 1} (${scene.pexelsQuery}): ✗ No footage found`);
          }
          return footageUrl;
        } catch (error) {
          console.error(`[Video ${videoId}] Scene ${index + 1} (${scene.pexelsQuery}): Error:`, error);
          return null;
        }
      }
      
      // For regular videos, use scene type mapping
      const sceneType = SCENE_TYPE_MAP[index];
      if (!sceneType) {
        console.warn(`[Video ${videoId}] Scene ${index + 1}: No scene type mapping`);
        return null;
      }
      
      try {
        const footageUrl = await fetchSceneFootageWithFallback(sceneType, scene.duration);
        if (footageUrl) {
          console.log(`[Video ${videoId}] Scene ${index + 1} (${sceneType}): ✓ ${footageUrl.substring(0, 60)}...`);
        } else {
          console.warn(`[Video ${videoId}] Scene ${index + 1} (${sceneType}): ✗ No footage found`);
        }
        return footageUrl;
      } catch (error) {
        console.error(`[Video ${videoId}] Scene ${index + 1} (${sceneType}): Error:`, error);
        return null;
      }
    })
  );
  
  console.log(`[Video ${videoId}] Footage URLs:`, sceneFootage);
  
  // Wait 3 seconds for CDN propagation before calling Creatomate
  console.log(`[Video ${videoId}] Waiting 3s for CDN propagation...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log(`[Video ${videoId}] CDN propagation wait complete`);
  
  // STEP 11: Build Creatomate elements using calculated durations

  // Build modifications for Creatomate
  let modifications: any;
  
  // Special handling for text_only template: build RenderScript from scratch
  if (visualStyle === "text_only") {
    console.log(`[Video ${videoId}] Building text_only RenderScript from scratch`);
    
    // Build scene compositions dynamically with 3-layer structure
    const sceneCompositions = scenes.map((scene: any, index: number) => {
      const footageUrl = sceneFootage[index];
      const sceneType = SCENE_TYPE_MAP[index];
      const elements: any[] = [];
      
      // Color grading per scene type (Submagic-style)
      const colorGrading: Record<string, string> = {
        hook: "brightness(0.85) saturate(0.7)",      // Cold, tense
        problem: "brightness(0.85) saturate(0.7)",   // Cold, tense
        authority: "brightness(1.1) saturate(1.2)",  // Warm, energetic
        solution: "brightness(1.1) saturate(1.2)",   // Warm, energetic
        cta: "brightness(1.15) saturate(1.3)",       // Bright, optimistic
      };
      const filter = colorGrading[sceneType] || "brightness(1) saturate(1)";
      
      // LAYER 1: Background video footage (if available)
      if (footageUrl) {
        elements.push({
          type: "video",
          source: footageUrl,
          time: 0,
          duration: sceneDurations[index],
          x: "50%",
          y: "50%",
          width: "100%",
          height: "100%",
          fit: "cover",           // Fill frame, crop edges
          muted: true,            // No original audio from footage
          trim_start: 0,          // Start from beginning of clip
          trim_duration: sceneDurations[index],
          filter,                 // Color grading per scene type
          // Ken Burns zoom effect (Submagic-style)
          animations: [
            {
              time: 0,
              duration: sceneDurations[index],
              type: "scale",
              start_scale: "100%",
              end_scale: "108%",
              easing: "linear"
            }
          ]
        });
        
        // LAYER 2: Dark overlay for text readability
        elements.push({
          type: "shape",
          shape: "rect",
          time: 0,
          duration: sceneDurations[index],
          x: "50%",
          y: "50%",
          width: "100%",
          height: "100%",
          fill_color: "rgba(0, 0, 0, 0.55)", // 55% dark — readable but footage still visible
        });
      }
      
      // LAYER 3: Text (always present)
      elements.push({
        type: "text",
        text: scene.onScreenText,
        font_family: "Montserrat",
        font_weight: "900", // Black weight
        font_size: "10 vmin", // Responsive viewport units - reduced to prevent clipping on longer text
        fill_color: "#ffffff",
        x: "50%",
        y: "50%",
        x_alignment: "50%",
        y_alignment: "50%",
        width: "90%",
        text_align: "center",
        animations: [
          {
            time: 0,
            duration: 0.8,
            type: "text-slide",
            split: "word", // Animate word-by-word
            scope: "element",
            distance: "10%",
            easing: "quadratic-out"
          }
        ]
      });
      
      // LAYER 4: URL display (only in Scene 5, final 3 seconds)
      if (index === scenes.length - 1) {
        // Scene 5 is 10s (18-28s), URL appears at 25s (7s into the scene) and holds for 3s
        elements.push({
          type: "text",
          text: "zapcampaigns.com",
          font_family: "Montserrat",
          font_weight: "700", // Bold
          font_size: "8 vmin",
          fill_color: "#ffffff",
          x: "50%",
          y: "85%",  // Bottom of screen
          x_alignment: "50%",
          y_alignment: "50%",
          width: "80%",
          text_align: "center",
          time: 7,  // 7 seconds into Scene 5 (which starts at 18s, so this is 25s total)
          duration: 3,  // Hold for 3 seconds (25-28s)
          animations: [
            {
              time: 0,
              duration: 0.5,
              type: "fade",
              fade_in: true,
              easing: "quadratic-out"
            }
          ]
        });
      }
      
      const composition: any = {
        type: "composition",
        name: `Scene${index + 1}`,
        track: index + 2, // Track 1 is Main, scenes start at 2
        time: sceneStartTimes[index],
        duration: sceneDurations[index],
        elements
      };
      
      // Add cross-dissolve transition (except first scene)
      if (index > 0) {
        composition.transition = {
          type: "fade",
          duration: 0.3  // 0.3s cross-dissolve
        };
      }
      
      return composition;
    });    modifications = {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30,
      duration: totalVideoDuration,
      elements: [
        {
          type: "composition",
          track: 1,
          time: 0,
          duration: totalVideoDuration,
          name: "Main",
          elements: [
            // Radial gradient background (#1a1a1a center → #000000 edges)
            {
              type: "shape",
              name: "RadialGradientBackground",
              path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
              fill_color: [
                {offset: 0, color: "#1a1a1a"},
                {offset: 1, color: "#000000"}
              ],
              fill_mode: "radial",
              fill_x0: "50%",
              fill_y0: "50%",
              fill_radius: "75%",
              width: "100%",
              height: "100%"
            },
            // Logo (if provided)
            ...(logoUrl ? [{
              type: "image",
              name: "Logo",
              source: logoUrl,
              width: "80 px",
              height: "80 px",
              x: "90%",
              y: "5%",
              x_alignment: "50%",
              y_alignment: "50%",
              animations: [
                {
                  time: 0.5,
                  duration: 0.5,
                  type: "fade",
                  fade_start: 0,
                  fade_end: 100,
                  easing: "linear"
                }
              ]
            }] : []),
            // Voiceover (pre-generated via ElevenLabs, uploaded to S3)
            {
              type: "audio",
              name: "Voiceover",
              source: voiceoverUrl,
              duration: totalAudioDuration,
              audio_volume: 100
            },
            // Background music
            {
              type: "audio",
              name: "BackgroundMusic",
              source: BACKGROUND_MUSIC_URL,
              duration: totalVideoDuration,
              audio_volume: 15,
              audio_fade_out: 2
            }
          ]
        },
        ...sceneCompositions,
        // Fade-to-black outro with URL display
        {
          type: "composition",
          name: "Outro",
          track: scenes.length + 2, // After all scene tracks
          time: totalVideoDuration - 3, // 3 seconds before end
          duration: 3,
          elements: [
            // URL text (visible entire 3 seconds)
            {
              type: "text",
              text: "zapcampaigns.com",
              font_family: "Montserrat",
              font_weight: "700",
              font_size: "8 vmin",
              fill_color: "#ffffff",
              x: "50%",
              y: "50%",
              x_alignment: "50%",
              y_alignment: "50%",
              time: 0,
              duration: 3,
              animations: [
                {
                  time: 0,
                  duration: 0.3,
                  type: "fade",
                  fade_start: 0,
                  fade_end: 100,
                  easing: "quadratic-out"
                }
              ]
            },
            // Fade-to-black overlay (only last 1 second)
            {
              type: "shape",
              shape: "rect",
              time: 2,  // Start at 2s into outro
              duration: 1,
              x: "50%",
              y: "50%",
              width: "100%",
              height: "100%",
              fill_color: "#000000",
              animations: [
                {
                  time: 0,
                  duration: 1,
                  type: "fade",
                  fade_start: 0,
                  fade_end: 100,
                  easing: "quadratic-out"
                }
              ]
            }
          ]
        }
      ]
    };
  } else {
    // Existing template modification logic for other templates
    modifications = {
    ...template,
    elements: template.elements.map((element: any) => {
      // Replace voiceover with ElevenLabs AI generation via Creatomate
      if (element.type === "audio" && element.name === "Voiceover") {
        // Use Creatomate's built-in ElevenLabs integration
        // Voice options:
        // - Rachel (professional female): 21m00Tcm4TlvDq8ikWAM
        // - Antoni (warm male): ErXwobaYiN019PkySvjV
        // - Josh (confident male): TxGEqnHWrfWFTfGW9XjX
        const voiceId = "TxGEqnHWrfWFTfGW9XjX"; // Josh - confident, direct, human
        const fullVoiceoverText = scenes.map((s: any) => s.voiceoverText).join(" ");
        
        return {
          ...element,
          provider: `elevenlabs model_id=eleven_multilingual_v2 voice_id=${voiceId} stability=0.25 similarity_boost=0.75 style=0.65 use_speaker_boost=true`,
          source: fullVoiceoverText, // The text to be spoken
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
        
        // Add video background if stock footage is available
        const footageUrl = sceneFootage[sceneIndex];
        const newElements = [...element.elements];
        
        if (footageUrl) {
          // Add video element as first child (background)
          newElements.unshift({
            type: "video",
            name: `Scene${sceneIndex + 1}Background`,
            source: footageUrl,
            width: "100%",
            height: "100%",
            x: "50%",
            y: "50%",
            x_alignment: "50%",
            y_alignment: "50%",
            fit: "cover", // Cover entire scene area
            loop: true, // Loop if video is shorter than scene
            audio_volume: 0, // Mute background video
          });
          
          // Add dark overlay for better text readability
          newElements.unshift({
            type: "shape",
            name: `Scene${sceneIndex + 1}Overlay`,
            path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
            fill_color: "rgba(0, 0, 0, 0.4)", // 40% black overlay
            width: "100%",
            height: "100%",
          });
        }
        
        return {
          ...element,
          time: sceneStartTimes[sceneIndex] || 0, // Set cumulative start time
          duration: sceneDurations[sceneIndex] || element.duration, // Set scene duration from calculated values
          elements: newElements.map((child: any) => {
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
  }

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
