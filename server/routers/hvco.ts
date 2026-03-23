import { z } from "zod";
import { randomUUID } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { 
  createHvcoTitles, 
  getHvcoSetsByUser, 
  getHvcoTitlesBySetId,
  updateHvcoTitleRating,
  toggleHvcoTitleFavorite,
  deleteHvcoSet,
  incrementHvcoCount
} from "../db";
import { getDb } from "../db";
import { services, idealCustomerProfiles, sourceOfTruth, campaigns, jobs, hvcoTitles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { complianceFilter } from "../lib/complianceFilter";
import { checkCompliance } from "../lib/complianceChecker";
import { scoreItem } from "../lib/selectionScorer";
import { autoSelectBest } from "./campaignKits";

/**
 * Strip markdown code blocks from LLM JSON responses
 */
function stripMarkdownJson(content: string): string {
  // Remove ```json and ``` wrappers if present
  return content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
}

// Apply compliance filter + check to a title string
async function filterHvcoTitle(title: string): Promise<string> {
  const result = complianceFilter(title);
  const cleaned = result.wasModified ? result.cleanedText : title;
  const score = await checkCompliance(cleaned);
  if (score.score < 100) {
    console.log(`[hvco] Compliance score ${score.score}/100 for "${cleaned.substring(0, 50)}": ${score.issues.map(i => i.phrase).join(", ")}`);
  }
  return cleaned;
}

/**
 * HVCO Titles Router - Industry Standard
 * 
 * Generates 4 tabs of title variations:
 * - Long Titles (~20 alliterative 3-5 word titles)
 * - Short Titles (~20 concise titles)
 * - Power Mode Titles (~30 extra variations)
 * - Subheadlines (~20 supporting subheadlines)
 * 
 * All titles follow alliteration pattern: [Action/Benefit] [Crypto/Money Word] [Blueprint/Formula/Method]
 */

export const hvcoRouter = router({
  /**
   * Generate HVCO Titles
   * Creates 4 tabs with ~20-30 title variations each
   */
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        hvcoTopic: z.string().max(5000),
        powerMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "hvco");
      const countMultiplier = input.powerMode ? 3 : 1; // Power Mode generates 3x more

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(user.id);
      
      // Superusers have unlimited quota
      if (user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(user.subscriptionTier, "hvco");
        if (user.hvcoGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} HVCO title sets. Upgrade to generate more.`,
          });
        }
      }
      
      // Get service details for context
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId))
        .limit(1);
      
      if (!service) {
        throw new Error("Service not found");
      }

      // Campaign fetch — Item 1.1b (icpId support)
      let campaignRecord;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, ctx.user.id))).limit(1);
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

      const icpContext = icp ? [
        'IDEAL CUSTOMER PROFILE — use this to make every title specific and targeted:',
        icp.pains ? `Their daily pains: ${icp.pains}` : '',
        icp.goals ? `Their goals and aspirations: ${icp.goals}` : '',
        icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : '',
      ].filter(Boolean).join('\n').trim() : '';

      // SOT query — Item 1.4
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

      const sotContext = sotLines.length > 0
        ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
        : '';

      // Item 1.3 — Rule 4: server-side fallbacks so empty form fields fall back to service record
      const resolvedTargetMarket = input.targetMarket?.trim() || service.targetCustomer || "";
      const resolvedHvcoTopic = input.hvcoTopic?.trim() || service.hvcoTopic || "";

      const hvcoSetId = nanoid();
      const allTitles: any[] = [];

      // Generate Long Titles (20 variations)
      const longTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO (High-Value Content Offer) titles.

Product: ${service.name}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
Create 20 LONG, benefit-first titles (3-5 words each) following this pattern:
[Specific Number/Timeframe] [Action/Benefit] [to/for] [Concrete Outcome]

BENEFIT-FIRST Examples (CORRECT):
- "7 Secrets to Close 50% More Deals in 30 Days"
- "5 Steps to Generate $10K Monthly Passive Income"
- "3 Strategies to Double Your Coaching Revenue"
- "10 Proven Methods to Build a 6-Figure Funnel"
- "4 Simple Tweaks to 3x Your Email Open Rates"

ALLITERATIVE Examples (WRONG - too vague):
- "Beating Bosses Blockchain Blueprint" (What's the actual benefit?)
- "Passive Profits Playbook Unveiled" (How much profit? When?)
- "Wealth Wave Walkaway Wizard" (Unclear outcome)

Requirements:
- PRIORITIZE clarity and specific benefits over alliteration
- Include numbers, timeframes, or percentages when possible
- Make the outcome concrete and measurable
- Alliteration is optional - only use if it doesn't sacrifice clarity

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

      const longTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: longTitlesPrompt }
        ],
      });

      const longTitlesContent = typeof longTitlesResponse.choices[0].message.content === 'string' 
        ? longTitlesResponse.choices[0].message.content 
        : JSON.stringify(longTitlesResponse.choices[0].message.content);
      const longTitlesRaw = JSON.parse(stripMarkdownJson(longTitlesContent));
      const longTitles = await Promise.all(longTitlesRaw.map((t: string) => filterHvcoTitle(t)));
      longTitles.forEach((title: string) => {
        allTitles.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          hvcoSetId,
          tabType: "long" as const,
          title,
          targetMarket: input.targetMarket,
          hvcoTopic: input.hvcoTopic,
        });
      });

      // Generate Short Titles (20 variations)
      const shortTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.

Product: ${service.name}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
Create 20 SHORT, benefit-focused titles (2-4 words each) that are:
- Concise and memorable
- Include specific outcomes when possible
- Action-oriented

BENEFIT-FIRST Examples (CORRECT):
- "10X Sales Blueprint"
- "30-Day Revenue Boost"
- "$100K Funnel Formula"
- "5-Step Conversion System"
- "Double Your Clients"

VAGUE Examples (WRONG):
- "Crypto Freedom Formula" (Freedom from what? How much?)
- "Wealth Unlocked" (What kind of wealth? When?)
- "Bitcoin Breakthrough" (What's the breakthrough?)

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

      const shortTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: shortTitlesPrompt }
        ],
      });

      const shortTitlesContent = typeof shortTitlesResponse.choices[0].message.content === 'string' 
        ? shortTitlesResponse.choices[0].message.content 
        : JSON.stringify(shortTitlesResponse.choices[0].message.content);
      const shortTitlesRaw = JSON.parse(stripMarkdownJson(shortTitlesContent));
      const shortTitles = await Promise.all(shortTitlesRaw.map((t: string) => filterHvcoTitle(t)));
      shortTitles.forEach((title: string) => {
        allTitles.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          hvcoSetId,
          tabType: "short" as const,
          title,
          targetMarket: input.targetMarket,
          hvcoTopic: input.hvcoTopic,
        });
      });

      // Generate Power Mode Titles (30 extra variations)
      const powerModeTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.

Product: ${service.name}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
Create 30 BEAST MODE titles - a mix of long and short, all highly creative and attention-grabbing:
- PRIORITIZE specific benefits and outcomes
- Use numbers, timeframes, and percentages
- Include curiosity gaps
- Use power words
- Alliteration is optional - clarity comes first

Examples:
- "The 9-Step Crypto Wealth Building Blueprint"
- "HOW ORDINARY PEOPLE ARE QUIETLY BUILDING PASSIVE INCOME"
- "Escape The 9-5 Grind Forever"
- "Secret Millionaire Method Revealed"
- "10X Your Income In 6 Months"

Return ONLY a JSON array of 30 title strings, nothing else.`;

      const powerModeTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: powerModeTitlesPrompt }
        ],
      });

      const powerModeTitlesContent = typeof powerModeTitlesResponse.choices[0].message.content === 'string' 
        ? powerModeTitlesResponse.choices[0].message.content 
        : JSON.stringify(powerModeTitlesResponse.choices[0].message.content);
      const powerModeTitlesRaw = JSON.parse(stripMarkdownJson(powerModeTitlesContent));
      const powerModeTitles = await Promise.all(powerModeTitlesRaw.map((t: string) => filterHvcoTitle(t)));
      powerModeTitles.forEach((title: string) => {
        allTitles.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          hvcoSetId,
          tabType: "beast_mode" as const,
          title,
          targetMarket: input.targetMarket,
          hvcoTopic: input.hvcoTopic,
        });
      });

      // Generate Subheadlines (20 variations)
      const subheadlinesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling subheadlines for HVCOs.

