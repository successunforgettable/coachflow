import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  ghlAccessTokens,
  campaignKits,
  emailSequences,
  whatsappSequences,
  landingPages,
  idealCustomerProfiles,
  headlines,
  adCopy,
  heroMechanisms,
  hvcoTitles,
  offers,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const GHL_BASE = "https://services.leadconnectorhq.com";

/**
 * Upsert a GHL Custom Value by name.
 * Checks if a custom value with the given name already exists for the location;
 * if so, updates it with PUT, otherwise creates it with POST.
 */
async function upsertCustomValue(
  locationId: string,
  headers: Record<string, string>,
  name: string,
  value: string
): Promise<boolean> {
  try {
    // GET existing custom values for this location
    const listRes = await fetch(`${GHL_BASE}/locations/${locationId}/customValues`, {
      method: "GET",
      headers,
    });
    if (listRes.ok) {
      const listData = await listRes.json() as { customValues?: Array<{ id: string; name: string }> };
      const existing = (listData.customValues || []).find((cv) => cv.name === name);
      if (existing) {
        // PUT — update existing
        const putRes = await fetch(`${GHL_BASE}/locations/${locationId}/customValues/${existing.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name, value }),
        });
        if (!putRes.ok) console.warn(`[GHL] PUT customValue failed for "${name}":`, await putRes.text());
        return putRes.ok;
      }
    }
    // POST — create new
    const postRes = await fetch(`${GHL_BASE}/locations/${locationId}/customValues`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, value }),
    });
    if (!postRes.ok) console.warn(`[GHL] POST customValue failed for "${name}":`, await postRes.text());
    return postRes.ok;
  } catch (e) {
    console.warn(`[GHL] upsertCustomValue error for "${name}":`, e);
    return false;
  }
}

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
    const scopes = "contacts.write contacts.readonly campaigns.readonly opportunities.write businesses.readonly businesses.write locations.readonly locations/customValues.write locations/customValues.readonly";
    const state = String(ctx.user.id);

    const versionId = process.env.GHL_APP_VERSION_ID || "69af3395095745d484bc1b18";
    const url = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}&version_id=${versionId}`;

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
   * Push campaign kit to GHL as Custom Values.
   * Pushes all 7 asset types: email sequence, WhatsApp sequence, landing page (all 16 sections),
   * headlines, ad copy, offer copy (3 angles), HVCO title, and hero mechanism.
   * Uses upsert: checks existing custom values by name, updates if found, creates if not.
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
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      const kitName = kit.name || "Campaign";
      const locationId = ghl.locationId!;

      const results: Record<string, boolean> = {
        emailPushed: false,
        whatsappPushed: false,
        landingPagePushed: false,
        headlinesPushed: false,
        adCopyPushed: false,
        offerPushed: false,
        hvcoTitlePushed: false,
        heroMechanismPushed: false,
      };

      const headers: Record<string, string> = {
        Authorization: `Bearer ${ghl.accessToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      };

      // ─── 1. Email Sequence (Node 9) ────────────────────────────────────────────
      if (kit.selectedEmailSequenceId) {
        try {
          const [emailSeq] = await db
            .select()
            .from(emailSequences)
            .where(eq(emailSequences.id, kit.selectedEmailSequenceId))
            .limit(1);
          if (emailSeq) {
            const emails = typeof emailSeq.emails === "string"
              ? JSON.parse(emailSeq.emails)
              : emailSeq.emails;
            const emailText = Array.isArray(emails)
              ? emails.map((e: any, i: number) =>
                  `Email ${i + 1}: ${e.subject || ""}\n${e.body || ""}`
                ).join("\n\n---\n\n")
              : "No emails";
            results.emailPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Email Sequence - ${kitName}`,
              emailText
            );
          }
        } catch (e) { console.warn("[GHL] Email push error:", e); }
      }

      // ─── 2. WhatsApp Sequence (Node 10) ───────────────────────────────────────
      if (kit.selectedWhatsAppSequenceId) {
        try {
          const [waSeq] = await db
            .select()
            .from(whatsappSequences)
            .where(eq(whatsappSequences.id, kit.selectedWhatsAppSequenceId))
            .limit(1);
          if (waSeq) {
            const messages = typeof waSeq.messages === "string"
              ? JSON.parse(waSeq.messages)
              : waSeq.messages;
            const waText = Array.isArray(messages)
              ? messages.map((m: any, i: number) =>
                  `Message ${i + 1}: ${m.text || m.message || ""}`
                ).join("\n\n---\n\n")
              : "No messages";
            results.whatsappPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP WhatsApp Sequence - ${kitName}`,
              waText
            );
          }
        } catch (e) { console.warn("[GHL] WhatsApp push error:", e); }
      }

      // ─── 3. Landing Page — all 16 sections from selected angle (Node 8) ───────
      if (kit.selectedLandingPageId) {
        try {
          const [lp] = await db
            .select()
            .from(landingPages)
            .where(eq(landingPages.id, kit.selectedLandingPageId))
            .limit(1);
          if (lp) {
            const angle = (kit as any).selectedLandingPageAngle || "original";
            const angleKey = `${angle}Angle` as keyof typeof lp;
            const raw = lp[angleKey];
            const angleData: any = raw
              ? (typeof raw === "string" ? JSON.parse(raw as string) : raw)
              : null;

            let lpText = "No landing page data";
            if (angleData) {
              const sections: string[] = [];
              if (angleData.eyebrowHeadline)   sections.push(`EYEBROW\n${angleData.eyebrowHeadline}`);
              if (angleData.mainHeadline)       sections.push(`MAIN HEADLINE\n${angleData.mainHeadline}`);
              if (angleData.subheadline)        sections.push(`SUBHEADLINE\n${angleData.subheadline}`);
              if (angleData.primaryCta)         sections.push(`PRIMARY CTA\n${angleData.primaryCta}`);
              if (Array.isArray(angleData.asSeenIn) && angleData.asSeenIn.length)
                sections.push(`AS SEEN IN\n${angleData.asSeenIn.join(", ")}`);
              if (angleData.quizSection) {
                const q = angleData.quizSection;
                sections.push(`QUIZ SECTION\nQuestion: ${q.question || ""}\nOptions: ${(q.options || []).join(" | ")}\nAnswer: ${q.answer || ""}`);
              }
              if (angleData.problemAgitation)   sections.push(`PROBLEM AGITATION\n${angleData.problemAgitation}`);
              if (angleData.solutionIntro)      sections.push(`SOLUTION INTRO\n${angleData.solutionIntro}`);
              if (angleData.whyOldFail)         sections.push(`WHY OLD SOLUTIONS FAIL\n${angleData.whyOldFail}`);
              if (angleData.uniqueMechanism)    sections.push(`UNIQUE MECHANISM\n${angleData.uniqueMechanism}`);
              if (Array.isArray(angleData.testimonials) && angleData.testimonials.length) {
                const tText = angleData.testimonials.map((t: any, i: number) =>
                  `Testimonial ${i + 1}: "${t.quote || ""}" — ${t.name || ""}, ${t.location || ""}`
                ).join("\n");
                sections.push(`TESTIMONIALS\n${tText}`);
              }
              if (angleData.insiderAdvantages)  sections.push(`INSIDER ADVANTAGES\n${angleData.insiderAdvantages}`);
              if (angleData.scarcityUrgency)    sections.push(`SCARCITY & URGENCY\n${angleData.scarcityUrgency}`);
              if (angleData.shockingStat)       sections.push(`SHOCKING STAT\n${angleData.shockingStat}`);
              if (angleData.timeSavingBenefit)  sections.push(`TIME-SAVING BENEFIT\n${angleData.timeSavingBenefit}`);
              if (Array.isArray(angleData.consultationOutline) && angleData.consultationOutline.length) {
                const outText = angleData.consultationOutline.map((o: any, i: number) =>
                  `Step ${i + 1}: ${o.title || ""} — ${o.description || ""}`
                ).join("\n");
                sections.push(`CONSULTATION OUTLINE\n${outText}`);
              }
              if (Array.isArray(angleData.faq) && angleData.faq.length) {
                const faqText = angleData.faq.map((f: any, i: number) =>
                  `Q${i + 1}: ${f.question || ""}\nA: ${f.answer || ""}`
                ).join("\n");
                sections.push(`FAQ\n${faqText}`);
              }
              lpText = sections.join("\n\n");
            }

            results.landingPagePushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Landing Page - ${kitName}`,
              lpText
            );
          }
        } catch (e) { console.warn("[GHL] Landing page push error:", e); }
      }

      // ─── 4. Headlines — all variants from the selected headline's set (Node 6) ─
      if (kit.selectedHeadlineId) {
        try {
          // Fetch the selected headline to get its headlineSetId
          const [selectedHL] = await db
            .select()
            .from(headlines)
            .where(eq(headlines.id, kit.selectedHeadlineId))
            .limit(1);
          if (selectedHL) {
            // Fetch all headlines in the same set
            const allHL = await db
              .select()
              .from(headlines)
              .where(eq(headlines.headlineSetId, selectedHL.headlineSetId));
            const hlText = allHL.length
              ? allHL.map((h, i) => {
                  let line = `${i + 1}. [${(h.formulaType || "").toUpperCase()}] ${h.headline}`;
                  if (h.eyebrow) line += `\n   Eyebrow: ${h.eyebrow}`;
                  if (h.subheadline) line += `\n   Subheadline: ${h.subheadline}`;
                  return line;
                }).join("\n\n")
              : `1. ${selectedHL.headline}`;
            results.headlinesPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Headlines - ${kitName}`,
              hlText
            );
          }
        } catch (e) { console.warn("[GHL] Headlines push error:", e); }
      }

      // ─── 5. Ad Copy — all headline/body/link rows from selected ad set (Node 7) ─
      if (kit.selectedAdCopyId) {
        try {
          // Fetch the selected row to get its adSetId
          const [selectedAd] = await db
            .select()
            .from(adCopy)
            .where(eq(adCopy.id, kit.selectedAdCopyId))
            .limit(1);
          if (selectedAd) {
            // Fetch all rows in the same ad set
            const allAds = await db
              .select()
              .from(adCopy)
              .where(eq(adCopy.adSetId, selectedAd.adSetId));
            const adHeadlines = allAds.filter(a => a.contentType === "headline");
            const adBodies    = allAds.filter(a => a.contentType === "body");
            const adLinks     = allAds.filter(a => a.contentType === "link");

            const sections: string[] = [];
            if (adHeadlines.length) {
              sections.push("AD HEADLINES\n" + adHeadlines.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));
            }
            if (adBodies.length) {
              sections.push("AD BODY COPY\n" + adBodies.map((a, i) => `--- Body ${i + 1} ---\n${a.content}`).join("\n\n"));
            }
            if (adLinks.length) {
              sections.push("LINK DESCRIPTIONS\n" + adLinks.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));
            }
            const adText = sections.join("\n\n");
            results.adCopyPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Ad Copy - ${kitName}`,
              adText || "No ad copy"
            );
          }
        } catch (e) { console.warn("[GHL] Ad copy push error:", e); }
      }

      // ─── 6. Offer Copy — all 3 angles (Node 3) ────────────────────────────────
      if (kit.selectedOfferId) {
        try {
          const [offer] = await db
            .select()
            .from(offers)
            .where(eq(offers.id, kit.selectedOfferId))
            .limit(1);
          if (offer) {
            const formatAngle = (label: string, data: any): string => {
              if (!data) return `${label}\n(not generated)`;
              return [
                `${label}`,
                `Offer Name: ${data.offerName || ""}`,
                `Value Proposition: ${data.valueProposition || ""}`,
                `Pricing: ${data.pricing || ""}`,
                `Bonuses: ${data.bonuses || ""}`,
                `Guarantee: ${data.guarantee || ""}`,
                `Urgency: ${data.urgency || ""}`,
                `CTA: ${data.cta || ""}`,
              ].join("\n");
            };

            const parse = (raw: any) =>
              raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;

            const offerText = [
              formatAngle("=== GODFATHER OFFER (Premium) ===", parse(offer.godfatherAngle)),
              formatAngle("=== FREE OFFER (Lead Magnet) ===",  parse(offer.freeAngle)),
              formatAngle("=== DOLLAR OFFER (Entry Point) ===", parse(offer.dollarAngle)),
            ].join("\n\n");

            results.offerPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Offer Copy - ${kitName}`,
              offerText
            );
          }
        } catch (e) { console.warn("[GHL] Offer push error:", e); }
      }

      // ─── 7. HVCO / Lead Magnet Title (Node 5) ─────────────────────────────────
      if (kit.selectedHvcoId) {
        try {
          const [hvco] = await db
            .select()
            .from(hvcoTitles)
            .where(eq(hvcoTitles.id, kit.selectedHvcoId))
            .limit(1);
          if (hvco) {
            const hvcoText = [
              `Title: ${hvco.title}`,
              `Type: ${hvco.tabType || ""}`,
              `Topic: ${hvco.hvcoTopic || ""}`,
            ].join("\n");
            results.hvcoTitlePushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Lead Magnet - ${kitName}`,
              hvcoText
            );
          }
        } catch (e) { console.warn("[GHL] HVCO push error:", e); }
      }

      // ─── 8. Hero Mechanism (Node 4) ───────────────────────────────────────────
      if (kit.selectedMechanismId) {
        try {
          const [mech] = await db
            .select()
            .from(heroMechanisms)
            .where(eq(heroMechanisms.id, kit.selectedMechanismId))
            .limit(1);
          if (mech) {
            const mechText = [
              `Mechanism Name: ${mech.mechanismName}`,
              `Description: ${mech.mechanismDescription}`,
              mech.descriptor ? `Type: ${mech.descriptor}` : null,
              mech.application ? `Application: ${mech.application}` : null,
            ].filter(Boolean).join("\n");
            results.heroMechanismPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Hero Mechanism - ${kitName}`,
              mechText
            );
          }
        } catch (e) { console.warn("[GHL] Hero mechanism push error:", e); }
      }

      return results;
    }),
});
