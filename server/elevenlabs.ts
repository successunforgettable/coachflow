/**
 * ElevenLabs Text-to-Speech Integration
 * 
 * Generates professional voiceovers for video ads using ElevenLabs API.
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

// Voice IDs - using Charlie (Deep, Confident, Energetic)
export const VOICE_IDS = {
  charlie: 'IKne3meq5aSn9XLyUdCD', // Deep, Confident, Energetic
  sarah: 'EXAVITQu4vr4xnSDxMaL',   // Mature, Reassuring, Confident
  liam: 'TX3LPaxmHKxFdv7VOQHJ',    // Energetic, Social Media Creator
} as const;

export interface VoiceoverOptions {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

/**
 * Generate voiceover audio from text using ElevenLabs API
 * Retries up to 3 times on transient network errors (ECONNRESET, fetch failed).
 * 
 * @param options - Voiceover generation options
 * @returns MP3 audio buffer
 */
export async function generateVoiceover(options: VoiceoverOptions): Promise<Buffer> {
  const {
    text,
    voiceId = VOICE_IDS.charlie,
    stability = 0.25,
    similarityBoost = 0.75,
    style = 0.65,
    useSpeakerBoost = true,
  } = options;

  console.log(`[ElevenLabs] Generating voiceover (${text.length} chars) with voice ${voiceId}`);

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability,
              similarity_boost: similarityBoost,
              style,
              use_speaker_boost: useSpeakerBoost,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API failed: ${response.status} ${errorText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`[ElevenLabs] Generated audio: ${audioBuffer.length} bytes (attempt ${attempt})`);
      return audioBuffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      const isRetryable =
        msg.includes('econnreset') ||
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('socket') ||
        msg.includes('tls') ||
        msg.includes('connection') ||
        msg.includes('service_unavailable') ||
        msg.includes('something went wrong') ||
        msg.includes('500') ||
        msg.includes('503');
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = attempt * 2000; // 2s, 4s
        console.warn(`[ElevenLabs] Attempt ${attempt} failed (${lastError.message}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError!;
}
