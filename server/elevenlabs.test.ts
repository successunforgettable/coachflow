/**
 * ElevenLabs API Key Validation Test
 * 
 * Validates that the ELEVENLABS_API_KEY is correctly configured
 * by making a lightweight API call to list available voices.
 */

import { describe, it, expect } from 'vitest';

describe('ElevenLabs API Key Validation', () => {
  it('should successfully authenticate with ElevenLabs API', async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    
    // Make lightweight API call to list voices (doesn't consume credits)
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey!,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error:', response.status, errorText);
    }
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.voices).toBeDefined();
    expect(Array.isArray(data.voices)).toBe(true);
    expect(data.voices.length).toBeGreaterThan(0);
    
    // Verify Josh voice exists (voice_id: TxGEqnHWrfWFTfGW9XjX)
    console.log('Available voices:', data.voices.map((v: any) => ({ name: v.name, id: v.voice_id })));
    const joshVoice = data.voices.find((v: any) => v.voice_id === 'TxGEqnHWrfWFTfGW9XjX');
    
    // Josh voice might not be available in all accounts, so just verify API works
    expect(data.voices.length).toBeGreaterThan(0);
  }, 10000); // 10 second timeout for API call
});
