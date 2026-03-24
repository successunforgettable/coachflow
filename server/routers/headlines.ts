import { z } from "zod";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  createHeadlines,
  getHeadlinesByUserId,
  getHeadlinesBySetId,
  updateHeadlineRating,
  deleteHeadlineSet,
  incrementHeadlineCount,
  getDb,
} from "../db";
import { headlines, jobs, campaignKits, offers, hvcoTitles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { checkCompliance } from "../lib/complianceChecker";
import { scoreItem } from "../lib/selectionScorer";
import { autoSelectBest } from "./campaignKits";
import { idealCustomerProfiles } from "../../drizzle/schema";

// Helper to strip markdown code blocks from LLM responses
function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}

// Industry standard
const FORMULA_PROMPTS = {
  story: `Generate 5 story-based headlines using this EXACT format:
"How a [Triggering Event] Led/Pushed/Triggered a [Person] to [Discovery] that [Result]!"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Use varied triggering events (embarrassing moment, unexpected discovery, crisis, weekend event, etc.)
- Make the person relatable to target market
- Highlight the unique mechanism as the discovery
- Promise the desired outcome as the result
- HARD LIMIT: Every headline MUST be 40 characters or fewer. This is a Meta ad platform requirement — no exceptions. If a headline would exceed 40 characters, rewrite it shorter while preserving the hook and meaning. Never truncate mid-word.
- Return ONLY a JSON array of 5 headline strings, nothing else

Example output format:
["How a Crisis Led Her to $10k/Month", "One Bad Trade Led to a Breakthrough", "A Weekend Mistake Changed Everything", "How She Found the 9-Step Blueprint", "One Discovery Turned Losses to Wins"]`,

  eyebrow: `Generate 5 three-part headlines with eyebrow, main headline, and subheadline:

Eyebrow format: "[Authority] Unveils/Reveals"
Main format: "[Unique Mechanism] Turns [Audience] into [Result]"
Subheadline format: "Without [Pain Point 1], [Pain Point 2] or [Pain Point 3]"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Eyebrow should establish authority/credibility
- Main headline should feature the unique mechanism prominently
- Subheadline should address 3 pain points from pressing problem
- Return ONLY a JSON array of 5 objects with this structure: {"eyebrow": "...", "main": "...", "sub": "..."}

Example output format:
[{"eyebrow": "Award-winning Mind Coach Unveils", "main": "9-Step Crypto Wealth System Turns Beginners into $10k/Month Moneymakers", "sub": "Without Endless Hours Learning or Losing Money on Bad Trades"}, ...]`,

  question: `Generate 5 question-based headlines that highlight obstacles or mistakes:

Format: "[Question about obstacle/mistake]?"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}

Requirements:
- Frame as a question that makes reader think "yes, that's me"
- Focus on hidden obstacles, sneaky pitfalls, or overlooked mistakes
- Use words like "preventing", "stopping", "sabotaging", "devouring", "sapping"
- Each question should be 10-20 words
- Return ONLY a JSON array of 5 question strings, nothing else

Example output format:
["One Sneaky Crypto Pitfall Preventing You from Generating a $10k Monthly Income?", "Could this Commonly Overlooked Crypto Risk be Sapping Your Potential Earnings?", ...]`,

  authority: `Generate 5 authority-based headlines with main headline and subheadline:

Main format: "[Authority Figure] [Action] [Unique Mechanism] [Result]"
Subheadline format: "This is why [Old Way 1], [Old Way 2], and [Old Way 3] have failed to produce [Desired Outcome]"

Context:
- Target Market: {targetMarket}
- Pressing Problem: {pressingProblem}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Authority figure should be credible (award-winning, published, certified, etc.)
- Action verbs: unearthed, discovered, revealed, disclosed, unveiled
- Subheadline should debunk 3 old/failed methods
- Return ONLY a JSON array of 5 objects with this structure: {"main": "...", "sub": "..."}

Example output format:
[{"main": "Award-Winning Mind Coach Unearthed Hidden 'Crypto Code' Transforming Newbies into Fortunate Investors", "sub": "This is why day trading, HODLing, and technical analysis have failed to produce consistent crypto income"}, ...]`,

  urgency: `Generate 5 urgency-based headlines with specific timeframes:

Format: "[Action] [Unique Mechanism], and [Result] in [Timeframe]!"

Context:
- Target Market: {targetMarket}
- Desired Outcome: {desiredOutcome}
- Unique Mechanism: {uniqueMechanism}

Requirements:
- Start with action verbs: Discover, Unearth, Leverage, Unlock, Access
- Include specific timeframe: "in 30 days", "in 6 months", "in just one month", "under 30 days"
- Promise the desired outcome
- Use exciting result language: "skyrocket", "rains", "pull in", "multiply"
- Return ONLY a JSON array of 5 headline strings, nothing else

Example output format:
["Unearth Crypto Millionaire Blueprint, and Pull in $10k in Under 30 Days!", "Discover 9-Step Program That Rains Passive-Income in 6 Months!", ...]`,
};

