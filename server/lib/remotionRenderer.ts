/**
 * Remotion Lambda render trigger.
 * Replaces Creatomate for video rendering.
 *
 * Requires these env vars on Railway:
 *   REMOTION_AWS_ACCESS_KEY_ID
 *   REMOTION_AWS_SECRET_ACCESS_KEY
 *   REMOTION_AWS_REGION (default: us-east-1)
 *   REMOTION_FUNCTION_NAME (from `npx remotion lambda functions deploy`)
 *   REMOTION_SERVE_URL (from `npx remotion lambda sites create`)
 *
 * Falls back to Creatomate if REMOTION_FUNCTION_NAME is not set.
 */

import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";

const COMPOSITION_ID = "ZapAdVideo";

interface RemotionRenderInput {
  scenes: Array<{
    voiceoverText: string;
    visualDirection?: string;
    onScreenText?: string;
    pexelsQuery?: string;
    footageUrl?: string;
    durationInSeconds?: number;
  }>;
  primaryColor?: string;
  coachName?: string;
  logoUrl?: string | null;
  voiceoverUrl?: string | null;
  totalDurationInSeconds?: number;
}

interface RemotionRenderResult {
  renderId: string;
  bucketName: string;
}

/**
 * Check if Remotion Lambda is configured
 */
export function isRemotionConfigured(): boolean {
  return !!(
    process.env.REMOTION_FUNCTION_NAME &&
    process.env.REMOTION_SERVE_URL &&
    (process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)
  );
}

/**
 * Trigger a Remotion Lambda render
 */
export async function triggerRemotionRender(
  input: RemotionRenderInput
): Promise<RemotionRenderResult> {
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  const region = (process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || "us-east-1") as any;

  if (!functionName || !serveUrl) {
    throw new Error("Remotion Lambda not configured: REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL required");
  }

  console.log(`[Remotion] Starting render — ${input.scenes.length} scenes, ${input.totalDurationInSeconds || 30}s`);

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: COMPOSITION_ID,
    inputProps: {
      scenes: input.scenes,
      primaryColor: input.primaryColor || "#FF5B1D",
      coachName: input.coachName || "",
      logoUrl: input.logoUrl || null,
      voiceoverUrl: input.voiceoverUrl || null,
      totalDurationInSeconds: input.totalDurationInSeconds || 30,
    },
    codec: "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    privacy: "public",
    downloadBehavior: {
      type: "download",
      fileName: "zap-video.mp4",
    },
  });

  console.log(`[Remotion] Render started — renderId: ${renderId}, bucket: ${bucketName}`);

  return { renderId, bucketName };
}

/**
 * Poll Remotion Lambda render progress until complete
 */
export async function pollRemotionRender(
  renderId: string,
  bucketName: string,
  onProgress?: (percent: number) => void
): Promise<{ videoUrl: string }> {
  const region = (process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || "us-east-1") as any;
  const functionName = process.env.REMOTION_FUNCTION_NAME!;

  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (5s intervals)

  while (attempts < maxAttempts) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      region,
      functionName,
    });

    if (progress.done) {
      const outputFile = progress.outputFile;
      if (!outputFile) {
        throw new Error("Render completed but no output file URL");
      }
      console.log(`[Remotion] Render COMPLETE — ${outputFile}`);
      return { videoUrl: outputFile };
    }

    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.map(e => e.message).join("; ") || "Unknown render error";
      console.error(`[Remotion] Render FAILED:`, errMsg);
      throw new Error(`Remotion render failed: ${errMsg}`);
    }

    const percent = Math.round((progress.overallProgress ?? 0) * 100);
    onProgress?.(percent);

    if (attempts % 6 === 0) {
      console.log(`[Remotion] Progress: ${percent}% (attempt ${attempts}/${maxAttempts})`);
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error("Remotion render timed out after 10 minutes");
}

/**
 * Full render pipeline: trigger + poll until complete
 */
export async function renderVideoWithRemotion(
  input: RemotionRenderInput
): Promise<{ videoUrl: string }> {
  const { renderId, bucketName } = await triggerRemotionRender(input);
  return pollRemotionRender(renderId, bucketName);
}
