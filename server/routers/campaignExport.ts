/**
 * D2b — Campaign ZIP Download
 * tRPC router: campaignExport.generateCampaignZip
 *
 * Fetches all generated assets for a service, builds a structured ZIP in memory
 * using jszip, and returns a base64-encoded string the client can download directly.
 */

import { z } from "zod";
import JSZip from "jszip";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  services,
  adCopy,
  headlines,
  landingPages,
  emailSequences,
  whatsappSequences,
  offers,
  hvcoTitles,
  heroMechanisms,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Deployment headers ────────────────────────────────────────────────────────

const DEPLOY = {
  adCopy: "DEPLOYMENT: Copy each ad set below and paste directly into Meta Ads Manager > Ads > Create Ad > Primary Text.\n\n",
  headlines: "DEPLOYMENT: Use these headlines in Meta Ads Manager > Ads > Create Ad > Headline field, or on your landing page hero section.\n\n",
  landingPage: "DEPLOYMENT: Copy each section below into your landing page builder (GoHighLevel, Kajabi, etc.) section by section.\n\n",
  emailSequence: "DEPLOYMENT: Import or paste each email below into your email marketing platform (GoHighLevel, ActiveCampaign, Mailchimp, etc.) as a new automation step.\n\n",
  whatsappSequence: "DEPLOYMENT: Paste each message below into your GoHighLevel Workflow as individual WhatsApp message actions, in order.\n\n",
  offerCopy: "DEPLOYMENT: Use this copy on your sales page, checkout page, or when describing your offer verbally in discovery calls.\n\n",
  leadMagnet: "DEPLOYMENT: Use this as the title and outline for your lead magnet / HVCO. Deliver it as a PDF, video, or live workshop.\n\n",
  heroMechanism: "DEPLOYMENT: This is your unique method name and explanation. Use it in all your marketing, your program name, and your sales conversations.\n\n",
  metaAds: "DEPLOYMENT: This file is formatted specifically for Meta Ads Manager. Go to Meta Business Suite > Ads > Create > paste each ad set as a separate ad.\n\n",
  ghlEmail: "DEPLOYMENT: In GoHighLevel, go to Marketing > Emails > Templates > New Template. Paste each email as a separate template.\n\n",
  ghlWhatsapp: "DEPLOYMENT: In GoHighLevel, go to Automation > Workflows > New Workflow. Add a WhatsApp action for each message below.\n\n",
  ghlLanding: "DEPLOYMENT: In GoHighLevel, go to Sites > Funnels > New Funnel. Copy each section below into the corresponding funnel step.\n\n",
};

// ─── Content builders ──────────────────────────────────────────────────────────

function buildAdCopyContent(rows: any[]): string {
  if (rows.length === 0) return "(No ad copy generated yet.)";
  // Group by adSetId
  const sets = new Map<string, any[]>();
  for (const row of rows) {
    const existing = sets.get(row.adSetId) || [];
    existing.push(row);
    sets.set(row.adSetId, existing);
  }
  const parts: string[] = [];
  let setNum = 1;
  for (const [, ads] of Array.from(sets.entries())) {
    const first = ads[0];
    const label = [first.adStyle, first.adCallToAction].filter(Boolean).join(" — ") || `Ad Set ${setNum}`;
    parts.push(`=== ${label} ===\n`);
    const bodies = ads.filter((a: any) => a.contentType === "body");
    const headlineRows = ads.filter((a: any) => a.contentType === "headline");
    const links = ads.filter((a: any) => a.contentType === "link");
    if (headlineRows.length) {
      parts.push("HEADLINES:");
      headlineRows.forEach((a: any, i: number) => parts.push(`  ${i + 1}. ${a.content}`));
      parts.push("");
    }
    if (bodies.length) {
      parts.push("BODY COPY:");
      bodies.forEach((a: any, i: number) => parts.push(`  Variation ${i + 1}:\n  ${a.content}\n`));
    }
    if (links.length) {
      parts.push("LINK TEXT:");
      links.forEach((a: any, i: number) => parts.push(`  ${i + 1}. ${a.content}`));
      parts.push("");
    }
    parts.push("\n---\n");
    setNum++;
  }
  return parts.join("\n");
}

