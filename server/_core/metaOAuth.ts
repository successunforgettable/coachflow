import type { Express } from "express";
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verifyOAuthState } from "./oauthState";

/**
 * Meta OAuth Callback Handler
 * Handles the OAuth callback from Meta after user authorizes the app
 */
export function registerMetaOAuthRoutes(app: Express) {
  app.get("/api/meta/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors
      if (error) {
        console.error("[Meta OAuth] Error:", error, error_description);
        return res.redirect(`/settings/integrations?meta_error=${error}`);
      }

      if (!code || !state) {
        console.error("[Meta OAuth] Missing code or state");
        return res.redirect("/settings/integrations?meta_error=missing_params");
      }

      // Verify HMAC-signed state token to prevent OAuth CSRF attacks
      const userId = verifyOAuthState(state as string);
      if (userId === null) {
        console.error("[Meta OAuth] Invalid or expired state token");
        return res.redirect("/settings/integrations?meta_error=invalid_state");
      }

      // Exchange authorization code for access token
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      
      // Use the configured app URL (must match the one used in OAuth request)
      const appUrl = process.env.VITE_APP_URL || "http://localhost:3000";
      const redirectUri = `${appUrl}/api/meta/callback`;

      if (!appId || !appSecret) {
        console.error("[Meta OAuth] Missing app credentials");
        return res.redirect("/settings/integrations?meta_error=config_error");
      }

      // Step 1: Exchange code for short-lived access token
      const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", code as string);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error("[Meta OAuth] Token exchange failed:", tokenData);
        return res.redirect("/settings/integrations?meta_error=token_exchange_failed");
      }

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      if (!longLivedResponse.ok || !longLivedData.access_token) {
        console.error("[Meta OAuth] Long-lived token exchange failed:", longLivedData);
        return res.redirect("/settings/integrations?meta_error=long_lived_token_failed");
      }

      const accessToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 60 * 24 * 60 * 60; // 60 days in seconds
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 3: Get user's ad accounts
      const adAccountsUrl = new URL("https://graph.facebook.com/v21.0/me/adaccounts");
      adAccountsUrl.searchParams.set("access_token", accessToken);
      adAccountsUrl.searchParams.set("fields", "id,name,account_status");

      const adAccountsResponse = await fetch(adAccountsUrl.toString());
      const adAccountsData = await adAccountsResponse.json();

      if (!adAccountsResponse.ok || !adAccountsData.data) {
        console.error("[Meta OAuth] Failed to fetch ad accounts:", adAccountsData);
        return res.redirect("/settings/integrations?meta_error=ad_accounts_failed");
      }

      // Use the first active ad account
      const activeAccount = adAccountsData.data.find((acc: any) => acc.account_status === 1);
      const adAccountId = activeAccount?.id || adAccountsData.data[0]?.id;
      const adAccountName = activeAccount?.name || adAccountsData.data[0]?.name;

      // Step 3.5 (Phase C C3): Fetch the user's managed Facebook Pages and
      // pick a default pageId. createAdCreative at server/lib/metaAPI.ts L537
      // puts tokenData.pageId into object_story_spec.page_id when publishing;
      // pre-C3 callbacks never captured a Page so the field stayed NULL and
      // the Graph API rejected the creative with an empty page_id. Capturing
      // here closes that latent trap for every fresh OAuth (existing rows
      // need a reconnect to pick up the pageId on their next refresh).
      //
      // Non-fatal: if /me/accounts returns no pages (e.g. the user has only
      // an ad account but no Page), pageId stays null and the modal surfaces
      // the gap to the user. We don't want to block OAuth completion on it
      // because some users may use ZAP for non-creative pushes via GHL only.
      let pageId: string | null = null;
      try {
        const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
        pagesUrl.searchParams.set("access_token", accessToken);
        pagesUrl.searchParams.set("fields", "id,name,access_token");
        const pagesResponse = await fetch(pagesUrl.toString());
        const pagesData = await pagesResponse.json();
        if (pagesResponse.ok && Array.isArray(pagesData.data) && pagesData.data.length > 0) {
          pageId = pagesData.data[0].id || null;
          console.log(`[Meta OAuth] Captured pageId=${pageId} for user ${userId} (page: ${pagesData.data[0].name})`);
        } else {
          // Phase C C3 follow-on: dump the raw response body (capped) so the
          // empty-array vs error-envelope vs missing-data-field sub-cases are
          // diagnosable from logs alone, without needing diagnostic deploy
          // cycles. Pre-follow-on logging lumped all three under one message.
          const rawBody = JSON.stringify(pagesData).substring(0, 500);
          console.warn(`[Meta OAuth] No Pages on /me/accounts for user ${userId}; pageId stays NULL. HTTP status: ${pagesResponse.status}. Raw response: ${rawBody}`);
        }
      } catch (pagesErr) {
        console.warn(`[Meta OAuth] Failed to fetch /me/accounts for user ${userId}:`, pagesErr);
      }

      // Step 4: Store token in database
      const db = await getDb();
      if (!db) {
        console.error("[Meta OAuth] Database not available");
        return res.redirect("/settings/integrations?meta_error=db_error");
      }

      // Check if user already has a Meta connection
      const [existing] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing connection — overwrites pageId on reconnect so a
        // user reconnecting after C3 picks up the captured Page even when
        // the previous row had pageId=NULL.
        await db
          .update(metaAccessTokens)
          .set({
            accessToken,
            tokenExpiresAt: expiresAt,
            adAccountId,
            adAccountName,
            pageId,
            lastRefreshedAt: new Date(),
          })
          .where(eq(metaAccessTokens.userId, userId));
      } else {
        // Create new connection
        await db.insert(metaAccessTokens).values({
          userId,
          accessToken,
          tokenExpiresAt: expiresAt,
          adAccountId,
          adAccountName,
          pageId,
        });
      }

      console.log(`[Meta OAuth] Successfully connected user ${userId} to Meta ad account ${adAccountId} (pageId=${pageId ?? "NULL"})`);

      // Redirect back to integrations page with success
      return res.redirect("/settings/integrations?meta_success=true");
    } catch (error) {
      console.error("[Meta OAuth] Unexpected error:", error);
      return res.redirect("/settings/integrations?meta_error=unexpected");
    }
  });
}
