import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('Pexels API Integration', () => {
  it('should have PEXELS_API_KEY configured', () => {
    expect(ENV.pexelsApiKey).toBeDefined();
    expect(ENV.pexelsApiKey).not.toBe('');
  });

  it('should successfully call Pexels API with valid key', async () => {
    const response = await fetch(
      'https://api.pexels.com/videos/search?query=nature&per_page=1',
      {
        headers: {
          'Authorization': ENV.pexelsApiKey!
        }
      }
    );

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('videos');
    expect(Array.isArray(data.videos)).toBe(true);
  });
});