function buildHeadlinesContent(rows: any[]): string {
  if (rows.length === 0) return "(No headlines generated yet.)";
  // Use the most recent headlineSetId
  const setIds = Array.from(new Set(rows.map((h: any) => h.headlineSetId)));
  const latestSetId = setIds[setIds.length - 1];
  const latestSet = rows.filter((h: any) => h.headlineSetId === latestSetId);
  const formulaOrder = ["story", "eyebrow", "question", "authority", "urgency"];
  const parts: string[] = [];
  for (const formula of formulaOrder) {
    const group = latestSet.filter((h: any) => h.formulaType === formula);
    if (group.length === 0) continue;
    parts.push(`=== ${formula.toUpperCase()} HEADLINES ===\n`);
    group.forEach((h: any, i: number) => {
      parts.push(`${i + 1}. ${h.headline}`);
      if (h.eyebrow) parts.push(`   [Eyebrow: ${h.eyebrow}]`);
      if (h.subheadline) parts.push(`   [Sub: ${h.subheadline}]`);
    });
    parts.push("");
  }
  return parts.join("\n");
}

function buildLandingPageContent(rows: any[]): string {
  if (rows.length === 0) return "(No landing page generated yet.)";
  const page = rows[0];
  const angles: Array<{ key: string; label: string }> = [
    { key: "originalAngle", label: "ORIGINAL ANGLE" },
    { key: "godfatherAngle", label: "GODFATHER ANGLE" },
    { key: "freeAngle", label: "FREE ANGLE" },
    { key: "dollarAngle", label: "DOLLAR ANGLE" },
  ];
  const parts: string[] = [];
  if (page.activeAngle) {
    parts.push(`Active angle: ${page.activeAngle.toUpperCase()}\n`);
  }
  for (const { key, label } of angles) {
    const angle = (page as any)[key];
    if (!angle) continue;
    parts.push(`=== ${label} ===\n`);
    // Key names validated against LandingPageContent schema in drizzle/schema.ts — update if schema changes.
    const fields: Array<{ field: string; label: string }> = [
      { field: "eyebrowHeadline", label: "Eyebrow Headline" },
      { field: "mainHeadline", label: "Main Headline" },
      { field: "subheadline", label: "Subheadline" },
      { field: "primaryCta", label: "Primary CTA" },
      { field: "problemAgitation", label: "Problem Agitation" },
      { field: "solutionIntro", label: "Solution Introduction" },
      { field: "whyOldFail", label: "Why Old Solutions Fail" },
      { field: "uniqueMechanism", label: "Unique Mechanism" },
      { field: "insiderAdvantages", label: "Insider Advantages" },
      { field: "scarcityUrgency", label: "Scarcity & Urgency" },
      { field: "shockingStat", label: "Shocking Statistic" },
      { field: "timeSavingBenefit", label: "Time-Saving Benefit" },
    ];
    for (const { field, label: fieldLabel } of fields) {
      if (angle?.[field]) {
        parts.push(`[${fieldLabel}]\n${angle[field]}\n`);
      }
    }
    // asSeenIn
    if (Array.isArray(angle?.asSeenIn) && angle.asSeenIn.length > 0) {
      parts.push(`[As Seen In]\n${(angle.asSeenIn as string[]).join(", ")}\n`);
    }
    // quizSection
    if (angle?.quizSection?.question) {
      const q = angle.quizSection;
      const opts = Array.isArray(q.options) ? (q.options as string[]).map((o: string, i: number) => `  ${i + 1}. ${o}`).join("\n") : "";
      parts.push(`[Quiz Section]\nQuestion: ${q.question}\nOptions:\n${opts}\nAnswer: ${q.answer ?? ""}\n`);
    }
    // testimonials
    if (Array.isArray(angle?.testimonials) && angle.testimonials.length > 0) {
      parts.push("[Testimonials]");
      (angle.testimonials as any[]).forEach((t: any, i: number) => {
        parts.push(`  ${i + 1}. ${t?.name ?? ""} / ${t?.location ?? ""}\n     "${t?.quote ?? ""}"`);
        if (t?.headline) parts.push(`     Headline: ${t.headline}`);
      });
      parts.push("");
    }
    // consultationOutline
    if (Array.isArray(angle?.consultationOutline) && angle.consultationOutline.length > 0) {
      parts.push("[Consultation Outline]");
      (angle.consultationOutline as any[]).forEach((item: any, i: number) => {
        parts.push(`  ${i + 1}. ${item?.title ?? ""}: ${item?.description ?? ""}`);
      });
      parts.push("");
    }
    // faq
    if (Array.isArray(angle?.faq) && angle.faq.length > 0) {
      parts.push("[FAQ]");
      (angle.faq as any[]).forEach((item: any, i: number) => {
        parts.push(`  Q${i + 1}: ${item?.question ?? ""}\n  A${i + 1}: ${item?.answer ?? ""}`);
      });
      parts.push("");
    }
    parts.push("\n---\n");
  }
  return parts.join("\n");
}

