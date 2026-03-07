/**
 * Custom authentication system for zapcampaigns.com
 * Replaces Manus OAuth with:
 *   1. Google OAuth 2.0 (direct, no Manus involved)
 *   2. Email magic link (via Resend)
 *
 * ALL routes are under /api/auth/* so the Manus platform proxy forwards them
 * to our Express server. Routes outside /api/* are served as static SPA HTML.
 *
 * Google Cloud Console redirect URI must be:
 *   https://zapcampaigns.com/api/auth/google/callback
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, emailVerificationTokens } from "../../drizzle/schema";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { Resend } from "resend";

const resend = new Resend(ENV.resendApiKey);
const FROM_EMAIL = "ZAP <noreply@zapcampaigns.com>";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOpenId(): string {
  return `zap_${crypto.randomBytes(16).toString("hex")}`;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Always use the production domain for redirect URIs — never trust x-forwarded-host */
function getBaseUrl(): string {
  return (ENV.appUrl || "https://zapcampaigns.com").replace(/\/$/, "");
}

async function createSession(req: Request, res: Response, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

async function upsertUserByEmail(
  email: string,
  name: string,
  loginMethod: string,
  googleOpenId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    await db.update(users)
      .set({ lastSignedIn: new Date(), name: name || user.name, loginMethod })
      .where(eq(users.id, user.id));
    return user;
  }

  const openId = googleOpenId ?? generateOpenId();
  const now = new Date();
  await db.insert(users).values({
    openId,
    email,
    name,
    loginMethod,
    emailVerified: loginMethod === "google",
    lastSignedIn: now,
    role: "user",
  });

  const newUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return newUser[0];
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

function getGoogleAuthUrl(state?: string): string {
  const redirectUri = `${getBaseUrl()}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: state || Buffer.from(JSON.stringify({ returnTo: "/v2-dashboard" })).toString("base64url"),
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeGoogleCode(code: string) {
  const redirectUri = `${getBaseUrl()}/api/auth/google/callback`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return response.json() as Promise<{ access_token: string; id_token: string }>;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  return response.json() as Promise<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
    email_verified: boolean;
  }>;
}

// ─── Magic Link ───────────────────────────────────────────────────────────────

async function sendMagicLink(email: string, token: string) {
  const magicUrl = `${getBaseUrl()}/api/auth/magic?token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your ZAP sign-in link",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f0e8; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: #1a1a1a; padding: 32px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; color: #fff; letter-spacing: -1px;">ZAP</div>
      <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 13px;">AI Campaign Generator</p>
    </div>
    <div style="padding: 36px 32px;">
      <h2 style="color: #1a1a1a; margin: 0 0 12px; font-size: 22px; font-weight: 700;">Sign in to ZAP</h2>
      <p style="color: #666; margin: 0 0 28px; line-height: 1.6; font-size: 15px;">
        Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.
      </p>
      <a href="${magicUrl}"
         style="display: block; background: #1a1a1a; color: white; text-decoration: none;
                padding: 16px 24px; border-radius: 10px; text-align: center;
                font-weight: 600; font-size: 16px; margin-bottom: 24px;">
        Sign in to ZAP →
      </a>
      <p style="color: #999; font-size: 13px; margin: 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid #f0ebe0;">
      <p style="color: #bbb; font-size: 12px; margin: 0; text-align: center;">
        © ${new Date().getFullYear()} ZAP · zapcampaigns.com
      </p>
    </div>
  </div>
</body>
</html>`,
    text: `Sign in to ZAP\n\nClick this link to sign in (expires in 15 minutes):\n${magicUrl}\n\nIf you didn't request this, ignore this email.\n\n— The ZAP Team`,
  });

  if (error) {
    console.error("[CustomAuth] Failed to send magic link:", error);
    throw new Error("Failed to send magic link email");
  }

  console.log("[CustomAuth] Magic link sent to:", email);
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerCustomAuthRoutes(app: Express) {
  // ── Google OAuth initiation ──
  // /api/auth/google → redirects to Google's OAuth consent screen
  app.get("/api/auth/google", (req, res) => {
    const stateRaw = req.query.state as string | undefined;
    const url = getGoogleAuthUrl(stateRaw);
    console.log("[CustomAuth] Redirecting to Google OAuth:", url.substring(0, 80) + "...");
    res.redirect(302, url);
  });

  // ── Google OAuth callback ──
  // Google redirects here after user grants permission
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const stateRaw = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error || !code) {
      console.error("[CustomAuth] Google OAuth error:", error);
      res.redirect(302, "/login?error=google_auth_failed");
      return;
    }

    try {
      const tokens = await exchangeGoogleCode(code);
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      if (!googleUser.email) {
        res.redirect(302, "/login?error=no_email");
        return;
      }

      const user = await upsertUserByEmail(
        googleUser.email,
        googleUser.name || googleUser.email.split("@")[0],
        "google",
        `google_${googleUser.sub}`
      );

      await createSession(req, res, user.openId, user.name || "");

      let returnTo = "/v2-dashboard";
      if (stateRaw) {
        try {
          const state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
          if (state.returnTo && typeof state.returnTo === "string") {
            returnTo = state.returnTo;
          }
        } catch { /* ignore */ }
      }

      console.log(`[CustomAuth] Google login success: ${googleUser.email}`);
      res.redirect(302, returnTo);
    } catch (err) {
      console.error("[CustomAuth] Google callback error:", err);
      res.redirect(302, "/login?error=google_auth_failed");
    }
  });

  // ── Magic link request ──
  app.post("/api/auth/magic/request", async (req, res) => {
    const { email } = req.body as { email?: string };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let userRow = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];

      if (!userRow) {
        const openId = generateOpenId();
        await db.insert(users).values({
          openId,
          email,
          name: email.split("@")[0],
          loginMethod: "magic_link",
          emailVerified: false,
          lastSignedIn: new Date(),
          role: "user",
        });
        userRow = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
      }

      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userRow.id));

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.insert(emailVerificationTokens).values({
        userId: userRow.id,
        token,
        expiresAt,
      });

      await sendMagicLink(email, token);

      res.json({ ok: true, message: "Magic link sent" });
    } catch (err) {
      console.error("[CustomAuth] Magic link request error:", err);
      res.status(500).json({ error: "Failed to send magic link" });
    }
  });

  // ── Magic link verification ──
  app.get("/api/auth/magic", async (req, res) => {
    const token = req.query.token as string | undefined;

    if (!token) {
      res.redirect(302, "/login?error=invalid_token");
      return;
    }

    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tokenRow = (await db.select().from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .limit(1))[0];

      if (!tokenRow) {
        res.redirect(302, "/login?error=invalid_token");
        return;
      }

      if (new Date() > tokenRow.expiresAt) {
        await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRow.id));
        res.redirect(302, "/login?error=expired_token");
        return;
      }

      const userRow = (await db.select().from(users).where(eq(users.id, tokenRow.userId)).limit(1))[0];

      if (!userRow) {
        res.redirect(302, "/login?error=user_not_found");
        return;
      }

      await db.update(users)
        .set({ emailVerified: true, lastSignedIn: new Date() })
        .where(eq(users.id, userRow.id));

      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRow.id));

      await createSession(req, res, userRow.openId, userRow.name || "");

      console.log(`[CustomAuth] Magic link login success: ${userRow.email}`);
      res.redirect(302, "/v2-dashboard");
    } catch (err) {
      console.error("[CustomAuth] Magic link verification error:", err);
      res.redirect(302, "/login?error=auth_failed");
    }
  });

  // ── Logout ──
  app.get("/api/auth/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect(302, "/login");
  });
}
