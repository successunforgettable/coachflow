/**
 * Voiceover generation using Forge API (ElevenLabs wrapper)
 * Generates single continuous voiceover file for entire video script
 */

import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

export type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

/**
 * Generate voiceover audio from text using Forge API
 * 
 * @param text - Full voiceover script text
 * @param voice - Voice to use (default: alloy)
 * @returns Audio buffer (MP3 format)
 */
export async function generateVoiceover(
  text: string,
  voice: Voice = "alloy"
): Promise<Buffer> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Voiceover service is not configured'
    });
  }

  if (!text || text.trim().length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Voiceover text cannot be empty'
    });
  }

  console.log(`[Voiceover] Generating audio: ${text.length} characters, voice: ${voice}`);

  try {
    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;
    
    const fullUrl = new URL("v1/audio/speech", baseUrl).toString();

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENV.forgeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice,
        input: text,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[Voiceover] API error: ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Voiceover generation failed: ${response.statusText}`
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Validate audio size (should be > 10KB for real audio)
    if (audioBuffer.length < 10000) {
      console.error(`[Voiceover] Generated audio is too small: ${audioBuffer.length} bytes`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Generated audio file is too small, generation may have failed'
      });
    }

    console.log(`[Voiceover] Generated successfully: ${audioBuffer.length} bytes`);
    return audioBuffer;

  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error('[Voiceover] Generation failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Voiceover generation failed',
      cause: error
    });
  }
}

/**
 * Upload voiceover audio to S3
 * 
 * @param audioBuffer - MP3 audio buffer
 * @param videoId - Video ID for filename
 * @returns Public S3 URL
 */
export async function uploadVoiceover(
  audioBuffer: Buffer,
  videoId: number
): Promise<string> {
  try {
    // Generate unique filename with timestamp to avoid collisions
    const filename = `voiceovers/${videoId}-${Date.now()}.mp3`;
    
    console.log(`[Voiceover] Uploading to S3: ${filename}`);

    const { url } = await storagePut(
      filename,
      audioBuffer,
      "audio/mpeg"
    );

    console.log(`[Voiceover] Uploaded successfully: ${url}`);
    return url;

  } catch (error) {
    console.error('[Voiceover] S3 upload failed:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to upload voiceover to storage',
      cause: error
    });
  }
}

/**
 * Get default voice for service type
 * 
 * @param serviceType - Type of service (explainer, testimonial, etc.)
 * @returns Recommended voice
 */
export function getDefaultVoice(serviceType?: string): Voice {
  const voiceMap: Record<string, Voice> = {
    'explainer': 'alloy',      // Neutral, professional
    'testimonial': 'nova',     // Warm, friendly
    'proof_results': 'onyx',   // Authoritative, confident
    'mechanism_reveal': 'fable' // Engaging, storytelling
  };

  return voiceMap[serviceType || ''] || 'alloy';
}

/**
 * Complete voiceover pipeline: generate + upload
 * 
 * @param text - Full voiceover script
 * @param videoId - Video ID
 * @param voice - Voice to use (optional)
 * @returns Public S3 URL of voiceover audio
 */
export async function generateAndUploadVoiceover(
  text: string,
  videoId: number,
  voice: Voice = "alloy"
): Promise<string> {
  console.log(`[Voiceover] Starting pipeline for video ${videoId}`);
  
  // Step 1: Generate audio
  const audioBuffer = await generateVoiceover(text, voice);
  
  // Step 2: Upload to S3
  const url = await uploadVoiceover(audioBuffer, videoId);
  
  console.log(`[Voiceover] Pipeline complete for video ${videoId}: ${url}`);
  return url;
}
