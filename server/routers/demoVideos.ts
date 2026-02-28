import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { demoVideos } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import Creatomate from "creatomate";

// Hardcoded 5-scene ZAP demo script from directive
const ZAP_DEMO_SCENES = [
  {
    duration: 5,
    onScreenText: "TRIED ADS BEFORE?",
    voiceoverText: "You've tried ads before. Spent thousands. Got nothing.",
  },
  {
    duration: 7,
    onScreenText: "WRONG APPROACH",
    voiceoverText: "It wasn't your offer. It wasn't your niche. It was the approach.",
  },
  {
    duration: 10,
    onScreenText: "ZAP CHANGES EVERYTHING",
    voiceoverText:
      "ZAP changes everything. We don't guess. We don't test. We deploy proven campaigns that already convert.",
  },
  {
    duration: 5,
    onScreenText: "YOUR NEXT CLIENT",
    voiceoverText: "Your next client is one campaign away.",
  },
  {
    duration: 3,
    onScreenText: "ZAPCAMPAIGNS.COM",
    voiceoverText: "ZAP Campaigns dot com.",
    subtext: "zapcampaigns.com",
  },
];

export const demoVideosRouter = router({
  // Generate demo video
  generateDemoVideo: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();

    if (!db) {
      throw new Error("Database not available");
    }

    // Create demo video record — MySQL doesn't support .returning(), use $returningId
    const result: any = await db
      .insert(demoVideos)
      .values({
        userId: ctx.user.id,
        creatomateStatus: "queued",
      });

    const insertId = result[0].insertId;
    const [demoVideo] = await db.select().from(demoVideos).where(eq(demoVideos.id, insertId)).limit(1);

    try {
      // Initialize Creatomate client
      const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY!);

      // Calculate total duration
      const totalDuration = ZAP_DEMO_SCENES.reduce((sum, scene) => sum + scene.duration, 0);

      // Build text elements for each scene
      let currentTime = 0;
      const textElements: any[] = [];

      for (const scene of ZAP_DEMO_SCENES) {
        // Main on-screen text with word-by-word animation
        textElements.push(
          new Creatomate.Text({
            track: 1,
            time: currentTime,
            duration: scene.duration,
            text: scene.onScreenText,
            fontFamily: "Montserrat",
            fontWeight: "900", // Black
            fontSize: "15vmin",
            fillColor: "#ffffff",
            width: "90%",
            height: "auto",
            x: "50%",
            y: "50%",
            xAlignment: "50%",
            yAlignment: "50%",
            xAnchor: "50%",
            yAnchor: "50%",
            // Word-by-word animation using TextSlide with split: 'word'
            enter: new Creatomate.TextSlide({
              duration: 0.8,
              easing: "quadratic-out",
              split: "word", // ← This is the native solution
              scope: "element",
              backgroundEffect: "scaling-clip",
            }),
          })
        );

        // Subtext for scene 5 (zapcampaigns.com)
        if (scene.subtext) {
          textElements.push(
            new Creatomate.Text({
              track: 2,
              time: currentTime,
              duration: scene.duration,
              text: scene.subtext,
              fontFamily: "Montserrat",
              fontWeight: "400",
              fontSize: "5vmin",
              fillColor: "#FF6B35", // Brand color
              width: "90%",
              height: "auto",
              x: "50%",
              y: "65%",
              xAlignment: "50%",
              yAlignment: "50%",
              xAnchor: "50%",
              yAnchor: "50%",
              enter: new Creatomate.Fade({
                duration: 0.6,
                easing: "quadratic-out",
              }),
            })
          );
        }

        currentTime += scene.duration;
      }

      // Build voiceover text (concatenate all scenes)
      const voiceoverText = ZAP_DEMO_SCENES.map((s) => s.voiceoverText).join(" ");

      // Create the source with proper audio pipeline
      // Use a plain dark background color instead of gradient (gradient requires different API)
      const source = new Creatomate.Source({
        outputFormat: "mp4",
        width: 1080,
        height: 1920,
        frameRate: 30,
        duration: totalDuration,

        elements: [
          // Background — solid dark color (gradient not supported via fillColor array)
          new Creatomate.Shape({
            track: 0,
            time: 0,
            duration: totalDuration,
            path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
            x: "50%",
            y: "50%",
            width: "100%",
            height: "100%",
            fillColor: "#0d0d0d",
          }),

          // Text elements
          ...textElements,

          // Voiceover audio (ElevenLabs with Josh voice)
          // source must be a URL string for Creatomate Audio; use transcript_source for AI TTS
          new Creatomate.Audio({
            track: 10,
            // Use transcript_source for AI-generated speech
            transcriptSource: "voiceover",
            volume: "100%",
          } as any),
        ],
      });

      // Render the video
      console.log(`[DemoVideo ${demoVideo.id}] Starting Creatomate render...`);
      const renders = await client.render({ source });
      const render = renders[0];

      console.log(`[DemoVideo ${demoVideo.id}] Creatomate render started: ${render.id}`);

      await db
        .update(demoVideos)
        .set({
          creatomateRenderId: render.id,
          creatomateStatus: "rendering",
        })
        .where(eq(demoVideos.id, demoVideo.id));

      return {
        success: true,
        demoVideoId: demoVideo.id,
      };
    } catch (error: any) {
      console.error(`[DemoVideo ${demoVideo.id}] Error:`, error);

      await db
        .update(demoVideos)
        .set({
          creatomateStatus: "failed",
          errorMessage: error.message || "Unknown error",
        })
        .where(eq(demoVideos.id, demoVideo.id));

      throw error;
    }
  }),

  // Check status of demo video render
  checkStatus: protectedProcedure
    .input(z.object({ demoVideoId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      if (!db) {
        throw new Error("Database not available");
      }

      // Get demo video from database using select (db.query not available without relations config)
      const [demoVideo] = await db
        .select()
        .from(demoVideos)
        .where(eq(demoVideos.id, input.demoVideoId))
        .limit(1);

      if (!demoVideo) {
        throw new Error("Demo video not found");
      }

      if (demoVideo.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      if (!demoVideo.creatomateRenderId) {
        throw new Error("No render ID found");
      }

      // Poll Creatomate for render status
      const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY!);
      const render = await client.fetchRender(demoVideo.creatomateRenderId);

      console.log(`[DemoVideo ${demoVideo.id}] Creatomate status: ${render.status}`);

      // Map Creatomate status to our database enum
      let dbStatus: "queued" | "rendering" | "succeeded" | "failed" = "rendering";
      if (render.status === "succeeded") {
        dbStatus = "succeeded";
      } else if (render.status === "failed") {
        dbStatus = "failed";
      }

      // Update database
      await db
        .update(demoVideos)
        .set({
          creatomateStatus: dbStatus,
          videoUrl: render.url || null,
          errorMessage: render.errorMessage || null,
        })
        .where(eq(demoVideos.id, demoVideo.id));

      return {
        success: true,
        status: dbStatus,
        videoUrl: render.url,
        errorMessage: render.errorMessage,
      };
    }),

  // Get demo video by ID
  getDemoVideo: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();

      if (!db) {
        throw new Error("Database not available");
      }

      const [demoVideo] = await db
        .select()
        .from(demoVideos)
        .where(eq(demoVideos.id, input.id))
        .limit(1);

      if (!demoVideo) {
        throw new Error("Demo video not found");
      }

      if (demoVideo.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      return demoVideo;
    }),

  // List all demo videos for current user
  listDemoVideos: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    if (!db) {
      throw new Error("Database not available");
    }

    const videos = await db
      .select()
      .from(demoVideos)
      .where(eq(demoVideos.userId, ctx.user.id))
      .orderBy(demoVideos.createdAt);

    return videos;
  }),
});
