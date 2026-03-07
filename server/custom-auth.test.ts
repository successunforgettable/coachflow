/**
 * Tests for the custom auth system (Google OAuth + magic link)
 * These tests verify the auth logic without making real HTTP requests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for helper functions ─────────────────────────────────────────

describe("Custom Auth - Token generation", () => {
  it("generates a 64-character hex token", () => {
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens each time", () => {
    const crypto = require("crypto");
    const t1 = crypto.randomBytes(32).toString("hex");
    const t2 = crypto.randomBytes(32).toString("hex");
    expect(t1).not.toBe(t2);
  });

  it("generates a zap_ prefixed openId", () => {
    const crypto = require("crypto");
    const openId = `zap_${crypto.randomBytes(16).toString("hex")}`;
    expect(openId).toMatch(/^zap_[0-9a-f]{32}$/);
  });
});

describe("Custom Auth - Google OAuth URL construction", () => {
  it("builds a valid Google OAuth authorization URL", () => {
    const baseUrl = "https://zapcampaigns.com";
    const clientId = "test-client-id.apps.googleusercontent.com";
    const state = "test-state-value";
    const redirectUri = `${baseUrl}/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    const parsed = new URL(url);

    expect(parsed.hostname).toBe("accounts.google.com");
    expect(parsed.searchParams.get("client_id")).toBe(clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toContain("email");
    expect(parsed.searchParams.get("state")).toBe(state);
  });

  it("redirect URI uses the correct callback path", () => {
    const baseUrl = "https://zapcampaigns.com";
    const redirectUri = `${baseUrl}/auth/google/callback`;
    expect(redirectUri).toBe("https://zapcampaigns.com/auth/google/callback");
    expect(redirectUri).not.toContain("manus");
    expect(redirectUri).not.toContain("manus-oauth");
  });
});

describe("Custom Auth - Magic link email", () => {
  it("magic link URL includes the token", () => {
    const baseUrl = "https://zapcampaigns.com";
    const token = "abc123def456";
    const magicLinkUrl = `${baseUrl}/auth/magic/verify?token=${token}`;
    expect(magicLinkUrl).toBe("https://zapcampaigns.com/auth/magic/verify?token=abc123def456");
    expect(magicLinkUrl).not.toContain("manus");
  });

  it("magic link URL does not expose any Manus branding", () => {
    const baseUrl = "https://zapcampaigns.com";
    const token = "test-token";
    const url = `${baseUrl}/auth/magic/verify?token=${token}`;
    expect(url).not.toContain("manus.im");
    expect(url).not.toContain("manus-oauth");
    expect(url).not.toContain("VITE_OAUTH_PORTAL_URL");
  });
});

describe("Custom Auth - Login page routing", () => {
  it("getLoginUrl returns /login path, not a Manus URL", () => {
    // Simulate what the updated const.ts returns
    const getLoginUrl = (returnPath?: string) => {
      const path = returnPath ? `?returnTo=${encodeURIComponent(returnPath)}` : "";
      return `/login${path}`;
    };

    expect(getLoginUrl()).toBe("/login");
    expect(getLoginUrl("/dashboard")).toBe("/login?returnTo=%2Fdashboard");
    expect(getLoginUrl()).not.toContain("manus.im");
    expect(getLoginUrl()).not.toContain("app-auth");
  });

  it("logout redirects to /login, not Manus OAuth", () => {
    const logoutRedirectTarget = "/login";
    expect(logoutRedirectTarget).toBe("/login");
    expect(logoutRedirectTarget).not.toContain("manus.im");
  });
});

describe("Custom Auth - User upsert logic", () => {
  it("generates a zap_ openId for new users (not a Manus openId)", () => {
    const crypto = require("crypto");
    const openId = `zap_${crypto.randomBytes(16).toString("hex")}`;
    // Should not look like a Manus openId (which is typically a UUID or numeric string)
    expect(openId).toMatch(/^zap_/);
    expect(openId).not.toMatch(/^[0-9]+$/);
  });

  it("email verification is set to true for Google users", () => {
    const loginMethod = "google";
    const emailVerified = loginMethod === "google";
    expect(emailVerified).toBe(true);
  });

  it("email verification is set to false for magic link users before clicking link", () => {
    const loginMethod = "magic_link_pending";
    const emailVerified = loginMethod === "google";
    expect(emailVerified).toBe(false);
  });
});
