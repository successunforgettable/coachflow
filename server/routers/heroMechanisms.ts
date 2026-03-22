import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { 
  createHeroMechanisms, 
  getHeroMechanismSetsByUser, 
  getHeroMechanismsBySetId,
  updateHeroMechanismRating,
  toggleHeroMechanismFavorite,
  deleteHeroMechanismSet,
  incrementHeroMechanismCount
} from "../db";
import { getDb } from "../db";
import { services, idealCustomerProfiles, sourceOfTruth, campaigns, jobs, heroMechanisms } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";

// Helper to strip markdown code blocks from JSON responses
function stripMarkdownJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```json') && trimmed.endsWith('```')) {
    return trimmed.slice(7, -3).trim();
  }
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    return trimmed.slice(3, -3).trim();
  }
  return trimmed;
}

/**
 * Hero Mechanisms Router - Industry Standard
 * 
 * Generates 3 tabs of mechanism variations:
 * - Hero Mechanisms (5 creative mechanisms with unique names)
 * - Headline Ideas (5 headline variations)
 * - Power Mode (5 extra powerful variations)
 * 
 * Each mechanism has:
 * - Creative name (e.g., "Breakthrough Neural Nexus System")
 * - Full paragraph description with credibility, outcome, timeframe, emotional transformation
 */

