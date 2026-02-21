import type { Express } from "express";
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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

      const userId = parseInt(state as string, 10);
      if (isNaN(userId)) {
        console.error("[Meta OAuth] Invalid user ID in state");
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
        // Update existing connection
        await db
          .update(metaAccessTokens)
          .set({
            accessToken,
            tokenExpiresAt: expiresAt,
            adAccountId,
            adAccountName,
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
        });
      }

      console.log(`[Meta OAuth] Successfully connected user ${userId} to Meta ad account ${adAccountId}`);

      // Redirect back to integrations page with success
      return res.redirect("/settings/integrations?meta_success=true");
    } catch (error) {
      console.error("[Meta OAuth] Unexpected error:", error);
      return res.redirect("/settings/integrations?meta_error=unexpected");
    }
  });
}