Product: ${service.name}
Target Market: ${resolvedTargetMarket}
HVCO Topic: ${resolvedHvcoTopic}
${icpContext ? `\n${icpContext}\n` : ''}
Create 20 SUBHEADLINES that:
- Support and expand on the main title
- Add specificity and credibility
- Create curiosity
- Promise a clear benefit

Examples:
- "Discover the proven 6-month system that's helped 1,000+ beginners build passive income"
- "Learn the exact strategy top traders use to generate $10K/month"
- "No experience needed - just follow our step-by-step blueprint"
- "From zero to financial freedom in less than a year"

Return ONLY a JSON array of 20 subheadline strings, nothing else.`;

      const subheadlinesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: subheadlinesPrompt }
        ],
      });

      const subheadlinesContent = typeof subheadlinesResponse.choices[0].message.content === 'string' 
        ? subheadlinesResponse.choices[0].message.content 
        : JSON.stringify(subheadlinesResponse.choices[0].message.content);
      const subheadlinesRaw = JSON.parse(stripMarkdownJson(subheadlinesContent));
      const subheadlines = await Promise.all(subheadlinesRaw.map((t: string) => filterHvcoTitle(t)));
      subheadlines.forEach((title: string) => {
        allTitles.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          hvcoSetId,
          tabType: "subheadlines" as const,
          title,
          targetMarket: input.targetMarket,
          hvcoTopic: input.hvcoTopic,
        });
      });

      // Save all titles to database
      await createHvcoTitles(allTitles);
      await incrementHvcoCount(user.id);
      await incrementQuotaCount(ctx.user.id, "hvco");

      // Auto-score and auto-select into campaign kit (non-blocking)
      try {
        const savedTitles = await db.select().from(hvcoTitles).where(and(eq(hvcoTitles.hvcoSetId, hvcoSetId), eq(hvcoTitles.userId, user.id)));
        let bestId = 0; let bestScore = -1;
        for (const t of savedTitles) {
          const s = await scoreItem({ content: t.title, nodeType: "hvco" });
          await db.update(hvcoTitles).set({ selectionScore: String(s) } as any).where(eq(hvcoTitles.id, t.id));
          if (s > bestScore) { bestScore = s; bestId = t.id; }
        }
        if (bestId) {
          const [relatedIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
          if (relatedIcp) await autoSelectBest(user.id, relatedIcp.id, "selectedHvcoId", bestId);
        }
      } catch (e) { console.warn("[auto-select] hvco failed:", e); }

      return { hvcoSetId };
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; HVCO generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      campaignId: z.number().optional(),
      targetMarket: z.string().max(5000),
      hvcoTopic: z.string().max(5000),
      powerMode: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "hvco");
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "hvco");
        if (user.hvcoGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} HVCO title sets. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      if (!service) throw new Error("Service not found");

      let campaignRecord: any;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
      }
      let icp: any;
      if (campaignRecord?.icpId) {
        [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
      }
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }
      const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, user.id)).limit(1);

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };
      const capturedIcp = icp ? { ...icp } : undefined;
      const capturedSot = sot ? { ...sot } : undefined;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          const countMultiplier = capturedInput.powerMode ? 3 : 1;

          const icpContext = capturedIcp ? [
            'IDEAL CUSTOMER PROFILE — use this to make every title specific and targeted:',
            capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : '',
            capturedIcp.goals ? `Their goals and aspirations: ${capturedIcp.goals}` : '',
            capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : '',
          ].filter(Boolean).join('\n').trim() : '';

          const sotLines = capturedSot ? [
            capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '',
            capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '',
            capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '',
            capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '',
            capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '',
            capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : '',
          ].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';

          const resolvedTargetMarket = capturedInput.targetMarket?.trim() || capturedService.targetCustomer || "";
          const resolvedHvcoTopic = capturedInput.hvcoTopic?.trim() || capturedService.hvcoTopic || "";
          const hvcoSetId = nanoid();
          const allTitles: any[] = [];

          const longTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO (High-Value Content Offer) titles.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 20 LONG, benefit-first titles (3-5 words each) following this pattern:\n[Specific Number/Timeframe] [Action/Benefit] [to/for] [Concrete Outcome]\n\nReturn ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;
          const longR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: longTitlesPrompt }] });
          const longContent = typeof longR.choices[0].message.content === 'string' ? longR.choices[0].message.content : JSON.stringify(longR.choices[0].message.content);
          const longTitlesFiltered = await Promise.all(JSON.parse(stripMarkdownJson(longContent)).map((t: string) => filterHvcoTitle(t)));
          longTitlesFiltered.forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "long" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const shortTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 20 SHORT, benefit-focused titles (2-4 words each).\n\nReturn ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;
          const shortR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: shortTitlesPrompt }] });
          const shortContent = typeof shortR.choices[0].message.content === 'string' ? shortR.choices[0].message.content : JSON.stringify(shortR.choices[0].message.content);
          const shortTitlesFiltered = await Promise.all(JSON.parse(stripMarkdownJson(shortContent)).map((t: string) => filterHvcoTitle(t)));
          shortTitlesFiltered.forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "short" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const powerPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 30 BEAST MODE titles - a mix of long and short, all highly creative and attention-grabbing.\n\nReturn ONLY a JSON array of 30 title strings, nothing else.`;
          const powerR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: powerPrompt }] });
          const powerContent = typeof powerR.choices[0].message.content === 'string' ? powerR.choices[0].message.content : JSON.stringify(powerR.choices[0].message.content);
          const powerTitlesFiltered = await Promise.all(JSON.parse(stripMarkdownJson(powerContent)).map((t: string) => filterHvcoTitle(t)));
          powerTitlesFiltered.forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "beast_mode" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const subPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling subheadlines for HVCOs.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 20 SUBHEADLINES that support and expand on the main title.\n\nReturn ONLY a JSON array of 20 subheadline strings, nothing else.`;
          const subR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: subPrompt }] });
          const subContent = typeof subR.choices[0].message.content === 'string' ? subR.choices[0].message.content : JSON.stringify(subR.choices[0].message.content);
          const subTitlesFiltered = await Promise.all(JSON.parse(stripMarkdownJson(subContent)).map((t: string) => filterHvcoTitle(t)));
          subTitlesFiltered.forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "subheadlines" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          await createHvcoTitles(allTitles);
          await incrementHvcoCount(capturedUserId);
          await incrementQuotaCount(capturedUserId, "hvco");

          // Auto-score and auto-select into campaign kit (non-blocking)
          try {
            const savedTitles = await bgDb.select().from(hvcoTitles).where(and(eq(hvcoTitles.hvcoSetId, hvcoSetId), eq(hvcoTitles.userId, capturedUserId)));
            let bestId = 0; let bestScore = -1;
            for (const t of savedTitles) {
              const s = await scoreItem({ content: t.title, nodeType: "hvco" });
              await bgDb.update(hvcoTitles).set({ selectionScore: String(s) } as any).where(eq(hvcoTitles.id, t.id));
              if (s > bestScore) { bestScore = s; bestId = t.id; }
            }
            if (bestId) {
              const [relatedIcp] = await bgDb.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, capturedInput.serviceId)).limit(1);
              if (relatedIcp) await autoSelectBest(capturedUserId, relatedIcp.id, "selectedHvcoId", bestId);
            }
          } catch (e) { console.warn("[auto-select] hvco async failed:", e); }

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ hvcoSetId }) })
            .where(eq(jobs.id, jobId));
          console.log(`[hvco.generateAsync] Job ${jobId} completed, hvcoSetId: ${hvcoSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[hvco.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * List all HVCO sets for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const sets = await getHvcoSetsByUser(ctx.user.id);
    return sets;
  }),

  /**
   * Get all titles from a specific HVCO set
   */
  getBySetId: protectedProcedure
    .input(z.object({ hvcoSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const titles = await getHvcoTitlesBySetId(input.hvcoSetId, ctx.user.id);
      return titles;
    }),

  /**
   * Rate a title (thumbs up/down)
   */
  rate: protectedProcedure
    .input(
      z.object({
        titleId: z.number(),
        rating: z.number().min(-1).max(1), // -1 = down, 0 = neutral, 1 = up
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHvcoTitleRating(input.titleId, ctx.user.id, input.rating);
      return { success: true };
    }),

  /**
   * Toggle favorite status
   */
  toggleFavorite: protectedProcedure
    .input(
      z.object({
        titleId: z.number(),
        isFavorite: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await toggleHvcoTitleFavorite(input.titleId, ctx.user.id, input.isFavorite);
      return { success: true };
    }),

  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number(), promptOverride: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "hvco");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(hvcoTitles)
        .where(and(eq(hvcoTitles.id, input.id), eq(hvcoTitles.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HVCO title not found" });
      }

      const overrideInstruction = input.promptOverride?.trim()
        ? ` Additional instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this high-value content offer title. Current title: ${existing.title}.${overrideInstruction} Return a JSON object with exactly one key: title (string). No explanation, no markdown.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert content title copywriter. Respond with only valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const parsed = JSON.parse(stripMarkdownJson(content));
      if (!parsed.title) throw new Error("AI response missing title field");

      // Apply compliance filter to regenerated title
      const filteredTitle = await filterHvcoTitle(parsed.title);

      await db
        .update(hvcoTitles)
        .set({ title: filteredTitle, updatedAt: new Date() })
        .where(eq(hvcoTitles.id, input.id));

      const [updated] = await db
        .select()
        .from(hvcoTitles)
        .where(eq(hvcoTitles.id, input.id))
        .limit(1);

      return updated;
    }),

  /**
   * Delete entire HVCO set
   */
  delete: protectedProcedure
    .input(z.object({ hvcoSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHvcoSet(input.hvcoSetId, ctx.user.id);
      return { success: true };
    }),
});
