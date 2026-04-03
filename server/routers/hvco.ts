import { z } from "zod";
import { randomUUID } from "crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { BANNED_COPYWRITING_WORDS } from "../_core/copywritingRules";
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
import { services, idealCustomerProfiles, sourceOfTruth, campaigns, jobs } from "../../drizzle/schema";
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
        targetMarket: z.string().max(5000),
        hvcoTopic: z.string().max(5000),
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
MANDATORY TITLE RULE — every title must contain at least ONE of these:
1. A specific number (5 steps, 7 mistakes, 3 ways — not "multiple" or "several")
2. A specific timeframe (in 30 days, this week, before Friday — not "quickly" or "fast")
3. A named enemy or obstacle (cold outreach, algorithm changes, discount pricing — the specific thing blocking them)
4. An insider term from the niche (a word or phrase that only someone in this exact niche would recognise and use)

WHY-THIS-SPECIFICALLY TEST: Before including any title, ask: why would this specific audience download THIS over any other lead magnet? If the title doesn't answer that question, it fails.

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED TITLE PATTERNS — never generate:
- "The Ultimate Guide to [X]" — too generic, no specificity
- "Everything You Need to Know About [X]" — sounds like homework, not a gift
- "How to Improve Your [X]" — no specific outcome, no urgency
- "The [X] Blueprint/Playbook/Handbook" — unless followed by a specific outcome
- Any title that works equally well for a different coaching niche

GOOD examples (pass the test):
- "7 Secrets to Close 50% More Deals in 30 Days" — specific number + specific timeframe + specific outcome
- "The 4 Questions That Book 8 Discovery Calls a Week" — specific number + specific outcome + insider mechanism
- "Why Posting Daily Kills Your Reach (And What to Do Instead)" — named enemy + contrarian insight

Create 20 LONG, benefit-first titles following this pattern:
[Specific Number/Timeframe] [Action/Benefit] [to/for] [Concrete Outcome]

Requirements:
- Every title must pass the WHY-THIS-SPECIFICALLY test
- Include at least one mandatory element per title
- Make the outcome concrete and measurable — a number, timeframe, or named situation
- Avoid alliteration if it sacrifices clarity

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

      const longTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in HVCO titles for coaches and consultants. You write titles that are niche-specific — every title contains at least one of: a specific number, a specific timeframe, a named enemy or obstacle, or an insider term from the niche. You never write generic titles that could apply to any coaching offer. Return ONLY valid JSON arrays." },
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
MANDATORY TITLE RULE — every short title must contain at least ONE of:
1. A specific number or timeframe (5-step, 30-day, $10k — not vague amounts)
2. A named obstacle or enemy this audience specifically faces (the exact frustration, not a category of frustrations)
3. An insider word from this niche — a term only someone in this niche would use

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED TITLE PATTERNS — never generate these:
- "[X] Formula/Blueprint/Playbook" without a specific outcome attached
- "[X] Unlocked/Mastered/Hacked" — too vague
- "The [X] Breakthrough" — what is the breakthrough, specifically?
- Generic success language: "freedom", "wealth", "success", "results" — without a specific definition

GOOD examples (short titles that pass):
- "30-Day Client Sprint" — timeframe + niche-specific action
- "5-Figure Funnel Fix" — specific outcome + named problem
- "Zero-Follower Launch System" — named enemy + specific mechanism
- "The Discovery Call Closer" — niche-specific insider term

Create 20 SHORT titles (3-7 words) that are concise, niche-specific, and contain at least one mandatory element.