function buildEmailSequenceContent(rows: any[]): string {
  if (rows.length === 0) return "(No email sequence generated yet.)";
  const parts: string[] = [];
  for (const seq of rows) {
    parts.push(`=== ${seq.name}${seq.sequenceType ? ` (${seq.sequenceType})` : ""} ===\n`);
    const emails = (seq.emails as Array<{ day: number; subject: string; body: string; timing: string }>) || [];
    const sorted = [...emails].sort((a, b) => a.day - b.day);
    for (const email of sorted) {
      parts.push(`--- Day ${email.day}: ${email.subject} ---`);
      if (email.timing) parts.push(`Timing: ${email.timing}`);
      parts.push(`\n${email.body}\n`);
    }
    parts.push("\n");
  }
  return parts.join("\n");
}

function buildWhatsappSequenceContent(rows: any[]): string {
  if (rows.length === 0) return "(No WhatsApp sequence generated yet.)";
  const parts: string[] = [];
  for (const seq of rows) {
    parts.push(`=== ${seq.name}${seq.sequenceType ? ` (${seq.sequenceType})` : ""} ===\n`);
    const messages = (seq.messages as Array<{ day: number; message: string; timing: string; emojis: string[] }>) || [];
    const sorted = [...messages].sort((a, b) => a.day - b.day);
    for (const msg of sorted) {
      const emojiStr = Array.isArray(msg.emojis) && msg.emojis.length > 0 ? ` ${msg.emojis.join(" ")}` : "";
      parts.push(`--- Day ${msg.day}${emojiStr} ---`);
      if (msg.timing) parts.push(`Timing: ${msg.timing}`);
      parts.push(`\n${msg.message}\n`);
    }
    parts.push("\n");
  }
  return parts.join("\n");
}

function buildOfferContent(rows: any[]): string {
  if (rows.length === 0) return "(No offer generated yet.)";
  const parts: string[] = [];
  for (const offer of rows) {
    parts.push(`=== ${offer.productName || "Offer"} ===\n`);
    const angles: Array<{ key: string; label: string }> = [
      { key: "godfatherAngle", label: "Godfather Angle" },
      { key: "freeAngle", label: "Free Angle" },
      { key: "dollarAngle", label: "Dollar Angle" },
    ];
    for (const { key, label } of angles) {
      const angle = (offer as any)[key];
      if (!angle) continue;
      parts.push(`[${label}]`);
      if (angle.offerName) parts.push(`Offer Name: ${angle.offerName}`);
      if (angle.valueProposition) parts.push(`Value Proposition: ${angle.valueProposition}`);
      if (angle.pricing) parts.push(`Pricing: ${angle.pricing}`);
      if (angle.bonuses) parts.push(`Bonuses: ${angle.bonuses}`);
      if (angle.guarantee) parts.push(`Guarantee: ${angle.guarantee}`);
      if (angle.urgency) parts.push(`Urgency: ${angle.urgency}`);
      if (angle.cta) parts.push(`CTA: ${angle.cta}`);
      parts.push("");
    }
    parts.push("\n---\n");
  }
  return parts.join("\n");
}

function buildLeadMagnetContent(rows: any[]): string {
  if (rows.length === 0) return "(No lead magnet titles generated yet.)";
  // Most recent hvcoSetId
  const setIds = Array.from(new Set(rows.map((t: any) => t.hvcoSetId)));
  const latestSetId = setIds[setIds.length - 1];
  const latestSet = rows.filter((t: any) => t.hvcoSetId === latestSetId);
  const tabOrder = ["long", "short", "beast_mode", "subheadlines"];
  const parts: string[] = [];
  for (const tab of tabOrder) {
    const group = latestSet.filter((t: any) => t.tabType === tab);
    if (group.length === 0) continue;
    parts.push(`=== ${tab.toUpperCase().replace("_", " ")} ===\n`);
    group.forEach((t: any, i: number) => parts.push(`${i + 1}. ${t.title}`));
    parts.push("");
  }
  return parts.join("\n");
}