export const headlinesRouter = router({
  // List all headline sets for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const allHeadlines = await getHeadlinesByUserId(ctx.user.id);
    
    // Group by headlineSetId
    const sets = new Map<string, any>();
    allHeadlines.forEach((headline) => {
      if (!sets.has(headline.headlineSetId)) {
        sets.set(headline.headlineSetId, {
          headlineSetId: headline.headlineSetId,
          serviceId: headline.serviceId,
          targetMarket: headline.targetMarket,
          pressingProblem: headline.pressingProblem,
          desiredOutcome: headline.desiredOutcome,
          createdAt: headline.createdAt,
          count: 0,
        });
      }
      const set = sets.get(headline.headlineSetId)!;
      set.count += 1;
    });
    
    return Array.from(sets.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }),

  // Get all headlines in a set
  getBySetId: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const headlines = await getHeadlinesBySetId(input.headlineSetId, ctx.user.id);
      
      if (headlines.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Headline set not found",
        });
      }
      
      // Group by formula type
      const grouped = {
        story: headlines.filter(h => h.formulaType === "story"),
        eyebrow: headlines.filter(h => h.formulaType === "eyebrow"),
        question: headlines.filter(h => h.formulaType === "question"),
        authority: headlines.filter(h => h.formulaType === "authority"),
        urgency: headlines.filter(h => h.formulaType === "urgency"),
      };
      
      return {
        headlineSetId: input.headlineSetId,
        headlines: grouped,
        metadata: {
          serviceId: headlines[0].serviceId,
          targetMarket: headlines[0].targetMarket,
          pressingProblem: headlines[0].pressingProblem,
          desiredOutcome: headlines[0].desiredOutcome,
          uniqueMechanism: headlines[0].uniqueMechanism,
          createdAt: headlines[0].createdAt,
        },
      };
    }),

  // Generate new headline set (25 headlines: 5 per formula type, or 75 with Power Mode)
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string(),
        desiredOutcome: z.string(),
        uniqueMechanism: z.string(),
        powerMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "headlines");

      // Fetch service data for AutoPop if serviceId provided
      // NOTE: pre-existing issue — this fetch does not check userId (flagged for future security pass, not fixed in 1.2)
      let autoPopData: any = {};
      let icpContext = '';
      let sotContext = '';
      if (input.serviceId) {
        const { getDb } = await import("../db");
        const { services, idealCustomerProfiles } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const serviceData = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
        if (serviceData.length > 0) {
          const service = serviceData[0];
          autoPopData = {
            avatarName: service.avatarName,
            avatarTitle: service.avatarTitle,
            mechanismDescriptor: service.mechanismDescriptor,
            // Item 1.3 — Rule 4: server-side fallbacks
            resolvedPressingProblem: input.pressingProblem?.trim() || service.painPoints || "",
            resolvedDesiredOutcome: input.desiredOutcome?.trim() || service.mainBenefit || "",
            resolvedUniqueMechanism: input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "",
          };
        }
        // Campaign fetch — Item 1.1b (icpId support)
        let campaignRecord;
        if (input.campaignId) {
          const { campaigns } = await import("../../drizzle/schema");
          const { and: andOp } = await import("drizzle-orm");
          [campaignRecord] = await db
            .select()
            .from(campaigns)
            .where(andOp(eq(campaigns.id, input.campaignId), eq(campaigns.userId, ctx.user.id)))
            .limit(1);
        }

        // ICP fetch — Item 1.1b: campaign-specific ICP first, serviceId fallback
        let icp;
        if (campaignRecord?.icpId) {
          [icp] = await db.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
        }
        if (!icp) {
          [icp] = await db.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        }
        if (icp) {
          icpContext = [
            'IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:',
            icp.pains ? `Their daily pains: ${icp.pains}` : '',
            icp.fears ? `Their deep fears: ${icp.fears}` : '',
            icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : '',
          ].filter(Boolean).join('\n').trim();
        }

        // SOT query — Item 1.4
        const { sourceOfTruth } = await import("../../drizzle/schema");
        const [sot] = await db
          .select()
          .from(sourceOfTruth)
          .where(eq(sourceOfTruth.userId, ctx.user.id))
          .limit(1);
        const sotLines = sot ? [
          sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
          sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
          sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
          sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
          sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
          sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
        ].filter(Boolean) : [];
        sotContext = sotLines.length > 0
          ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
          : '';
      }

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota (Pro plan: 6 per month)
        const maxHeadlines = ctx.user.subscriptionTier === "agency" ? 20 : 6;
        if (ctx.user.headlineGeneratedCount >= maxHeadlines) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${maxHeadlines} headline sets. Upgrade to generate more.`,
          });
        }
      }

      // ── Cascade context from Campaign Kit ──
      let cascadeContext = "";
      try {
        const [relIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        if (relIcp) {
          const [kit] = await db.select().from(campaignKits).where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, relIcp.id))).limit(1);
          if (kit) {
            const parts: string[] = [];
            if (kit.selectedOfferId) {
              const [offer] = await db.select().from(offers).where(eq(offers.id, kit.selectedOfferId)).limit(1);
              if (offer) parts.push(`The selected offer angle is: ${offer.activeAngle || "godfather"}`);
            }
            if (kit.selectedHvcoId) {
              const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, kit.selectedHvcoId)).limit(1);
              if (hvco) parts.push(`The lead magnet is: ${hvco.title}`);
            }
            if (parts.length > 0) {
              cascadeContext = `\n\nUPSTREAM CONTEXT — SELECTED ASSETS:\n${parts.join(". ")}. Headline tone must match whether it is promoting the free lead magnet or the high-ticket offer.\n\n`;
            }
          }
        }
      } catch (e) { console.warn("[cascade] headlines context fetch failed:", e); }

      const headlineSetId = nanoid();
      const allHeadlines: Array<typeof headlines.$inferInsert> = [];
      const countMultiplier = input.powerMode ? 3 : 1; // Power Mode generates 3x more

      // Generate headlines for each formula type
      for (const [formulaType, promptTemplate] of Object.entries(FORMULA_PROMPTS)) {
        // Modify prompt to generate 3x more if Power Mode is enabled
        const modifiedTemplate = promptTemplate.replace(/Generate 5/g, `Generate ${5 * countMultiplier}`);
        // Item 1.3 — use resolved values (server fallback from service record)
        const resolvedPressingProblem = autoPopData.resolvedPressingProblem ?? input.pressingProblem;
        const resolvedDesiredOutcome = autoPopData.resolvedDesiredOutcome ?? input.desiredOutcome;
        const resolvedUniqueMechanism = autoPopData.resolvedUniqueMechanism ?? input.uniqueMechanism;
        const prompt = modifiedTemplate
          .replace(/{targetMarket}/g, input.targetMarket)
          .replace(/{pressingProblem}/g, resolvedPressingProblem)
          .replace(/{desiredOutcome}/g, resolvedDesiredOutcome)
          .replace(/{uniqueMechanism}/g, resolvedUniqueMechanism);

        // Inject SOT as outermost layer, then ICP — Item 1.2 + 1.4
        const promptWithIcp = icpContext ? prompt.replace(/\n\nGenerate /, `\n\n${icpContext}\n\nGenerate `) : prompt;
        const promptWithSot = sotContext ? `${sotContext}\n\n${promptWithIcp}` : promptWithIcp;
        const promptWithCascade = cascadeContext ? `${cascadeContext}${promptWithSot}` : promptWithSot;

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are an expert direct response copywriter. Return ONLY valid JSON, no markdown, no explanations.",
              },
              { role: "user", content: promptWithCascade },
            ],
          });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") {
            throw new Error("Invalid LLM response");
          }
          const parsed = JSON.parse(stripMarkdownJson(content));

          // Handle different formula types
          if (formulaType === "story" || formulaType === "question" || formulaType === "urgency") {
            // Simple string array
            parsed.forEach((headline: string) => {
              allHeadlines.push({
                userId: ctx.user.id,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: formulaType as any,
                headline,
                subheadline: null,
                eyebrow: null,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "eyebrow") {
            // Eyebrow + main + sub
            parsed.forEach((item: { eyebrow: string; main: string; sub: string }) => {
              allHeadlines.push({
                userId: ctx.user.id,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "eyebrow",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: item.eyebrow,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          } else if (formulaType === "authority") {
            // Main + sub
            parsed.forEach((item: { main: string; sub: string }) => {
              allHeadlines.push({
                userId: ctx.user.id,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                headlineSetId,
                formulaType: "authority",
                headline: item.main,
                subheadline: item.sub,
                eyebrow: null,
                targetMarket: input.targetMarket,
                pressingProblem: input.pressingProblem,
                desiredOutcome: input.desiredOutcome,
                uniqueMechanism: input.uniqueMechanism,
              });
            });
          }
        } catch (error) {
          console.error(`Failed to generate ${formulaType} headlines:`, error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to generate ${formulaType} headlines`,
          });
        }
      }

      // Check compliance for all headlines and add compliance data
      const headlinesWithCompliance = await Promise.all(
        allHeadlines.map(async (headline) => {
          const complianceResult = await checkCompliance(headline.headline, {
            userId: ctx.user.id,
            generatorType: 'headlines',
            trackUsage: true,
          });
          
          return {
            ...headline,
            complianceScore: complianceResult.score,
            complianceVersion: complianceResult.version,
            complianceCheckedAt: new Date(),
          };
        })
      );

      // Save all headlines with compliance data
      await createHeadlines(headlinesWithCompliance);
      await incrementHeadlineCount(ctx.user.id);
      await incrementQuotaCount(ctx.user.id, "headlines");

      // Auto-score and auto-select into campaign kit (non-blocking)
      try {
        const db2 = await getDb();
        if (db2) {
          const savedHeadlines = await db2.select().from(headlines).where(and(eq(headlines.headlineSetId, headlineSetId), eq(headlines.userId, ctx.user.id)));
          let bestId = 0; let bestScore = -1;
          for (const h of savedHeadlines) {
            const s = await scoreItem({ content: h.headline, nodeType: "headlines", formulaType: h.formulaType });
            await db2.update(headlines).set({ selectionScore: String(s) } as any).where(eq(headlines.id, h.id));
            if (s > bestScore) { bestScore = s; bestId = h.id; }
          }
          if (bestId && input.serviceId) {
            const [relatedIcp] = await db2.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
            if (relatedIcp) await autoSelectBest(ctx.user.id, relatedIcp.id, "selectedHeadlineId", bestId);
          }
        }
      } catch (e) { console.warn("[auto-select] headlines failed:", e); }

      return {
        headlineSetId,
        count: allHeadlines.length,
      };
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; headline generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number().optional(),
      campaignId: z.number().optional(),
      targetMarket: z.string().max(5000),
      pressingProblem: z.string(),
      desiredOutcome: z.string(),
      uniqueMechanism: z.string(),
      powerMode: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "headlines");
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const maxHeadlines = user.subscriptionTier === "agency" ? 20 : 6;
        if (user.headlineGeneratedCount >= maxHeadlines) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${maxHeadlines} headline sets. Upgrade to generate more.` });
        }
      }

      // Pre-fetch service/ICP/SOT data before firing setImmediate
      let autoPopData: any = {};
      let icpContext = '';
      let sotContext = '';
      if (input.serviceId) {
        const { getDb } = await import("../db");
        const { services, idealCustomerProfiles, sourceOfTruth, campaigns } = await import("../../drizzle/schema");
        const { eq, and: andOp } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const serviceData = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
          if (serviceData.length > 0) {
            const service = serviceData[0];
            autoPopData = { avatarName: service.avatarName, avatarTitle: service.avatarTitle, mechanismDescriptor: service.mechanismDescriptor, resolvedPressingProblem: input.pressingProblem?.trim() || service.painPoints || "", resolvedDesiredOutcome: input.desiredOutcome?.trim() || service.mainBenefit || "", resolvedUniqueMechanism: input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "" };
          }
          let campaignRecord: any;
          if (input.campaignId) {
            [campaignRecord] = await db.select().from(campaigns).where(andOp(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
          }
          let icp: any;
          if (campaignRecord?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1); }
          if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId!)).limit(1); }
          if (icp) { icpContext = ['IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:', icp.pains ? `Their daily pains: ${icp.pains}` : '', icp.fears ? `Their deep fears: ${icp.fears}` : '', icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''].filter(Boolean).join('\n').trim(); }
          const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, user.id)).limit(1);
          const sotLines = sot ? [sot.coreOffer ? `Core offer: ${sot.coreOffer}` : '', sot.targetAudience ? `Target audience: ${sot.targetAudience}` : '', sot.mainPainPoint ? `Main pain point: ${sot.mainPainPoint}` : '', sot.mainBenefits ? `Main benefits: ${sot.mainBenefits}` : '', sot.uniqueValue ? `Unique value: ${sot.uniqueValue}` : '', sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';
        }
      }

      const { getDb: getDbBg } = await import("../db");
      const { eq: eqBg } = await import("drizzle-orm");
      const dbForJob = await getDbBg();
      if (!dbForJob) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedAutoPopData = { ...autoPopData };
      const capturedIcpContext = icpContext;
      const capturedSotContext = sotContext;

      const jobId = randomUUID();
      await dbForJob.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");
          const countMultiplier = capturedInput.powerMode ? 3 : 1;
          const headlineSetId = nanoid();
          const allHeadlines: Array<typeof headlines.$inferInsert> = [];

          for (const [formulaType, promptTemplate] of Object.entries(FORMULA_PROMPTS)) {
            const modifiedTemplate = (promptTemplate as string).replace(/Generate 5/g, `Generate ${5 * countMultiplier}`);
            const resolvedPressingProblem = capturedAutoPopData.resolvedPressingProblem ?? capturedInput.pressingProblem;
            const resolvedDesiredOutcome = capturedAutoPopData.resolvedDesiredOutcome ?? capturedInput.desiredOutcome;
            const resolvedUniqueMechanism = capturedAutoPopData.resolvedUniqueMechanism ?? capturedInput.uniqueMechanism;
            const prompt = modifiedTemplate
              .replace(/{targetMarket}/g, capturedInput.targetMarket)
              .replace(/{pressingProblem}/g, resolvedPressingProblem)
              .replace(/{desiredOutcome}/g, resolvedDesiredOutcome)
              .replace(/{uniqueMechanism}/g, resolvedUniqueMechanism);
            const promptWithIcp = capturedIcpContext ? prompt.replace(/\n\nGenerate /, `\n\n${capturedIcpContext}\n\nGenerate `) : prompt;
            const promptWithSot = capturedSotContext ? `${capturedSotContext}\n\n${promptWithIcp}` : promptWithIcp;

            const response = await invokeLLM({ messages: [{ role: "system", content: "You are an expert direct response copywriter. Return ONLY valid JSON, no markdown, no explanations." }, { role: "user", content: promptWithSot }] });
            const content = response.choices[0].message.content;
            if (typeof content !== "string") throw new Error("Invalid LLM response");
            const parsed = JSON.parse(stripMarkdownJson(content));

            if (formulaType === "story" || formulaType === "question" || formulaType === "urgency") {
              parsed.forEach((headline: string) => allHeadlines.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, headlineSetId, formulaType: formulaType as any, headline, subheadline: null, eyebrow: null, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism }));
            } else if (formulaType === "eyebrow") {
              parsed.forEach((item: { eyebrow: string; main: string; sub: string }) => allHeadlines.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, headlineSetId, formulaType: "eyebrow", headline: item.main, subheadline: item.sub, eyebrow: item.eyebrow, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism }));
            } else if (formulaType === "authority") {
              parsed.forEach((item: { main: string; sub: string }) => allHeadlines.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, headlineSetId, formulaType: "authority", headline: item.main, subheadline: item.sub, eyebrow: null, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism }));
            }
          }

          const headlinesWithCompliance = await Promise.all(allHeadlines.map(async (headline) => {
            const complianceResult = await checkCompliance(headline.headline, { userId: capturedUserId, generatorType: 'headlines', trackUsage: true });
            return { ...headline, complianceScore: complianceResult.score, complianceVersion: complianceResult.version, complianceCheckedAt: new Date() };
          }));

          await createHeadlines(headlinesWithCompliance);
          await incrementHeadlineCount(capturedUserId);
          await incrementQuotaCount(capturedUserId, "headlines");

          // Auto-score and auto-select into campaign kit (non-blocking)
          try {
            const savedHeadlines = await bgDb.select().from(headlines).where(and(eqBg(headlines.headlineSetId, headlineSetId), eqBg(headlines.userId, capturedUserId)));
            let bestId = 0; let bestScore = -1;
            for (const h of savedHeadlines) {
              const s = await scoreItem({ content: h.headline, nodeType: "headlines", formulaType: h.formulaType });
              await bgDb.update(headlines).set({ selectionScore: String(s) } as any).where(eqBg(headlines.id, h.id));
              if (s > bestScore) { bestScore = s; bestId = h.id; }
            }
            if (bestId && capturedInput.serviceId) {
              const [relatedIcp] = await bgDb.select().from(idealCustomerProfiles).where(eqBg(idealCustomerProfiles.serviceId, capturedInput.serviceId)).limit(1);
              if (relatedIcp) await autoSelectBest(capturedUserId, relatedIcp.id, "selectedHeadlineId", bestId);
            }
          } catch (e) { console.warn("[auto-select] headlines async failed:", e); }

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ headlineSetId, count: allHeadlines.length }) })
            .where(eqBg(jobs.id, jobId));
          console.log(`[headlines.generateAsync] Job ${jobId} completed, headlineSetId: ${headlineSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[headlines.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDbBg();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eqBg(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Rate a headline
  rate: protectedProcedure
    .input(
      z.object({
        headlineId: z.number(),
        rating: z.number().min(-1).max(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHeadlineRating(input.headlineId, ctx.user.id, input.rating);
      return { success: true };
    }),

  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number(), promptOverride: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "headlines");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(headlines)
        .where(and(eq(headlines.id, input.id), eq(headlines.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Headline not found" });
      }

      const subheadlinePart = existing.subheadline ? ` Current subheadline: ${existing.subheadline}.` : "";
      const overrideInstruction = input.promptOverride?.trim()
        ? ` Additional instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this ad headline. Current headline: ${existing.headline}.${subheadlinePart}${overrideInstruction} Return a JSON object with keys: headline (string), subheadline (string or null). No explanation, no markdown.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert ad headline copywriter. Respond with only valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const parsed = JSON.parse(stripMarkdownJson(content));
      if (!parsed.headline) throw new Error("AI response missing headline field");

      await db
        .update(headlines)
        .set({ headline: parsed.headline, subheadline: parsed.subheadline ?? existing.subheadline, updatedAt: new Date() })
        .where(eq(headlines.id, input.id));

      const [updated] = await db
        .select()
        .from(headlines)
        .where(eq(headlines.id, input.id))
        .limit(1);

      return updated;
    }),

  // Delete headline set
  delete: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHeadlineSet(input.headlineSetId, ctx.user.id);
      return { success: true };
    }),

  // Get the most recent headline set for a given serviceId (V2 results panel revisit)
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { headlines: headlinesTable } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const [latest] = await db
        .select({ headlineSetId: headlinesTable.headlineSetId })
        .from(headlinesTable)
        .where(and(eq(headlinesTable.userId, ctx.user.id), eq(headlinesTable.serviceId, input.serviceId)))
        .orderBy(desc(headlinesTable.createdAt))
        .limit(1);
      if (!latest) return null;
      const rows = await getHeadlinesBySetId(latest.headlineSetId, ctx.user.id);
      if (rows.length === 0) return null;
      const grouped = {
        story:     rows.filter(h => h.formulaType === "story"),
        eyebrow:   rows.filter(h => h.formulaType === "eyebrow"),
        question:  rows.filter(h => h.formulaType === "question"),
        authority: rows.filter(h => h.formulaType === "authority"),
        urgency:   rows.filter(h => h.formulaType === "urgency"),
      };
      return {
        headlineSetId: latest.headlineSetId,
        headlines: grouped,
        metadata: {
          serviceId: rows[0].serviceId,
          targetMarket: rows[0].targetMarket,
          pressingProblem: rows[0].pressingProblem,
          desiredOutcome: rows[0].desiredOutcome,
          uniqueMechanism: rows[0].uniqueMechanism,
          createdAt: rows[0].createdAt,
        },
      };
    }),
});
