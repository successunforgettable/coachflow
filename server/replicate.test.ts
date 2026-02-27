import { describe, it, expect } from "vitest";
import Replicate from "replicate";

describe("Replicate API", () => {
  it("should authenticate successfully with API key", async () => {
    const apiKey = process.env.REPLICATE_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^r8_/);

    const replicate = new Replicate({ auth: apiKey });
    
    // Test authentication by listing models (lightweight API call)
    const models = await replicate.models.list();
    expect(models).toBeDefined();
    expect(Array.isArray(models.results)).toBe(true);
  }, 30000); // 30 second timeout for API call
});
