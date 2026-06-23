import type { Express } from "express";
import { getDb } from "../db";
import { ghlAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyOAuthState } from "./oauthState";

/**
 * GoHighLevel OAuth Callback Handler — Phase C C3 follow-on 3
 *
 * Built to mirror the Meta + Manus OAuth callback pattern (see metaOAuth.ts
 * and oauth.ts). Pre-C3 the GHL OAuth completion handler was never
 * registered as an Express route — `server/routers/ghl.ts` defined an
 * `exchangeCode` tRPC mutation but no client-side route ever called it,
 * and no Express GET route caught the redirect. The marketplace OAuth
 * chooser sends users back to `/api/oauth/gohighlevel/callback?code=...`
 * (URL fixed by `ghl.ts:312`), and pre-C3 that path fell through Express
 * to the React SPA's catchall, rendering a 404.
 *
 * UX: this handler is hit via a popup (PushKitModal.handleConnectGhl opens
 * OAuth via `window.open(url, "_blank", "width=600,height=700,...")`).
 * Option α redirect pattern — on success we respond with a tiny HTML
 * page that runs `window.close()` immediately. The parent tab's focus
 * event (registered in PushKitModal) then refetches the connection-status
 * query and flips the GHL pill green.
 */

const GHL_BASE = "https://services.leadconnectorhq.com";

// Tiny HTML response that auto-closes the popup. Falls back to a
// human-readable success message if `window.close()` is blocked by the
// browser (some browsers refuse to close windows that weren't script-opened,
// though our popup IS script-opened so close() should succeed).
function autoClosePage(message: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${message}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;color:#1A1624}</style>
</head><body>
<p>${message}</p>
<p style="color:#777;font-size:13px">You can close this window.</p>
<script>try { window.close(); } catch (e) {}</script>
</body></html>`;
}

function errorRedirectUrl(slug: string): string {
  // Error redirects use the integrations settings page so the user has a
  // clear next step. This matches the Meta callback's error-redirect
  // pattern (`/settings/integrations?meta_error=...`).
  return `/settings/integrations?ghl_error=${encodeURIComponent(slug)}`;
}

export function registerGhlOAuthRoutes(app: Express) {
  app.get("/api/oauth/gohighlevel/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error("[GHL OAuth] Error:", error, error_description);
        return res.redirect(errorRedirectUrl(String(error)));
      }

      if (!code || !state) {
        console.error("[GHL OAuth] Missing code or state");
        return res.redirect(errorRedirectUrl("missing_params"));
      }

      // Verify HMAC-signed state token to prevent OAuth CSRF attacks
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[GHL OAuth] Invalid or expired state token");
        return res.redirect(errorRedirectUrl("invalid_state"));
      }

      const clientId = process.env.GHL_CLIENT_ID;
      const clientSecret = process.env.GHL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        console.error("[GHL OAuth] Missing app credentials");
        return res.redirect(errorRedirectUrl("config_error"));
      }

      const appUrl = process.env.APP_URL || "https://zapcampaigns.com";
      const redirectUri = `${appUrl}/api/oauth/gohighlevel/callback`;

      // Step 1: Exchange authorization code for access token. Mirrors the
      // existing tRPC `exchangeCode` mutation logic in `routers/ghl.ts`.
      const tokenRes = await fetch(`${GHL_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[GHL OAuth] Token exchange failed:", errText);
        return res.redirect(errorRedirectUrl("token_exchange_failed"));
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token as string | undefined;
      if (!accessToken) {
        console.error("[GHL OAuth] No access_token in token response:", tokenData);
        return res.redirect(errorRedirectUrl("no_access_token"));
      }
      const refreshToken = (tokenData.refresh_token as string) || null;
      const expiresIn = (tokenData.expires_in as number) || 86400; // default 1 day
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const locationId = (tokenData.locationId as string) || null;
      const companyId = (tokenData.companyId as string) || null;

      // Step 2: Fetch the location's human-readable name. GHL's token
      // response only carries the locationId — locationName needs a
      // separate API call to /locations/{id}. Non-fatal: if it fails we
      // still persist the token with locationName=null and the modal
      // pill falls back to displaying the locationId.
      let locationName: string | null = null;
      if (locationId) {
        try {
          const locRes = await fetch(`${GHL_BASE}/locations/${locationId}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Version: "2021-07-28",
              Accept: "application/json",
            },
          });
          if (locRes.ok) {
            const locData = await locRes.json();
            locationName = (locData?.location?.name as string) || (locData?.name as string) || null;
            console.log(`[GHL OAuth] Captured locationName="${locationName}" for location ${locationId}`);
          } else {
            const rawBody = (await locRes.text()).substring(0, 500);
            console.warn(`[GHL OAuth] /locations/${locationId} fetch failed. HTTP ${locRes.status}. Raw: ${rawBody}`);
          }
        } catch (locErr) {
          console.warn(`[GHL OAuth] /locations/${locationId} fetch threw:`, locErr);
        }
      }

      // Step 3: Persist to ghl_access_tokens (upsert via delete+insert,
      // matching the existing `exchangeCode` mutation pattern at
      // `routers/ghl.ts:387-396`).
      const db = await getDb();
      if (!db) {
        console.error("[GHL OAuth] Database not available");
        return res.redirect(errorRedirectUrl("db_error"));
      }

      await db.delete(ghlAccessTokens).where(eq(ghlAccessTokens.userId, userId));
      await db.insert(ghlAccessTokens).values({
        userId,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        locationId,
        locationName,
        companyId,
      });

      console.log(`[GHL OAuth] Successfully connected user ${userId} to GHL location ${locationId} ("${locationName ?? "unnamed"}")`);

      // Step 4: Auto-close the popup via inline script. Parent tab's
      // focus listener (registered in `PushKitModal.tsx` via
      // `window.addEventListener("focus", ...)`) refetches both
      // connection-status queries when the user returns to the kit tab,
      // and the GHL pill flips green.
      return res
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(autoClosePage("GHL connected ✓"));
    } catch (err) {
      console.error("[GHL OAuth] Unexpected error:", err);
      return res.redirect(errorRedirectUrl("unexpected"));
    }
  });
}
