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
  console.log(`[ElevenLabs] Generated audio: ${audioBuffer.length} bytes`);

  return audioBuffer;
}