function buildHeroMechanismContent(rows: any[]): string {
  if (rows.length === 0) return "(No hero mechanism generated yet.)";
  // Most recent mechanismSetId
  const setIds = Array.from(new Set(rows.map((m: any) => m.mechanismSetId)));
  const latestSetId = setIds[setIds.length - 1];
  const latestSet = rows.filter((m: any) => m.mechanismSetId === latestSetId);
  const tabOrder = ["hero_mechanisms", "headline_ideas", "beast_mode"];
  const parts: string[] = [];
  for (const tab of tabOrder) {
    const group = latestSet.filter((m: any) => m.tabType === tab);
    if (group.length === 0) continue;
    parts.push(`=== ${tab.toUpperCase().replace("_", " ")} ===\n`);
    group.forEach((m: any, i: number) => {
      parts.push(`${i + 1}. ${m.mechanismName}`);
      parts.push(`${m.mechanismDescription}\n`);
    });
  }
  return parts.join("\n");
}

// ─── tRPC Router ───────────────────────────────────────────────────────────────

export const campaignExportRouter = router({
  /**
   * Read-only ZIP generation — no DB writes.
   * Intentionally a mutation to prevent React Query caching stale ZIPs.
   * Note: mutations do not auto-retry on failure, which is correct behaviour here.
   */
  generateCampaignZip: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sanitizeName = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').trim();
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { serviceId } = input;
      const userId = ctx.user.id;

      // 1. Verify service ownership
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, serviceId), eq(services.userId, userId)))
        .limit(1);

      if (!service) throw new Error("Service not found");

      const serviceName = service.name || "My Service";

      // 2. Fetch all asset rows for this service (owned by this user)
      const [adCopyRows, headlineRows, landingPageRows, emailRows, whatsappRows, offerRows, hvcoRows, heroRows] =
        await Promise.all([
          db.select().from(adCopy).where(and(eq(adCopy.serviceId, serviceId), eq(adCopy.userId, userId))).orderBy(desc(adCopy.createdAt)),
          db.select().from(headlines).where(and(eq(headlines.serviceId, serviceId), eq(headlines.userId, userId))).orderBy(desc(headlines.createdAt)),
          db.select().from(landingPages).where(and(eq(landingPages.serviceId, serviceId), eq(landingPages.userId, userId))).orderBy(desc(landingPages.createdAt)).limit(1),
          db.select().from(emailSequences).where(and(eq(emailSequences.serviceId, serviceId), eq(emailSequences.userId, userId))).orderBy(desc(emailSequences.createdAt)),
          db.select().from(whatsappSequences).where(and(eq(whatsappSequences.serviceId, serviceId), eq(whatsappSequences.userId, userId))).orderBy(desc(whatsappSequences.createdAt)),
          db.select().from(offers).where(and(eq(offers.serviceId, serviceId), eq(offers.userId, userId))).orderBy(desc(offers.createdAt)),
          db.select().from(hvcoTitles).where(and(eq(hvcoTitles.serviceId, serviceId), eq(hvcoTitles.userId, userId))).orderBy(desc(hvcoTitles.createdAt)),
          db.select().from(heroMechanisms).where(and(eq(heroMechanisms.serviceId, serviceId), eq(heroMechanisms.userId, userId))).orderBy(desc(heroMechanisms.createdAt)),
        ]);

      // 3. Build file content strings
      const adCopyText = buildAdCopyContent(adCopyRows);
      const headlinesText = buildHeadlinesContent(headlineRows);
      const landingPageText = buildLandingPageContent(landingPageRows);
      const emailText = buildEmailSequenceContent(emailRows);
      const whatsappText = buildWhatsappSequenceContent(whatsappRows);
      const offerText = buildOfferContent(offerRows);
      const leadMagnetText = buildLeadMagnetContent(hvcoRows);
      const heroMechanismText = buildHeroMechanismContent(heroRows);

      // 4. Count assets for Campaign Brief
      const adSetCount = new Set(adCopyRows.filter((a: any) => a.contentType === "body").map((a: any) => a.adSetId)).size;
      const setIds = Array.from(new Set(headlineRows.map((h: any) => h.headlineSetId)));
      const latestHeadlineSetId = setIds[setIds.length - 1];
      const headlineCount = latestHeadlineSetId ? headlineRows.filter((h: any) => h.headlineSetId === latestHeadlineSetId).length : 0;
      const lpSections = landingPageRows.length > 0 ? Object.keys(landingPageRows[0].originalAngle || {}).length : 0;
      const emailCount = emailRows.reduce((acc: number, seq: any) => acc + ((seq.emails as any[] | null)?.length || 0), 0);
      const whatsappCount = whatsappRows.reduce((acc: number, seq: any) => acc + ((seq.messages as any[] | null)?.length || 0), 0);

      // 5. Campaign Brief
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      const heroMechanismName = heroRows.length > 0 ? heroRows[0].mechanismName : "";
      const offerName = offerRows.length > 0 ? (offerRows[0].productName || "") : "";
      const hvcoTitle = hvcoRows.length > 0 ? hvcoRows[0].title : "";

      const campaignBrief = [
        "ZAP CAMPAIGN BRIEF",
        "==================",
        `Generated: ${dateStr}`,
        "",
        `SERVICE: ${serviceName}`,
        `CATEGORY: ${service.category || ""}`,
        `TARGET CUSTOMER: ${service.targetCustomer || ""}`,
        `MAIN BENEFIT: ${service.mainBenefit || ""}`,
        `PRICE: ${service.price ? `$${service.price}` : "Not set"}`,
        "",
        `UNIQUE METHOD: ${heroMechanismName || "Not generated yet"}`,
        `OFFER: ${offerName || "Not generated yet"}`,
        `LEAD MAGNET: ${hvcoTitle || "Not generated yet"}`,
        "",
        "ASSETS GENERATED:",
        `- Ad Copy: ${adSetCount} ad set${adSetCount !== 1 ? "s" : ""}`,
        `- Headlines: ${headlineCount} headline${headlineCount !== 1 ? "s" : ""}`,
        `- Landing Page: ${lpSections > 0 ? `${lpSections} sections` : "Not generated yet"}`,
        `- Email Sequence: ${emailCount} email${emailCount !== 1 ? "s" : ""}`,
        `- WhatsApp Sequence: ${whatsappCount} message${whatsappCount !== 1 ? "s" : ""}`,
        `- Offer Copy: ${offerRows.length > 0 ? "included" : "not generated yet"}`,
        `- Lead Magnet outline: ${hvcoRows.length > 0 ? "included" : "not generated yet"}`,
        `- Hero Mechanism: ${heroRows.length > 0 ? "included" : "not generated yet"}`,
      ].join("\n");

      // 6. Build ZIP
      const zip = new JSZip();
      const folder = zip.folder(`ZAP - ${sanitizeName(serviceName)} - Campaign Kit`);
      if (!folder) throw new Error("Failed to create ZIP folder");

      folder.file("1. Ad Copy.txt", DEPLOY.adCopy + adCopyText);
      folder.file("2. Headlines.txt", DEPLOY.headlines + headlinesText);
      folder.file("3. Landing Page.txt", DEPLOY.landingPage + landingPageText);
      folder.file("4. Email Sequence.txt", DEPLOY.emailSequence + emailText);
      folder.file("5. WhatsApp Sequence.txt", DEPLOY.whatsappSequence + whatsappText);
      folder.file("6. Offer Copy.txt", DEPLOY.offerCopy + offerText);
      folder.file("7. Lead Magnet.txt", DEPLOY.leadMagnet + leadMagnetText);
      folder.file("8. Hero Mechanism.txt", DEPLOY.heroMechanism + heroMechanismText);
      folder.file("Campaign Brief.txt", campaignBrief);

      // Meta Ads subfolder
      const metaFolder = folder.folder("Meta Ads");
      if (metaFolder) {
        metaFolder.file(
          "Ad Copy - Ready to paste into Meta Ads Manager.txt",
          DEPLOY.metaAds + adCopyText
        );
      }

      // GHL subfolder
      const ghlFolder = folder.folder("GHL");
      if (ghlFolder) {
        ghlFolder.file(
          "Email Templates - Paste into GHL Email Services.txt",
          DEPLOY.ghlEmail + emailText
        );
        ghlFolder.file(
          "WhatsApp Sequence - Paste into GHL Workflow.txt",
          DEPLOY.ghlWhatsapp + whatsappText
        );
        ghlFolder.file(
          "Landing Page - All Sections.txt",
          DEPLOY.ghlLanding + landingPageText
        );
      }

      // 7. Generate base64
      const base64 = await zip.generateAsync({ type: "base64" });

      const filename = `ZAP - ${sanitizeName(serviceName)} - Campaign Kit.zip`;

      return { filename, base64 };
    }),
});
