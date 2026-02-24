import { describe, it, expect } from "vitest";

describe("Creatomate API Key Validation", () => {
  it("should validate Creatomate API key by fetching account info", async () => {
    const apiKey = process.env.CREATOMATE_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();

    // Test API key by fetching templates (lightweight endpoint)
    const response = await fetch("https://api.creatomate.com/v1/templates", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
    console.log(`✅ Creatomate API key valid. Account has ${data.length || 0} templates.`);
  }, 15000); // 15 second timeout for API call
});
