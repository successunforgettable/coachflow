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

// ─── D1 Helper: Upsert Custom Value ───────────────────────────────────────────
async function upsertCustomValue(
  locationId: string,
  headers: Record<string, string>,
  name: string,
  value: string
): Promise<boolean> {
  try {
    const listRes = await fetch(`${GHL_BASE}/locations/${locationId}/customValues`, {
      method: "GET",
      headers,
    });
    if (listRes.ok) {
      const listData = await listRes.json() as { customValues?: Array<{ id: string; name: string }> };
      const existing = (listData.customValues || []).find((cv) => cv.name === name);
      if (existing) {
        const putRes = await fetch(`${GHL_BASE}/locations/${locationId}/customValues/${existing.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name, value }),
        });
        if (!putRes.ok) console.warn(`[GHL] PUT customValue failed for "${name}":`, await putRes.text());
        return putRes.ok;
      }
    }
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

// ─── D2 Helper: Upsert Email Template ─────────────────────────────────────────
async function upsertEmailTemplate(
  locationId: string,
  headers: Record<string, string>,
  name: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    // List existing email templates to check for duplicates by name
    const listRes = await fetch(
      `${GHL_BASE}/locations/${locationId}/templates?type=email&limit=100`,
      { method: "GET", headers }
    );
    if (listRes.ok) {
      const listData = await listRes.json() as {
        templates?: Array<{ id: string; name: string }>;
        data?: Array<{ id: string; name: string }>;
      };
      const templates = listData.templates || listData.data || [];
      const existing = templates.find((t) => t.name === name);
      if (existing) {
        const putRes = await fetch(`${GHL_BASE}/locations/${locationId}/templates/${existing.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ name, subject, body, type: "email" }),
        });
        if (!putRes.ok) console.warn(`[GHL] PUT template failed for "${name}":`, await putRes.text());
        return putRes.ok;
      }
    }
    const postRes = await fetch(`${GHL_BASE}/locations/${locationId}/templates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, subject, body, type: "email" }),
    });
    if (!postRes.ok) console.warn(`[GHL] POST template failed for "${name}":`, await postRes.text());
    return postRes.ok;
  } catch (e) {
    console.warn(`[GHL] upsertEmailTemplate error for "${name}":`, e);
    return false;
  }
}

// ─── D2 Helper: Build landing page HTML from angle data ───────────────────────
function buildLandingPageHtml(angleData: Record<string, any>): string {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

  const section = (title: string, content: string) =>
    `<div style="margin-bottom:36px"><h2 style="font-size:26px;font-weight:800;margin:0 0 12px">${title}</h2><p style="font-size:16px;line-height:1.75;margin:0">${content}</p></div>`;

  const ctaBtn = (label: string) =>
    `<div style="text-align:center;margin:40px 0"><a href="#" style="display:inline-block;background:#FF5B1D;color:#fff;font-size:18px;font-weight:700;padding:18px 48px;border-radius:8px;text-decoration:none">${esc(label)}</a></div>`;

  const parts: string[] = [
    `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:48px 24px;background:#fff;color:#111">`,
  ];

  if (angleData.eyebrowHeadline)
    parts.push(`<p style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#888;margin:0 0 8px">${esc(angleData.eyebrowHeadline)}</p>`);

  if (angleData.mainHeadline)
    parts.push(`<h1 style="font-size:44px;font-weight:900;line-height:1.1;margin:0 0 16px">${esc(angleData.mainHeadline)}</h1>`);

  if (angleData.subheadline)
    parts.push(`<p style="font-size:20px;color:#555;margin:0 0 32px">${esc(angleData.subheadline)}</p>`);

  const ctaLabel = angleData.primaryCta || "Book Your Call";
  parts.push(ctaBtn(ctaLabel));

  if (angleData.problemAgitation)
    parts.push(section("The Problem", esc(angleData.problemAgitation)));

  if (angleData.solutionIntro)
    parts.push(section("The Solution", esc(angleData.solutionIntro)));

  if (angleData.whyOldFail)
    parts.push(section("Why Other Approaches Fail", esc(angleData.whyOldFail)));

  if (angleData.uniqueMechanism)
    parts.push(section("How It Works", esc(angleData.uniqueMechanism)));

  if (angleData.insiderAdvantages)
    parts.push(section("Why This Works", esc(angleData.insiderAdvantages)));

  if (Array.isArray(angleData.testimonials) && angleData.testimonials.length) {
    const tHtml = angleData.testimonials
      .map(
        (t: any) =>
          `<blockquote style="border-left:4px solid #FF5B1D;margin:0 0 20px;padding:16px 20px;background:#fafafa">"${esc(t.quote || "")}" <footer style="margin-top:8px;font-size:14px;color:#666">— ${esc(t.name || "")}, ${esc(t.location || "")}</footer></blockquote>`
      )
      .join("\n");
    parts.push(`<div style="margin-bottom:36px"><h2 style="font-size:26px;font-weight:800;margin:0 0 20px">What Others Say</h2>${tHtml}</div>`);
  }

  if (angleData.shockingStat)
    parts.push(
      `<div style="margin-bottom:36px;background:#fff8f0;border-left:4px solid #FF5B1D;padding:24px"><p style="font-size:20px;font-weight:700;margin:0">${esc(angleData.shockingStat)}</p></div>`
    );

  if (angleData.scarcityUrgency)
    parts.push(
      `<div style="margin-bottom:36px;background:#fff8f0;border:1px solid #FF5B1D;padding:20px;border-radius:8px"><p style="font-size:16px;margin:0">${esc(angleData.scarcityUrgency)}</p></div>`
    );

  if (angleData.timeSavingBenefit)
    parts.push(section("Save Time", esc(angleData.timeSavingBenefit)));

  if (Array.isArray(angleData.consultationOutline) && angleData.consultationOutline.length) {
    const steps = angleData.consultationOutline
      .map(
        (o: any, i: number) =>
          `<div style="display:flex;gap:16px;margin-bottom:16px"><span style="font-size:24px;font-weight:900;color:#FF5B1D;min-width:32px">${i + 1}</span><div><strong>${esc(o.title || "")}</strong><p style="margin:4px 0 0;color:#555">${esc(o.description || "")}</p></div></div>`
      )
      .join("\n");
    parts.push(`<div style="margin-bottom:36px"><h2 style="font-size:26px;font-weight:800;margin:0 0 20px">What Happens Next</h2>${steps}</div>`);
  }

  if (Array.isArray(angleData.faq) && angleData.faq.length) {
    const faqHtml = angleData.faq
      .map(
        (f: any) =>
          `<details style="margin-bottom:12px;border:1px solid #e5e5e5;border-radius:6px;padding:16px"><summary style="font-weight:700;cursor:pointer">${esc(f.question || "")}</summary><p style="margin:12px 0 0;color:#555">${esc(f.answer || "")}</p></details>`
      )
      .join("\n");
    parts.push(`<div style="margin-bottom:36px"><h2 style="font-size:26px;font-weight:800;margin:0 0 20px">FAQ</h2>${faqHtml}</div>`);
  }

  parts.push(ctaBtn(ctaLabel));
  parts.push(`</body></html>`);
  return parts.join("\n");
}

