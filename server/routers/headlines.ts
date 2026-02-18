import { z } from "zod";
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
} from "../db";
import { headlines } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

// Kong parity: 5 formula types with exact prompt templates
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

  // Generate new headline set (25 headlines: 5 per formula type, or 75 with Beast Mode)
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(255),
        pressingProblem: z.string(),
        desiredOutcome: z.string(),
        uniqueMechanism: z.string(),
        beastMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Check quota (Pro plan: 6 per month)
      const maxHeadlines = ctx.user.subscriptionTier === "agency" ? 20 : 6;
      if (ctx.user.headlineGeneratedCount >= maxHeadlines) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached your monthly limit of ${maxHeadlines} headline sets. Upgrade to generate more.`,
        });
      }

      const headlineSetId = nanoid();
      const allHeadlines: Array<typeof headlines.$inferInsert> = [];
      const countMultiplier = input.beastMode ? 3 : 1; // Beast Mode generates 3x more

      // Generate headlines for each formula type
      for (const [formulaType, promptTemplate] of Object.entries(FORMULA_PROMPTS)) {
        // Modify prompt to generate 3x more if Beast Mode is enabled
        const modifiedTemplate = promptTemplate.replace(/Generate 5/g, `Generate ${5 * countMultiplier}`);
        const prompt = modifiedTemplate
          .replace(/{targetMarket}/g, input.targetMarket)
          .replace(/{pressingProblem}/g, input.pressingProblem)
          .replace(/{desiredOutcome}/g, input.desiredOutcome)
          .replace(/{uniqueMechanism}/g, input.uniqueMechanism);

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are an expert direct response copywriter. Return ONLY valid JSON, no markdown, no explanations.",
              },
              { role: "user", content: prompt },
            ],
          });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") {
            throw new Error("Invalid LLM response");
          }
          const parsed = JSON.parse(content);

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

      // Save all headlines
      await createHeadlines(allHeadlines);
      await incrementHeadlineCount(ctx.user.id);

      return {
        headlineSetId,
        count: allHeadlines.length,
      };
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
});
