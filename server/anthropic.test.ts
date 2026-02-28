import { describe, it, expect } from "vitest";

describe("Anthropic API Key Validation", () => {
  it("should authenticate successfully with the Anthropic API", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    expect(apiKey, "ANTHROPIC_API_KEY must be set").toBeTruthy();
    expect(apiKey!.startsWith("sk-ant-"), "Key should start with sk-ant-").toBe(true);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });

    expect(response.status, `Expected 200 but got ${response.status}`).toBe(200);
    const data = await response.json() as any;
    expect(data.content?.[0]?.text).toBeTruthy();
    console.log("✅ Anthropic API key valid. Response:", data.content?.[0]?.text);
  });
});