// ─── D2 Helper: Create GHL Funnel with a single landing page ──────────────────
async function createGhlFunnel(
  locationId: string,
  headers: Record<string, string>,
  funnelName: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const funnelRes = await fetch(`${GHL_BASE}/locations/${locationId}/funnels`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: funnelName }),
    });
    if (!funnelRes.ok) {
      console.warn("[GHL] Funnel creation failed:", await funnelRes.text());
      return false;
    }
    const funnelData = await funnelRes.json() as any;
    const funnelId: string | undefined =
      funnelData?.id || funnelData?.funnel?.id || funnelData?.data?.id;
    if (!funnelId) {
      console.warn("[GHL] Funnel creation returned no id:", JSON.stringify(funnelData));
      return false;
    }

    // Create a page inside the funnel
    const pageRes = await fetch(`${GHL_BASE}/locations/${locationId}/funnels/${funnelId}/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Main Page", body: htmlBody }),
    });
    if (!pageRes.ok) {
      console.warn("[GHL] Funnel page creation failed:", await pageRes.text());
      // Funnel was created but page failed — still partial success
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[GHL] createGhlFunnel error:", e);
    return false;
  }
}

// ─── D2 Helper: Create GHL WhatsApp Workflow ──────────────────────────────────
async function createWhatsAppWorkflow(
  locationId: string,
  headers: Record<string, string>,
  workflowName: string,
  messages: Array<{ text?: string; message?: string }>
): Promise<boolean> {
  try {
    // Build sequential actions: whatsapp send → 1-day wait → whatsapp send → …
    const actions: any[] = [];
    messages.forEach((msg, i) => {
      actions.push({
        type: "whatsapp",
        body: msg.text || msg.message || "",
      });
      if (i < messages.length - 1) {
        actions.push({
          type: "wait",
          delay: { unit: "days", value: 1 },
        });
      }
    });

    const res = await fetch(`${GHL_BASE}/locations/${locationId}/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: workflowName, status: "draft", actions }),
    });
    if (!res.ok) {
      console.warn("[GHL] Workflow creation failed:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[GHL] createWhatsAppWorkflow error:", e);
    return false;
  }
}

