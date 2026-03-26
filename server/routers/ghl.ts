import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { ghlAccessTokens, campaignKits, emailSequences, whatsappSequences, landingPages, idealCustomerProfiles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const GHL_BASE = "https://services.leadconnectorhq.com";

/**
 * GoHighLevel Integration Router
 * Handles OAuth connection, token storage, and GHL API push
 */
export const ghlRouter = router({
  /**
   * Get current user's GHL connection status
   */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [connection] = await db
      .select()
      .from(ghlAccessTokens)
      .where(eq(ghlAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      return { connected: false };
    }

    const now = new Date();
    const isExpired = new Date(connection.tokenExpiresAt) < now;

    return {
      connected: !isExpired,
      locationId: connection.locationId,
      locationName: connection.locationName,
      connectedAt: connection.connectedAt,
      expiresAt: connection.tokenExpiresAt,
      isExpired,
    };
  }),

  /**
   * Get GHL OAuth URL for user to initiate connection
   */
  getOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GHL_CLIENT_ID;
    if (!clientId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL_CLIENT_ID not configured" });
    }

    const redirectUri = `${process.env.APP_URL || "https://zapcampaigns.com"}/api/oauth/gohighlevel/callback`;
    const scopes = "contacts.write contacts.readonly campaigns.readonly opportunities.write businesses.readonly businesses.write";
    const state = String(ctx.user.id);

    const url = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}`;

    return { url };
  }),

  /**
   * Exchange auth code for access token (called from callback handler)
   */
  exchangeCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const clientId = process.env.GHL_CLIENT_ID;
      const clientSecret = process.env.GHL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL credentials not configured" });
      }

      const redirectUri = `${process.env.APP_URL || "https://zapcampaigns.com"}/api/oauth/gohighlevel/callback`;

      // Exchange code for token
      const tokenRes = await fetch(`${GHL_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[GHL] Token exchange failed:", errText);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL token exchange failed" });
      }

      const tokenData = await tokenRes.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);

      // Upsert the token
      await db.delete(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id));
      await db.insert(ghlAccessTokens).values({
        userId: ctx.user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        tokenExpiresAt: expiresAt,
        locationId: tokenData.locationId || null,
        locationName: null,
        companyId: tokenData.companyId || null,
      });

      return { success: true, locationId: tokenData.locationId };
    }),

  /**
   * Disconnect GHL account
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db.delete(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id));
    return { success: true };
  }),

  /**
   * Push campaign kit to GHL
   * Pushes email sequence, WhatsApp sequence, and landing page data
   */
  pushCampaign: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get GHL connection
      const [ghl] = await db.select().from(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id)).limit(1);
      if (!ghl) throw new TRPCError({ code: "FORBIDDEN", message: "GHL not connected" });

      // Check token expiry
      if (new Date(ghl.tokenExpiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "GHL token expired — please reconnect" });
      }

      // Get campaign kit
      const [kit] = await db.select().from(campaignKits).where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      const results: { emailPushed: boolean; whatsappPushed: boolean; landingPagePushed: boolean } = {
        emailPushed: false,
        whatsappPushed: false,
        landingPagePushed: false,
      };

      const headers = {
        Authorization: `Bearer ${ghl.accessToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      };

      // Push email sequence as contact note
      if (kit.selectedEmailSequenceId) {
        try {
          const [emailSeq] = await db.select().from(emailSequences).where(eq(emailSequences.id, kit.selectedEmailSequenceId)).limit(1);
          if (emailSeq) {
            const emails = typeof emailSeq.emails === "string" ? JSON.parse(emailSeq.emails) : emailSeq.emails;
            const emailText = Array.isArray(emails) ? emails.map((e: any, i: number) =>
              `Email ${i + 1}: ${e.subject || ""}\n${e.body || ""}`
            ).join("\n\n---\n\n") : "No emails";

            // Create a custom value in GHL with the email sequence
            const res = await fetch(`${GHL_BASE}/locations/${ghl.locationId}/customValues`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: `ZAP Email Sequence - ${kit.name || "Campaign"}`,
                value: emailText.substring(0, 5000),
              }),
            });
            results.emailPushed = res.ok;
            if (!res.ok) console.warn("[GHL] Email push failed:", await res.text());
          }
        } catch (e) { console.warn("[GHL] Email push error:", e); }
      }

      // Push WhatsApp sequence as custom value
      if (kit.selectedWhatsAppSequenceId) {
        try {
          const [waSeq] = await db.select().from(whatsappSequences).where(eq(whatsappSequences.id, kit.selectedWhatsAppSequenceId)).limit(1);
          if (waSeq) {
            const messages = typeof waSeq.messages === "string" ? JSON.parse(waSeq.messages) : waSeq.messages;
            const waText = Array.isArray(messages) ? messages.map((m: any, i: number) =>
              `Message ${i + 1}: ${m.text || m.message || ""}`
            ).join("\n\n---\n\n") : "No messages";

            const res = await fetch(`${GHL_BASE}/locations/${ghl.locationId}/customValues`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: `ZAP WhatsApp Sequence - ${kit.name || "Campaign"}`,
                value: waText.substring(0, 5000),
              }),
            });
            results.whatsappPushed = res.ok;
            if (!res.ok) console.warn("[GHL] WhatsApp push failed:", await res.text());
          }
        } catch (e) { console.warn("[GHL] WhatsApp push error:", e); }
      }

      // Push landing page headline + copy as custom value
      if (kit.selectedLandingPageId) {
        try {
          const [lp] = await db.select().from(landingPages).where(eq(landingPages.id, kit.selectedLandingPageId)).limit(1);
          if (lp) {
            const angle = (kit as any).selectedLandingPageAngle || "original";
            const angleKey = `${angle}Angle` as keyof typeof lp;
            const angleData = lp[angleKey] ? (typeof lp[angleKey] === "string" ? JSON.parse(lp[angleKey] as string) : lp[angleKey]) : null;
            const lpText = angleData ? `Headline: ${angleData.mainHeadline || ""}\nSubheadline: ${angleData.subheadline || ""}\nCTA: ${angleData.primaryCta || ""}` : "No landing page data";

            const res = await fetch(`${GHL_BASE}/locations/${ghl.locationId}/customValues`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: `ZAP Landing Page - ${kit.name || "Campaign"}`,
                value: lpText.substring(0, 5000),
              }),
            });
            results.landingPagePushed = res.ok;
            if (!res.ok) console.warn("[GHL] Landing page push failed:", await res.text());
          }
        } catch (e) { console.warn("[GHL] Landing page push error:", e); }
      }

      return results;
    }),
});
