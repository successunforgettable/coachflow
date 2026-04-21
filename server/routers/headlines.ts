import { z } from "zod";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { BANNED_HEADLINE_PATTERNS, META_COMPLIANCE_NOTES, scoreAdContent } from "../_core/copywritingRules";
import {
  createHeadlines,
  getHeadlinesByUserId,
  getHeadlinesBySetId,
  updateHeadlineRating,
  deleteHeadlineSet,
  incrementHeadlineCount,
} from "../db";
import { headlines, jobs } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { checkCompliance } from "../lib/complianceChecker";

// Helper to strip markdown code blocks from LLM responses
function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}

/**
 * Pre-compute compliance rewrites for a just-inserted headline set.
 *
 * Feature flag: ENABLE_COMPLIANCE_REWRITES. Off by default — when unset or
 * false this is a no-op so production sees no change until we flip it.
 *
 * Picks up every row in the set whose complianceScore is below the same
 * threshold the picker uses (70), re-derives the issue list (the
 * headlines table only stores the score, not the issues), asks Sonnet
 * for a compliant rewrite via rewriteForCompliance, and inserts rows
 * into complianceRewrites. Runs rewrites in parallel — each call is
 * ~2 s, so total latency is bounded by the slowest single rewrite.
 *
 * Best-effort: per-row failures are caught and logged. We never fail
 * the generate flow because a rewrite attempt threw. Free-tier cap is
 * also caught-and-skip here (trial users who've hit their cap simply
 * see the existing "1 issue" badge with no rewrite suggestion).
 */