/**
 * GoHighLevel Integration Router
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
   * Get GHL OAuth URL (includes scopes for D1 + D2 features)
   */
  getOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GHL_CLIENT_ID;
    if (!clientId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GHL_CLIENT_ID not configured" });
    }

    const redirectUri = `${process.env.APP_URL || "https://zapcampaigns.com"}/api/oauth/gohighlevel/callback`;
    const scopes = [
      "contacts.write",
      "contacts.readonly",
      "campaigns.readonly",
      "opportunities.write",
      "businesses.readonly",
      "businesses.write",
      "locations.readonly",
      "locations/customValues.write",
      "locations/customValues.readonly",
      "templates.write",
      "templates.readonly",
      "funnels.write",
      "funnels.readonly",
      "workflows.write",
      "workflows.readonly",
    ].join(" ");
    const state = String(ctx.user.id);

    const versionId = process.env.GHL_APP_VERSION_ID || "69af3395095745d484bc1b18";
    const url = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}&version_id=${versionId}`;

    return { url };
  }),

  /**
   * Exchange auth code for access token
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
   * Push campaign kit to GHL.
   * D1: All 7 asset types as Custom Values (upsert).
   * D2: Email Templates per email, GHL Funnel for landing page, WhatsApp Workflow.
   */
  pushCampaign: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ghl] = await db.select().from(ghlAccessTokens).where(eq(ghlAccessTokens.userId, ctx.user.id)).limit(1);
      if (!ghl) throw new TRPCError({ code: "FORBIDDEN", message: "GHL not connected" });

      if (new Date(ghl.tokenExpiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "GHL token expired — please reconnect" });
      }

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      const kitName = kit.name || "Campaign";
      const locationId = ghl.locationId!;

      const results: Record<string, boolean> = {
        // D1
        emailPushed: false,
        whatsappPushed: false,
        landingPagePushed: false,
        headlinesPushed: false,
        adCopyPushed: false,
        offerPushed: false,
        hvcoTitlePushed: false,
        heroMechanismPushed: false,
        // D2
        emailTemplatesPushed: false,
        funnelCreated: false,
        whatsappWorkflowCreated: false,
      };

      const headers: Record<string, string> = {
        Authorization: `Bearer ${ghl.accessToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      };

      // ─── 1. Email Sequence ─────────────────────────────────────────────────────
      if (kit.selectedEmailSequenceId) {
        try {
          const [emailSeq] = await db
            .select()
            .from(emailSequences)
            .where(eq(emailSequences.id, kit.selectedEmailSequenceId))
            .limit(1);
          if (emailSeq) {
            const emails: any[] = Array.isArray(emailSeq.emails)
              ? emailSeq.emails
              : typeof emailSeq.emails === "string"
              ? JSON.parse(emailSeq.emails)
              : [];

            // D1 — Custom Value (full dump)
            const emailText = emails.length
              ? emails.map((e: any, i: number) => `Email ${i + 1}: ${e.subject || ""}\n${e.body || ""}`).join("\n\n---\n\n")
              : "No emails";
            results.emailPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Email Sequence - ${kitName}`,
              emailText
            );

            // D2 — Individual Email Templates (one per email)
            try {
              let allOk = true;
              for (let i = 0; i < emails.length; i++) {
                const em = emails[i];
                const subject = em.subject || `Email ${i + 1}`;
                const body = em.body || "";
                const templateName = `ZAP - ${kitName} - Email ${i + 1}: ${subject}`.substring(0, 100);
                const ok = await upsertEmailTemplate(locationId, headers, templateName, subject, body);
                if (!ok) allOk = false;
              }
              results.emailTemplatesPushed = allOk && emails.length > 0;
            } catch (e2) {
              console.warn("[GHL] D2 email templates error:", e2);
            }
          }
        } catch (e) { console.warn("[GHL] Email push error:", e); }
      }

      // ─── 2. WhatsApp Sequence ──────────────────────────────────────────────────
      if (kit.selectedWhatsAppSequenceId) {
        try {
          const [waSeq] = await db
            .select()
            .from(whatsappSequences)
            .where(eq(whatsappSequences.id, kit.selectedWhatsAppSequenceId))
            .limit(1);
          if (waSeq) {
            const messages: any[] = Array.isArray(waSeq.messages)
              ? waSeq.messages
              : typeof waSeq.messages === "string"
              ? JSON.parse(waSeq.messages)
              : [];

            // D1 — Custom Value
            const waText = messages.length
              ? messages.map((m: any, i: number) => `Message ${i + 1}: ${m.text || m.message || ""}`).join("\n\n---\n\n")
              : "No messages";
            results.whatsappPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP WhatsApp Sequence - ${kitName}`,
              waText
            );

            // D2 — WhatsApp Workflow
            try {
              if (messages.length > 0) {
                results.whatsappWorkflowCreated = await createWhatsAppWorkflow(
                  locationId, headers,
                  `ZAP - ${kitName} - WhatsApp Sequence`,
                  messages
                );
              }
            } catch (e2) {
              console.warn("[GHL] D2 WhatsApp workflow error:", e2);
            }
          }
        } catch (e) { console.warn("[GHL] WhatsApp push error:", e); }
      }

      // ─── 3. Landing Page ───────────────────────────────────────────────────────
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

            // D1 — Custom Value (text dump)
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

            // D2 — GHL Funnel with HTML page
            try {
              if (angleData) {
                const htmlBody = buildLandingPageHtml(angleData);
                results.funnelCreated = await createGhlFunnel(
                  locationId, headers,
                  `ZAP - ${kitName} - Landing Page`,
                  htmlBody
                );
              }
            } catch (e2) {
              console.warn("[GHL] D2 funnel error:", e2);
            }
          }
        } catch (e) { console.warn("[GHL] Landing page push error:", e); }
      }

      // ─── 4. Headlines ──────────────────────────────────────────────────────────
      if (kit.selectedHeadlineId) {
        try {
          const [selectedHL] = await db
            .select()
            .from(headlines)
            .where(eq(headlines.id, kit.selectedHeadlineId))
            .limit(1);
          if (selectedHL) {
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

      // ─── 5. Ad Copy ────────────────────────────────────────────────────────────
      if (kit.selectedAdCopyId) {
        try {
          const [selectedAd] = await db
            .select()
            .from(adCopy)
            .where(eq(adCopy.id, kit.selectedAdCopyId))
            .limit(1);
          if (selectedAd) {
            const allAds = await db
              .select()
              .from(adCopy)
              .where(eq(adCopy.adSetId, selectedAd.adSetId));
            const adHeadlines = allAds.filter(a => a.contentType === "headline");
            const adBodies    = allAds.filter(a => a.contentType === "body");
            const adLinks     = allAds.filter(a => a.contentType === "link");

            const sections: string[] = [];
            if (adHeadlines.length)
              sections.push("AD HEADLINES\n" + adHeadlines.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));
            if (adBodies.length)
              sections.push("AD BODY COPY\n" + adBodies.map((a, i) => `--- Body ${i + 1} ---\n${a.content}`).join("\n\n"));
            if (adLinks.length)
              sections.push("LINK DESCRIPTIONS\n" + adLinks.map((a, i) => `${i + 1}. ${a.content}`).join("\n"));

            results.adCopyPushed = await upsertCustomValue(
              locationId, headers,
              `ZAP Ad Copy - ${kitName}`,
              sections.join("\n\n") || "No ad copy"
            );
          }
        } catch (e) { console.warn("[GHL] Ad copy push error:", e); }
      }

      // ─── 6. Offer Copy ─────────────────────────────────────────────────────────
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
                label,
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

      // ─── 7. HVCO / Lead Magnet Title ───────────────────────────────────────────
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

      // ─── 8. Hero Mechanism ─────────────────────────────────────────────────────
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
