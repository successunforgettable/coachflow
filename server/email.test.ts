/**
 * Validates the Resend API key and email sending functionality
 * Uses Resend's test email address to avoid sending real emails during tests
 */
import { describe, it, expect } from "vitest";
import { Resend } from "resend";

describe("Resend Email Integration", () => {
  it("should have a valid RESEND_API_KEY configured", () => {
    const key = process.env.RESEND_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(typeof key).toBe("string");
    // Resend API keys start with 're_'
    expect(key!.startsWith("re_")).toBe(true);
  });

  it("should successfully send a test email via Resend API", async () => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Resend provides 'delivered@resend.dev' as a test address that always succeeds
    const { data, error } = await resend.emails.send({
      from: "ZAP <onboarding@resend.dev>",
      to: "delivered@resend.dev",
      subject: "ZAP Resend Integration Test",
      html: "<p>This is a test email to verify the Resend API key is working correctly.</p>",
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeDefined();
    expect(typeof data?.id).toBe("string");
  }, 15000); // 15s timeout for API call
});