Return ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;

      const shortTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in HVCO titles for coaches and consultants. You write titles that are niche-specific — every title contains at least one of: a specific number, a specific timeframe, a named enemy or obstacle, or an insider term from the niche. You never write generic titles that could apply to any coaching offer. Return ONLY valid JSON arrays." },
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
MANDATORY RULE — every title must contain at least ONE of:
1. A specific number or timeframe
2. A named enemy, obstacle, or mistake this exact audience faces
3. An insider term from this niche that only someone in it would recognise
4. A counterintuitive or contrarian insight (why the obvious approach doesn't work)

WHY-THIS-SPECIFICALLY TEST: Would someone in this exact niche stop scrolling for THIS title, or would any coach's lead magnet do? If they'd stop for any lead magnet, the title fails.

BANNED COPYWRITING WORDS — never use in any title: ${BANNED_COPYWRITING_WORDS.join(', ')}

BANNED — never generate:
- "The Ultimate Guide to [X]" — too generic
- "Everything You Need to Know About [X]" — sounds like homework
- "How to Improve Your [X]" — no specificity or urgency
- "Escape The 9-5 Grind Forever" — far too generic and clichéd
- "Secret Millionaire Method Revealed" — forbidden sensationalist language

Create 30 POWER MODE titles — a mix of long (7-15 words) and short (3-7 words), all maximally specific to this niche, all passing the WHY-THIS-SPECIFICALLY test.

Return ONLY a JSON array of 30 title strings, nothing else.`;

      const powerModeTitlesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in HVCO titles for coaches and consultants. You write titles that are niche-specific — every title contains at least one of: a specific number, a specific timeframe, a named enemy or obstacle, or an insider term from the niche. You never write generic titles that could apply to any coaching offer. Return ONLY valid JSON arrays." },
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
Create 20 SUBHEADLINES. Each subheadline must do ONE of the following:
1. Name a specific obstacle or enemy this audience faces and promise to remove it
2. Give a specific number, timeframe, or result that makes the promise concrete
3. Explain WHY this lead magnet is different from the thing they've already tried
4. Use an insider term or niche-specific language that signals "this was written for you"

BANNED patterns:
- "No experience needed" — too generic
- "From zero to [vague word like freedom or success]" — no specific outcome
- "Discover the proven system" — vague claim without niche anchor
- Generic superlatives: "the best", "the ultimate", "the most powerful"

Each subheadline must reference a specific situation, obstacle, or desired outcome that is recognisable to someone in this exact niche — not someone in coaching generally.

Return ONLY a JSON array of 20 subheadline strings, nothing else.`;

      const subheadlinesResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in HVCO titles for coaches and consultants. You write titles that are niche-specific — every title contains at least one of: a specific number, a specific timeframe, a named enemy or obstacle, or an insider term from the niche. You never write generic titles that could apply to any coaching offer. Return ONLY valid JSON arrays." },
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
          JSON.parse(stripMarkdownJson(longContent)).forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "long" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const shortTitlesPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 20 SHORT, benefit-focused titles (2-4 words each).\n\nReturn ONLY a JSON array of ${20 * countMultiplier} title strings, nothing else.`;
          const shortR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: shortTitlesPrompt }] });
          const shortContent = typeof shortR.choices[0].message.content === 'string' ? shortR.choices[0].message.content : JSON.stringify(shortR.choices[0].message.content);
          JSON.parse(stripMarkdownJson(shortContent)).forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "short" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const powerPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling HVCO titles.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 30 BEAST MODE titles - a mix of long and short, all highly creative and attention-grabbing.\n\nReturn ONLY a JSON array of 30 title strings, nothing else.`;
          const powerR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: powerPrompt }] });
          const powerContent = typeof powerR.choices[0].message.content === 'string' ? powerR.choices[0].message.content : JSON.stringify(powerR.choices[0].message.content);
          JSON.parse(stripMarkdownJson(powerContent)).forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "beast_mode" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          const subPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert copywriter creating compelling subheadlines for HVCOs.\n\nProduct: ${capturedService.name}\nTarget Market: ${resolvedTargetMarket}\nHVCO Topic: ${resolvedHvcoTopic}\n${icpContext ? `\n${icpContext}\n` : ''}\nCreate 20 SUBHEADLINES that support and expand on the main title.\n\nReturn ONLY a JSON array of 20 subheadline strings, nothing else.`;
          const subR = await invokeLLM({ messages: [{ role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." }, { role: "user", content: subPrompt }] });
          const subContent = typeof subR.choices[0].message.content === 'string' ? subR.choices[0].message.content : JSON.stringify(subR.choices[0].message.content);
          JSON.parse(stripMarkdownJson(subContent)).forEach((title: string) => allTitles.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, hvcoSetId, tabType: "subheadlines" as const, title, targetMarket: capturedInput.targetMarket, hvcoTopic: capturedInput.hvcoTopic }));

          await createHvcoTitles(allTitles);
          await incrementHvcoCount(capturedUserId);

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
