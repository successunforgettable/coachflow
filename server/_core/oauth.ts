import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Build the state value that the SDK expects for token exchange.
 * The SDK's decodeState() does atob(state) and uses the result as redirectUri.
 * So we encode the actual redirectUri as the state for the ExchangeToken call.
 */
function buildStateForExchange(redirectUri: string): string {
  return btoa(redirectUri);
}

async function handleOAuthCallback(req: Request, res: Response) {
  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state"); // This is the post-login return URL encoded by the platform

  if (!code || !state) {
    res.status(400).json({ error: "code and state are required" });
    return;
  }

  try {
    // Determine the actual redirectUri used for this callback route.
    // The Manus platform registers /manus-oauth/callback for custom domains.
    // We must pass this as the redirectUri to ExchangeToken, not the state value
    // (which the platform uses to encode the post-login return URL).
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const actualRedirectUri = `${protocol}://${host}${req.path}`;

    // Build a state value that the SDK will decode back to the correct redirectUri
    const exchangeState = buildStateForExchange(actualRedirectUri);

    const tokenResponse = await sdk.exchangeCodeForToken(code, exchangeState);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      res.status(400).json({ error: "openId missing from user info" });
      return;
    }

    const existingUser = await db.getUserByOpenId(userInfo.openId);
    const isNewUser = !existingUser;

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    // Grant 2 free video credits to new users
    if (isNewUser) {
      try {
        const { grantFreeVideoCredits } = await import("../db");
        await grantFreeVideoCredits(userInfo.openId, 2);
        console.log(`[OAuth] Granted 2 free video credits to new user: ${userInfo.openId}`);
      } catch (error) {
        console.error("[OAuth] Failed to grant free credits:", error);
        // Don't fail the login if credit grant fails
      }
    }

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    // Decode the original state to get the post-login return URL
    let returnUrl = "/";
    try {
      const decoded = atob(state);
      // Only use it as a return URL if it looks like a path or same-origin URL
      if (decoded.startsWith("/") || decoded.includes(host as string)) {
        const url = new URL(decoded.startsWith("/") ? `https://${host}${decoded}` : decoded);
        returnUrl = url.pathname + url.search;
      }
    } catch {
      // Ignore decode errors, fall back to "/"
    }

    res.redirect(302, returnUrl);
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
}

export function registerOAuthRoutes(app: Express) {
  // Primary callback route (used by dev/preview environments)
  app.get("/api/oauth/callback", handleOAuthCallback);
  // Platform-registered callback route for custom domains (e.g. zapcampaigns.com)
  app.get("/manus-oauth/callback", handleOAuthCallback);
}
