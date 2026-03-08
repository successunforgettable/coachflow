import { z } from "zod";
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
import { services, idealCustomerProfiles, sourceOfTruth, campaigns } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

/**
 * Strip markdown code blocks from LLM JSON responses
 */
function stripMarkdownJson(content: string): string {
  // Remove ```json and ``` wrappers if present
  return content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
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
        targetMarket: z.string().max(1000),
        hvcoTopic: z.string().max(1000),
        powerMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
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
      const longTitles = JSON.parse(stripMarkdownJson(longTitlesContent));
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
      const shortTitles = JSON.parse(stripMarkdownJson(shortTitlesContent));
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
      const powerModeTitles = JSON.parse(stripMarkdownJson(powerModeTitlesContent));
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
      const subheadlines = JSON.parse(stripMarkdownJson(subheadlinesContent));
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

      return { hvcoSetId };
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