async function precomputeComplianceRewrites(
  user: { id: number; subscriptionTier: string | null; role: string | null },
  headlineSetId: string,
  serviceNiche: string | null,
): Promise<void> {
  // Feature flag — ENABLE_COMPLIANCE_REWRITES gates the entire pre-compute path.
  if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") return;

  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;
    const { headlines: h, complianceRewrites } = await import("../../drizzle/schema");
    const { eq, and, lt } = await import("drizzle-orm");
    const { rewriteForCompliance } = await import("../_core/complianceRewrite");
    const { enforceFreeTierRewriteCap } = await import("./complianceRewrites");

    const flagged = await db
      .select()
      .from(h)
      .where(and(
        eq(h.userId, user.id),
        eq(h.headlineSetId, headlineSetId),
        lt(h.complianceScore, 70),
      ));
    if (flagged.length === 0) return;

    // Free-tier cap: scoped per service. All rows in a set share the same
    // serviceId (if any) — if multiple services appear in a single set we
    // skip the whole set rather than partial-apply; documented in honest
    // suggestions.
    const serviceId = flagged.find(r => r.serviceId != null)?.serviceId ?? null;
    if (serviceId != null) {
      try { await enforceFreeTierRewriteCap(db, user, serviceId); }
      catch (err) {
        console.log(`[precomputeComplianceRewrites] free-tier cap hit for user ${user.id}, skipping set ${headlineSetId}`);
        return;
      }
    }

    const rowsToInsert: Array<typeof complianceRewrites.$inferInsert> = [];
    await Promise.all(flagged.map(async (row) => {
      try {
        const c = await checkCompliance(row.headline);
        if (c.issues.length === 0) return;
        const r = await rewriteForCompliance(row.headline, c.issues, "headline", {
          niche: serviceNiche,
          mechanism: row.uniqueMechanism,
          mainBenefit: row.desiredOutcome,
        });
        rowsToInsert.push({
          userId: user.id,
          contentType: "headline",
          sourceTable: "headlines",
          sourceId: row.id,
          originalText: row.headline,
          rewrittenText: r.rewrite,
          violationReasons: c.issues.map(i => i.reason),
          complianceScore: r.score,
        });
      } catch (err) {
        console.warn(
          `[precomputeComplianceRewrites] Skipped headline ${row.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }));

    if (rowsToInsert.length > 0) {
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[precomputeComplianceRewrites] Inserted ${rowsToInsert.length} rewrite(s) for set ${headlineSetId}`);
    }
  } catch (err) {
    // Defensive outer catch — never let a pre-compute failure kill the
    // headline generation that already succeeded.
    console.error(`[precomputeComplianceRewrites] unexpected failure for set ${headlineSetId}:`, err instanceof Error ? err.message : err);
  }
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
- Each headline should be 15-25 words
- Return ONLY a JSON array of 5 headline strings, nothing else

Example output format:
["How a Weekend Vegas Bender Led an Aspiring Crypto Newbie to Discover a Revolutionary 9-Step Blueprint that Generates $10k Monthly!", "How an Embarrassing Margin Call Pushed a Skeptical 30-Something Day-Trader to Unearth a Breakthrough System that Multiplies Crypto Earnings!", ...]`,

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
            // W5 Phase 1 — niche passed to compliance rewrite prompt.
            category: service.category,
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

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert direct response copywriter specialising in Meta ad headlines for coaches, consultants and speakers. You apply a THREE-QUESTION TEST to every headline before including it:
1. Does it name a specific person in a specific situation? (Not "coaches" but "coaches who've been running ads for 3 months with zero leads")
2. Does it promise a specific outcome — not a vague benefit? (Not "more clients" but "8 discovery calls booked in the next 14 days")
3. Could this headline ONLY be written for THIS service? (If it works equally well for any coach, rewrite it)

BANNED OPENERS AND PHRASES — never generate headlines using these patterns:
- ${BANNED_HEADLINE_PATTERNS.map(p => `"${p}..."`).join(', ')}, "Everything you need to..."
- Generic power words used without specific context: skyrocket, explode, dominate, crush it, master

MANDATORY: Every headline must contain at least ONE word that comes directly from the ICP's pain language, desire language, or niche-specific vocabulary — a word that signals to the ideal customer "this was written for me specifically."

Return ONLY valid JSON, no markdown, no explanations.\n\n${META_COMPLIANCE_NOTES}`,
              },
              { role: "user", content: promptWithSot },
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
            selectionScore: String(scoreAdContent('headline', headline.headline ?? '')),
          };
        })
      );

      // Save all headlines with compliance data
      await createHeadlines(headlinesWithCompliance);
      await incrementHeadlineCount(ctx.user.id);

      // W5 Phase 1 — pre-compute compliant rewrites for flagged rows. No-op
      // unless ENABLE_COMPLIANCE_REWRITES=true in the environment. The flag
      // check lives inside precomputeComplianceRewrites so call sites stay
      // one-liners.
      await precomputeComplianceRewrites(
        ctx.user,
        headlineSetId,
        autoPopData.category ?? null,
      );

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
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const maxHeadlines = user.subscriptionTier === "agency" ? 50 : user.subscriptionTier === "pro" ? 20 : 6;
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
            autoPopData = { avatarName: service.avatarName, avatarTitle: service.avatarTitle, mechanismDescriptor: service.mechanismDescriptor, resolvedPressingProblem: input.pressingProblem?.trim() || service.painPoints || "", resolvedDesiredOutcome: input.desiredOutcome?.trim() || service.mainBenefit || "", resolvedUniqueMechanism: input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "", category: service.category };
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
      const capturedUserTier: string | null = user.subscriptionTier ?? null;
      const capturedUserRole: string | null = user.role ?? null;
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

            const response = await invokeLLM({ messages: [{ role: "system", content: `You are an expert direct response copywriter specialising in Meta ad headlines for coaches, consultants and speakers. Every headline must pass the THREE-QUESTION TEST: specific person in specific situation, specific outcome, only writeable for this service. Banned openers: ${BANNED_HEADLINE_PATTERNS.join(', ')}. Return ONLY valid JSON, no markdown, no explanations.\n\n${META_COMPLIANCE_NOTES}` }, { role: "user", content: promptWithSot }] });
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
            return { ...headline, complianceScore: complianceResult.score, complianceVersion: complianceResult.version, complianceCheckedAt: new Date(), selectionScore: String(scoreAdContent('headline', headline.headline ?? '')) };
          }));

          await createHeadlines(headlinesWithCompliance);
          await incrementHeadlineCount(capturedUserId);

          // W5 Phase 1 — pre-compute compliant rewrites for flagged rows.
          // No-op unless ENABLE_COMPLIANCE_REWRITES=true. Run before marking
          // the job complete so the client sees headlines + rewrites atomically.
          await precomputeComplianceRewrites(
            { id: capturedUserId, subscriptionTier: capturedUserTier, role: capturedUserRole },
            headlineSetId,
            capturedAutoPopData.category ?? null,
          );

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

  // Delete headline set
  delete: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHeadlineSet(input.headlineSetId, ctx.user.id);
      return { success: true };
    }),

  /**
   * listForServiceId — flat, compliance-filtered list of the campaign's Node 6
   * headlines, sorted by selectionScore desc. Used by V2AdImageCreator's edit
   * panel so users pick from compliant headlines instead of typing freeform.
   * Ownership is enforced by userId in the WHERE clause.
   * Strict gate: only rows with an explicit compliance score >= 70 (Mostly
   * Compliant or better per getComplianceLabel). NULL scores are pre-scoring
   * legacy and must not be picker-visible — user evidence confirmed zero such
   * rows are currently reachable, so this is defensive for future imports only.
   */
  listForServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { headlines: headlinesTable } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const rows = await db
        .select({
          id:              headlinesTable.id,
          text:            headlinesTable.headline,
          formulaType:     headlinesTable.formulaType,
          selectionScore:  headlinesTable.selectionScore,
          complianceScore: headlinesTable.complianceScore,
        })
        .from(headlinesTable)
        .where(and(
          eq(headlinesTable.userId, ctx.user.id),
          eq(headlinesTable.serviceId, input.serviceId),
        ))
        .orderBy(desc(headlinesTable.selectionScore));
      return rows.filter(r => r.complianceScore !== null && r.complianceScore >= 70);
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
