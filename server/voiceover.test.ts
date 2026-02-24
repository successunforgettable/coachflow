import { describe, it, expect } from 'vitest';
import { generateVoiceover, uploadVoiceover, getDefaultVoice, generateAndUploadVoiceover } from './voiceover';

describe('Voiceover Generation', () => {
  it('should get correct default voice for service types', () => {
    expect(getDefaultVoice('explainer')).toBe('alloy');
    expect(getDefaultVoice('testimonial')).toBe('nova');
    expect(getDefaultVoice('proof_results')).toBe('onyx');
    expect(getDefaultVoice('mechanism_reveal')).toBe('fable');
    expect(getDefaultVoice('unknown')).toBe('alloy'); // fallback
    expect(getDefaultVoice()).toBe('alloy'); // undefined fallback
  });

  it('should generate voiceover from text', async () => {
    const text = "This is a test voiceover script for ZAP video creator.";
    const audioBuffer = await generateVoiceover(text, 'alloy');
    
    expect(audioBuffer).toBeInstanceOf(Buffer);
    expect(audioBuffer.length).toBeGreaterThan(10000); // Should be > 10KB
  }, 30000); // 30 second timeout for API call

  it('should reject empty text', async () => {
    await expect(generateVoiceover('', 'alloy')).rejects.toThrow('Voiceover text cannot be empty');
    await expect(generateVoiceover('   ', 'alloy')).rejects.toThrow('Voiceover text cannot be empty');
  });

  it('should upload voiceover to S3', async () => {
    // Generate a small test audio first
    const text = "Test audio for upload.";
    const audioBuffer = await generateVoiceover(text, 'alloy');
    
    const url = await uploadVoiceover(audioBuffer, 999);
    
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('.mp3');
    expect(url).toContain('voiceovers/999-');
  }, 60000); // 60 second timeout for generation + upload

  it('should complete full pipeline', async () => {
    const text = "Complete pipeline test for ZAP video creator.";
    const url = await generateAndUploadVoiceover(text, 1000, 'nova');
    
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('.mp3');
    
    // Verify the file is accessible
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('audio');
  }, 60000);
});