export const heroMechanismsRouter = router({
  /**
   * Generate Hero Mechanisms
   * Creates 3 tabs with 5 mechanism variations each
   */
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string().max(5000),
        whyProblem: z.string().max(5000),
        whatTried: z.string().max(5000),
        whyExistingNotWork: z.string().max(5000),
        descriptor: z.string().max(5000).optional(), // Strategy, Framework, Method, System, etc.
        application: z.string().max(5000).optional(), // How it's applied
        desiredOutcome: z.string().max(5000),
        credibility: z.string().max(5000), // Authority figure
        socialProof: z.string().max(5000), // Publications, features
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "heroMechanisms");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(user.subscriptionTier, "heroMechanisms");
        if (user.heroMechanismGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} Hero Mechanism sets. Upgrade to generate more.`,
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
        'IDEAL CUSTOMER PROFILE — use this to make every mechanism specific and targeted:',
        icp.pains ? `Their daily pains: ${icp.pains}` : '',
        icp.frustrations ? `Their frustrations: ${icp.frustrations}` : '',
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

      // Item 1.3 — Rule 4: server-side fallbacks for Hero Mechanism
      const resolvedPressingProblem = input.pressingProblem?.trim() || service.painPoints || "";
      const resolvedWhyProblem = input.whyProblem?.trim() || service.whyProblemExists || "";
      const resolvedWhatTried = input.whatTried?.trim() || service.failedSolutions || "";
      const resolvedWhyExistingNotWork = input.whyExistingNotWork?.trim() || service.failedSolutions || "";
      const resolvedCredibility = input.credibility?.trim() || service.pressFeatures || "";

      const mechanismSetId = nanoid();
      const allMechanisms: any[] = [];

      // Generate Hero Mechanisms (5 variations)
      const heroMechanismsPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling Hero Mechanisms.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "System"}
Application: ${input.application || "Use this system"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
Create 5 HERO MECHANISMS. Each mechanism must have:
1. A creative, unique NAME using the descriptor (e.g., "Breakthrough Neural Nexus System", "Proprietary Market Guardian Protocol")
2. A full PARAGRAPH description (150-200 words) that includes:
   - How it works (technology/method)
   - Who developed it (credibility)
   - Specific outcome ($10,000/month, 6 months, etc.)
   - Emotional transformation (fear → confidence, confusion → clarity)
   - Why it's different from existing solutions

Examples:
{
  "name": "Breakthrough Neural Nexus System",
  "description": "This innovative system harnesses neural networks and machine learning algorithms to analyze market trends and predict high-profit crypto trades. Developed by an award-winning author in collaboration with top 7-figure traders, this method teaches beginners how to confidently trade and earn at least $10,000 per month. Within 6 months, users learn the critical, often overlooked real-time data patterns that lead to significant gains, transforming fear into calculated action and building real wealth."
}

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const heroMechanismsResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: heroMechanismsPrompt }
        ],
      });

      const heroMechanismsContent = typeof heroMechanismsResponse.choices[0].message.content === 'string' 
        ? heroMechanismsResponse.choices[0].message.content 
        : JSON.stringify(heroMechanismsResponse.choices[0].message.content);
      const heroMechanisms = JSON.parse(stripMarkdownJson(heroMechanismsContent));
      
      heroMechanisms.forEach((mechanism: { name: string; description: string }) => {
        allMechanisms.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          mechanismSetId,
          tabType: "hero_mechanisms" as const,
          mechanismName: mechanism.name,
          mechanismDescription: mechanism.description,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          whyProblem: input.whyProblem,
          whatTried: input.whatTried,
          whyExistingNotWork: input.whyExistingNotWork,
          descriptor: input.descriptor,
          application: input.application,
          desiredOutcome: input.desiredOutcome,
          credibility: input.credibility,
          socialProof: input.socialProof,
        });
      });

      // Generate Headline Ideas (5 variations)
      const headlineIdeasPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling headlines for Hero Mechanisms.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${input.desiredOutcome}
${icpContext ? `\n${icpContext}\n` : ''}
Create 5 HEADLINE IDEAS that:
- Grab attention immediately
- Promise a clear benefit
- Create curiosity
- Use power words

Each headline should have:
1. A creative NAME (the headline itself)
2. A supporting DESCRIPTION (50-100 words explaining why this headline works)

Examples:
{
  "name": "How Ordinary People Are Building $10K/Month Passive Income While Their Friends Work Dead-End Jobs",
  "description": "This headline uses social proof ('ordinary people'), specific outcome ($10K/month), and contrast (passive income vs. dead-end jobs) to create desire and urgency. It speaks directly to the target market's frustration with traditional employment."
}

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const headlineIdeasResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: headlineIdeasPrompt }
        ],
      });

      const headlineIdeasContent = typeof headlineIdeasResponse.choices[0].message.content === 'string' 
        ? headlineIdeasResponse.choices[0].message.content 
        : JSON.stringify(headlineIdeasResponse.choices[0].message.content);
      const headlineIdeas = JSON.parse(stripMarkdownJson(headlineIdeasContent));
      
      headlineIdeas.forEach((mechanism: { name: string; description: string }) => {
        allMechanisms.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          mechanismSetId,
          tabType: "headline_ideas" as const,
          mechanismName: mechanism.name,
          mechanismDescription: mechanism.description,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          whyProblem: input.whyProblem,
          whatTried: input.whatTried,
          whyExistingNotWork: input.whyExistingNotWork,
          descriptor: input.descriptor,
          application: input.application,
          desiredOutcome: input.desiredOutcome,
          credibility: input.credibility,
          socialProof: input.socialProof,
        });
      });

      // Generate Power Mode (5 extra powerful variations)
      const powerModePrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating BEAST MODE Hero Mechanisms - the most powerful, compelling versions.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "System"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
Create 5 BEAST MODE mechanisms - these should be:
- Even more creative and unique names
- Longer, more detailed descriptions (200-250 words)
- Include specific numbers, timeframes, and results
- Address objections preemptively
- Build massive credibility

Each mechanism must have:
1. An ultra-creative NAME with powerful descriptors
2. A comprehensive DESCRIPTION that sells the transformation

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const powerModeResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
          { role: "user", content: powerModePrompt }
        ],
      });

      const powerModeContent = typeof powerModeResponse.choices[0].message.content === 'string' 
        ? powerModeResponse.choices[0].message.content 
        : JSON.stringify(powerModeResponse.choices[0].message.content);
      const powerMode = JSON.parse(stripMarkdownJson(powerModeContent));
      
      powerMode.forEach((mechanism: { name: string; description: string }) => {
        allMechanisms.push({
          userId: user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          mechanismSetId,
          tabType: "beast_mode" as const,
          mechanismName: mechanism.name,
          mechanismDescription: mechanism.description,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          whyProblem: input.whyProblem,
          whatTried: input.whatTried,
          whyExistingNotWork: input.whyExistingNotWork,
          descriptor: input.descriptor,
          application: input.application,
          desiredOutcome: input.desiredOutcome,
          credibility: input.credibility,
          socialProof: input.socialProof,
        });
      });

      // Save all mechanisms to database
      await createHeroMechanisms(allMechanisms);
      await incrementHeroMechanismCount(user.id);
      await incrementQuotaCount(ctx.user.id, "heroMechanisms");

      return { mechanismSetId };
    }),

  /**
   * List all mechanism sets for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const sets = await getHeroMechanismSetsByUser(ctx.user.id);
    return sets;
  }),

  /**
   * Get all mechanisms from a specific set
   */
  getBySetId: protectedProcedure
    .input(z.object({ mechanismSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mechanisms = await getHeroMechanismsBySetId(input.mechanismSetId, ctx.user.id);
      return mechanisms;
    }),

  /**
   * Rate a mechanism (thumbs up/down)
   */
  rate: protectedProcedure
    .input(
      z.object({
        mechanismId: z.number(),
        rating: z.number().min(-1).max(1), // -1 = down, 0 = neutral, 1 = up
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHeroMechanismRating(input.mechanismId, ctx.user.id, input.rating);
      return { success: true };
    }),

  /**
   * Toggle favorite status
   */
  toggleFavorite: protectedProcedure
    .input(
      z.object({
        mechanismId: z.number(),
        isFavorite: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await toggleHeroMechanismFavorite(input.mechanismId, ctx.user.id, input.isFavorite);
      return { success: true };
    }),

  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number(), promptOverride: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "heroMechanisms");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(heroMechanisms)
        .where(and(eq(heroMechanisms.id, input.id), eq(heroMechanisms.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Hero mechanism not found" });
      }

      const overrideInstruction = input.promptOverride?.trim()
        ? ` Additional instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this coaching mechanism. Current name: ${existing.mechanismName}. Current description: ${existing.mechanismDescription}.${overrideInstruction} Return a JSON object with keys: mechanismName (string), mechanismDescription (string). No explanation, no markdown.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert coaching mechanism copywriter. Respond with only valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const parsed = JSON.parse(stripMarkdownJson(content));
      if (!parsed.mechanismName || !parsed.mechanismDescription) throw new Error("AI response missing required fields");

      await db
        .update(heroMechanisms)
        .set({ mechanismName: parsed.mechanismName, mechanismDescription: parsed.mechanismDescription, updatedAt: new Date() })
        .where(eq(heroMechanisms.id, input.id));

      const [updated] = await db
        .select()
        .from(heroMechanisms)
        .where(eq(heroMechanisms.id, input.id))
        .limit(1);

      return updated;
    }),

  /**
   * Delete entire mechanism set
   */
  delete: protectedProcedure
    .input(z.object({ mechanismSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHeroMechanismSet(input.mechanismSetId, ctx.user.id);
      return { success: true };
    }),

  /**
   * generateAsync — background job version of generate.
   * Immediately returns a jobId; generation runs via setImmediate outside the
   * HTTP request cycle so platform-level proxy timeouts cannot kill it.
   * Client polls GET /api/jobs/:jobId every 5 s for completion.
   */
  generateAsync: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string().max(5000),
        whyProblem: z.string().max(5000),
        whatTried: z.string().max(5000),
        whyExistingNotWork: z.string().max(5000),
        descriptor: z.string().max(5000).optional(),
        application: z.string().max(5000).optional(),
        desiredOutcome: z.string().max(5000),
        credibility: z.string().max(5000),
        socialProof: z.string().max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "heroMechanisms");

      // Quota check (same as generate)
      await checkAndResetQuotaIfNeeded(ctx.user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "heroMechanisms");
        if (user.heroMechanismGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} Hero Mechanism sets. Upgrade to generate more.`,
          });
        }
      }

      // Fetch all context data synchronously before returning
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [service] = await db.select().from(services)
        .where(eq(services.id, input.serviceId)).limit(1);
      if (!service) throw new Error("Service not found");

      let campaignRecord;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, ctx.user.id))).limit(1);
      }

      let icp;
      if (campaignRecord?.icpId) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
      }
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }

      const [sot] = await db.select().from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, ctx.user.id)).limit(1);

      // Capture everything needed inside the closure
      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };
      const capturedIcp = icp ? { ...icp } : undefined;
      const capturedSot = sot ? { ...sot } : undefined;

      // Insert pending job
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(user.id), status: "pending" });

      // Fire generation outside the request cycle
      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          // Rebuild context strings
          const bgIcpContext = capturedIcp ? [
            'IDEAL CUSTOMER PROFILE — use this to make every mechanism specific and targeted:',
            capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : '',
            capturedIcp.frustrations ? `Their frustrations: ${capturedIcp.frustrations}` : '',
            capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : '',
          ].filter(Boolean).join('\n').trim() : '';

          const bgSotLines = capturedSot ? [
            capturedSot.coreOffer        ? `Core offer: ${capturedSot.coreOffer}` : '',
            capturedSot.targetAudience   ? `Target audience: ${capturedSot.targetAudience}` : '',
            capturedSot.mainPainPoint    ? `Main pain point: ${capturedSot.mainPainPoint}` : '',
            capturedSot.mainBenefits     ? `Main benefits: ${capturedSot.mainBenefits}` : '',
            capturedSot.uniqueValue      ? `Unique value: ${capturedSot.uniqueValue}` : '',
            capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : '',
          ].filter(Boolean) : [];
          const bgSotContext = bgSotLines.length > 0
            ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...bgSotLines].join('\n')
            : '';

          const bgResolvedPressingProblem = capturedInput.pressingProblem?.trim() || capturedService.painPoints || "";
          const bgResolvedWhyProblem = capturedInput.whyProblem?.trim() || capturedService.whyProblemExists || "";
          const bgResolvedWhatTried = capturedInput.whatTried?.trim() || capturedService.failedSolutions || "";
          const bgResolvedWhyExistingNotWork = capturedInput.whyExistingNotWork?.trim() || capturedService.failedSolutions || "";
          const bgResolvedCredibility = capturedInput.credibility?.trim() || capturedService.pressFeatures || "";

          const mechanismSetId = nanoid();
          const allMechanisms: any[] = [];

          // --- Hero Mechanisms (5 variations) ---
          const heroMechanismsPrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nWhy Problem Exists: ${bgResolvedWhyProblem}\nWhat They've Tried: ${bgResolvedWhatTried}\nWhy Existing Solutions Fail: ${bgResolvedWhyExistingNotWork}\nDescriptor: ${capturedInput.descriptor || "System"}\nApplication: ${capturedInput.application || "Use this system"}\nDesired Outcome: ${capturedInput.desiredOutcome}\nCredibility: ${bgResolvedCredibility}\nSocial Proof: ${capturedInput.socialProof}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 HERO MECHANISMS. Each mechanism must have:\n1. A creative, unique NAME using the descriptor\n2. A full PARAGRAPH description (150-200 words) that includes how it works, who developed it, specific outcome, emotional transformation, and why it's different.\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const heroMechanismsResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
              { role: "user", content: heroMechanismsPrompt }
            ],
          });
          const heroMechanismsContent = typeof heroMechanismsResponse.choices[0].message.content === 'string'
            ? heroMechanismsResponse.choices[0].message.content
            : JSON.stringify(heroMechanismsResponse.choices[0].message.content);
          const heroMechanisms = JSON.parse(stripMarkdownJson(heroMechanismsContent));
          heroMechanisms.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "hero_mechanisms" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // --- Headline Ideas (5 variations) ---
          const headlineIdeasPrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling headlines for Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nDesired Outcome: ${capturedInput.desiredOutcome}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 HEADLINE IDEAS. Each should have a creative NAME (the headline) and a DESCRIPTION (50-100 words explaining why it works).\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const headlineIdeasResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
              { role: "user", content: headlineIdeasPrompt }
            ],
          });
          const headlineIdeasContent = typeof headlineIdeasResponse.choices[0].message.content === 'string'
            ? headlineIdeasResponse.choices[0].message.content
            : JSON.stringify(headlineIdeasResponse.choices[0].message.content);
          const headlineIdeas = JSON.parse(stripMarkdownJson(headlineIdeasContent));
          headlineIdeas.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "headline_ideas" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // --- Power Mode (5 extra powerful variations) ---
          const powerModePrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating BEAST MODE Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nWhy Problem Exists: ${bgResolvedWhyProblem}\nWhat They've Tried: ${bgResolvedWhatTried}\nWhy Existing Solutions Fail: ${bgResolvedWhyExistingNotWork}\nDescriptor: ${capturedInput.descriptor || "System"}\nDesired Outcome: ${capturedInput.desiredOutcome}\nCredibility: ${bgResolvedCredibility}\nSocial Proof: ${capturedInput.socialProof}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 BEAST MODE mechanisms with ultra-creative names and comprehensive descriptions (200-250 words) that include specific numbers, timeframes, results, and address objections.\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const powerModeResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert. Return ONLY valid JSON arrays." },
              { role: "user", content: powerModePrompt }
            ],
          });
          const powerModeContent = typeof powerModeResponse.choices[0].message.content === 'string'
            ? powerModeResponse.choices[0].message.content
            : JSON.stringify(powerModeResponse.choices[0].message.content);
          const powerMode = JSON.parse(stripMarkdownJson(powerModeContent));
          powerMode.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "beast_mode" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // Save all mechanisms and increment quota
          await createHeroMechanisms(allMechanisms);
          await incrementHeroMechanismCount(capturedUserId);
          await incrementQuotaCount(capturedUserId, "heroMechanisms");

          // Mark job complete
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ mechanismSetId }) })
            .where(eq(jobs.id, jobId));
          console.log(`[generateAsync] Job ${jobId} completed, mechanismSetId: ${mechanismSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) {
              await bgDb2.update(jobs)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eq(jobs.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      // Return immediately — HTTP connection closes in <1s
      return { jobId };
    }),
});
