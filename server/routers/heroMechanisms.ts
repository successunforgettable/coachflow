import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getCascadeContext } from "../_core/cascadeContext";
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
import { services, idealCustomerProfiles, sourceOfTruth, campaigns, jobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

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

      // Cascade context — read upstream campaignKits selections for this ICP
      // and prepend to each LLM user-message. Must mirror the call in generateAsync.
      const cascadeContext = await getCascadeContext(ctx.user.id, icp?.id, "mechanism");

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
      let generationWarning: string | undefined;

      // Generate Hero Mechanisms (5 variations)
      const heroMechanismsPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling Hero Mechanisms.

Product: ${service.name}
Target Market: ${input.targetMarket}
Pressing Problem: ${resolvedPressingProblem}
Why Problem Exists: ${resolvedWhyProblem}
What They've Tried: ${resolvedWhatTried}
Why Existing Solutions Fail: ${resolvedWhyExistingNotWork}
Descriptor: ${input.descriptor || "[INSERT_DESCRIPTOR]"}
Application: ${input.application || "[INSERT_APPLICATION_METHOD]"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
MECHANISM NAME RULES — apply to every name generated:
- Must contain a specific process word or metaphor FROM THIS NICHE (not from generic business language)
- Must sound proprietary and outcome-specific — not transferable to a different coaching niche
- BANNED names (never generate anything like these): The Success Blueprint, The Growth System, The Transformation Framework, The Mindset Method, The Achievement Protocol, The Breakthrough System, The Empowerment Method, The Results Framework
- GOOD name structure: [Niche-specific process word] + [Specific outcome word] + [Descriptor]. The first word must come from the vocabulary of this specific niche.
- Test: Could this mechanism name appear in a different coaching niche? If yes, it fails — rewrite it.

Create 5 HERO MECHANISMS. Each mechanism must have:
1. A proprietary-sounding NAME that:
   - Contains at least one word specific to the target market's niche or industry
   - Names the specific transformation (not "growth" or "success" — what specifically changes?)
   - Sounds like something that exists as a real system, not a marketing concept
2. A full PARAGRAPH description (150-200 words) that includes:
   - The specific problem it solves (name the problem, not a category of problems)
   - Who developed it and why (credibility tied to niche, not generic "award-winning expert")
   - A concrete outcome with a number or timeframe ($X/month, X clients in Y weeks, etc.)
   - What specifically makes it different from what they've already tried (name the failed approaches)
   - One before/after moment that makes the transformation real and believable

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const heroMechanismsResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
          { role: "user", content: cascadeContext + heroMechanismsPrompt }
        ],
      });

      const heroMechanismsContent = typeof heroMechanismsResponse.choices[0].message.content === 'string'
        ? heroMechanismsResponse.choices[0].message.content 
        : JSON.stringify(heroMechanismsResponse.choices[0].message.content);
      // LLM occasionally returns explanatory text — this guard prevents a crash and returns empty array as fallback.
      let heroMechanisms: { name: string; description: string }[] = [];
      try {
        const parsed = JSON.parse(stripMarkdownJson(heroMechanismsContent));
        heroMechanisms = Array.isArray(parsed) ? parsed : [];
        if (!Array.isArray(parsed)) generationWarning = "Mechanism generation returned unexpected format — please try again.";
      } catch {
        heroMechanisms = [];
        generationWarning = "Mechanism generation returned unexpected format — please try again.";
      }

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
THREE-QUESTION TEST — every headline must pass all three:
1. Does it name a specific type of person in a specific situation? (not "entrepreneurs" but "coaches who've been running webinars to empty rooms")
2. Does it promise a specific outcome — not a vague benefit? (not "more clients" but "8 discovery calls booked in 14 days")
3. Could this headline ONLY be written for this service? (if it works for any coach, rewrite it)

BANNED HEADLINE OPENERS AND PHRASES — never use:
- "Are you ready to...", "Do you want to...", "The secret to...", "How to finally...", "Everything you need to..."
- "Transform your...", "Unlock your...", "Discover how to...", "The ultimate guide to..."
- Generic power words: skyrocket, explode, crush it, dominate, master

Create 5 HEADLINE IDEAS for the hero mechanism. Each headline must:
- Contain at least one word directly from the ICP's pain language or niche vocabulary
- Name a concrete outcome (number, timeframe, or named situation) not a category of outcomes
- Be written as a real headline, not a template with [brackets]

Each headline should have:
1. A creative NAME (the headline itself — a real, complete headline)
2. A supporting DESCRIPTION (50-100 words explaining specifically: which ICP pain word it uses, which ad angle it applies, and what makes this niche-specific rather than generic)

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const headlineIdeasResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
          { role: "user", content: cascadeContext + headlineIdeasPrompt }
        ],
      });

      const headlineIdeasContent = typeof headlineIdeasResponse.choices[0].message.content === 'string'
        ? headlineIdeasResponse.choices[0].message.content 
        : JSON.stringify(headlineIdeasResponse.choices[0].message.content);
      // LLM occasionally returns explanatory text — this guard prevents a crash and returns empty array as fallback.
      let headlineIdeas: { name: string; description: string }[] = [];
      try {
        const parsed = JSON.parse(stripMarkdownJson(headlineIdeasContent));
        headlineIdeas = Array.isArray(parsed) ? parsed : [];
        if (!Array.isArray(parsed)) generationWarning = "Mechanism generation returned unexpected format — please try again.";
      } catch {
        headlineIdeas = [];
        generationWarning = "Mechanism generation returned unexpected format — please try again.";
      }

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
Descriptor: ${input.descriptor || "[INSERT_DESCRIPTOR]"}
Desired Outcome: ${input.desiredOutcome}
Credibility: ${resolvedCredibility}
Social Proof: ${input.socialProof}
${icpContext ? `\n${icpContext}\n` : ''}
MECHANISM NAME RULES — apply strictly to every name:
- Must contain a specific process word or metaphor FROM THIS NICHE — not from generic business language
- Must be so niche-specific that someone from a different coaching niche would not recognise it as applying to them
- BANNED: The Success Blueprint, The Growth System, The Transformation Framework, The Mindset Method, The Achievement Protocol, The Breakthrough System — or anything that sounds like these
- GOOD: names where the first or second word comes from the vocabulary this specific target market uses every day
- Test: If you replaced the service name with a different coaching service, would the mechanism name still make sense? If yes, it fails.

Create 5 POWER MODE mechanisms — the most compelling, most niche-specific, most conversion-ready versions:
- Names are even more proprietary and niche-rooted than the standard set
- Descriptions are 200-250 words and go deeper on: the exact mechanism of action, the named enemy (the thing that has been failing them until now), the specific before/after moment, and the concrete result with a number
- Address the top objection preemptively within the description itself
- Build credibility through niche-specific authority (not generic "award-winning expert" — name the specific credibility relevant to this target market)

Each mechanism must have:
1. A NAME that could only apply to this specific niche and target market
2. A comprehensive DESCRIPTION (200-250 words) that makes someone in this target market feel: "This was built for someone exactly like me"

Return ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

      const powerModeResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
          { role: "user", content: cascadeContext + powerModePrompt }
        ],
      });

      const powerModeContent = typeof powerModeResponse.choices[0].message.content === 'string'
        ? powerModeResponse.choices[0].message.content
        : JSON.stringify(powerModeResponse.choices[0].message.content);
      // Power mode returns { name, description }[] — if LLM returns explanatory text this guard prevents a crash.
      let powerMode: { name: string; description: string }[] = [];
      try {
        const parsed = JSON.parse(stripMarkdownJson(powerModeContent));
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          powerMode = parsed;
        } else {
          console.error('[heroMechanisms] power mode: unexpected JSON shape, falling back to empty array. Content:', powerModeContent.slice(0, 300));
          generationWarning = "Mechanism generation returned unexpected format — please try again.";
        }
      } catch (e) {
        console.error('[heroMechanisms] power mode: JSON.parse failed, falling back to empty array. Content:', powerModeContent.slice(0, 300));
        generationWarning = "Mechanism generation returned unexpected format — please try again.";
      }
      
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

      return { mechanismSetId, generationWarning };
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

      // Cascade context — fetched during request, captured for setImmediate.
      // Must mirror the call in generate.
      const capturedCascadeContext = await getCascadeContext(ctx.user.id, icp?.id, "mechanism");

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
          let bgGenerationWarning: string | undefined;

          // --- Hero Mechanisms (5 variations) ---
          const heroMechanismsPrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nWhy Problem Exists: ${bgResolvedWhyProblem}\nWhat They've Tried: ${bgResolvedWhatTried}\nWhy Existing Solutions Fail: ${bgResolvedWhyExistingNotWork}\nDescriptor: ${capturedInput.descriptor || "[INSERT_DESCRIPTOR]"}\nApplication: ${capturedInput.application || "[INSERT_APPLICATION_METHOD]"}\nDesired Outcome: ${capturedInput.desiredOutcome}\nCredibility: ${bgResolvedCredibility}\nSocial Proof: ${capturedInput.socialProof}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 HERO MECHANISMS. Each mechanism must have:\n1. A creative, unique NAME using the descriptor\n2. A full PARAGRAPH description (150-200 words) that includes how it works, who developed it, specific outcome, emotional transformation, and why it's different.\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const heroMechanismsResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
              { role: "user", content: capturedCascadeContext + heroMechanismsPrompt }
            ],
          });
          const heroMechanismsContent = typeof heroMechanismsResponse.choices[0].message.content === 'string'
            ? heroMechanismsResponse.choices[0].message.content
            : JSON.stringify(heroMechanismsResponse.choices[0].message.content);
          // LLM occasionally returns explanatory text — guard prevents crash, empty array as fallback.
          let heroMechanisms: { name: string; description: string }[] = [];
          try {
            const parsed = JSON.parse(stripMarkdownJson(heroMechanismsContent));
            heroMechanisms = Array.isArray(parsed) ? parsed : [];
            if (!Array.isArray(parsed)) bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
          } catch {
            heroMechanisms = [];
            bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
          }
          heroMechanisms.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "hero_mechanisms" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // --- Headline Ideas (5 variations) ---
          const headlineIdeasPrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating compelling headlines for Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nDesired Outcome: ${capturedInput.desiredOutcome}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 HEADLINE IDEAS. Each should have a creative NAME (the headline) and a DESCRIPTION (50-100 words explaining why it works).\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const headlineIdeasResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
              { role: "user", content: capturedCascadeContext + headlineIdeasPrompt }
            ],
          });
          const headlineIdeasContent = typeof headlineIdeasResponse.choices[0].message.content === 'string'
            ? headlineIdeasResponse.choices[0].message.content
            : JSON.stringify(headlineIdeasResponse.choices[0].message.content);
          // LLM occasionally returns explanatory text — guard prevents crash, empty array as fallback.
          let headlineIdeas: { name: string; description: string }[] = [];
          try {
            const parsed = JSON.parse(stripMarkdownJson(headlineIdeasContent));
            headlineIdeas = Array.isArray(parsed) ? parsed : [];
            if (!Array.isArray(parsed)) bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
          } catch {
            headlineIdeas = [];
            bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
          }
          headlineIdeas.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "headline_ideas" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // --- Power Mode (5 extra powerful variations) ---
          const powerModePrompt = `${bgSotContext ? `${bgSotContext}\n\n` : ''}You are an expert direct response copywriter creating BEAST MODE Hero Mechanisms.\n\nProduct: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${bgResolvedPressingProblem}\nWhy Problem Exists: ${bgResolvedWhyProblem}\nWhat They've Tried: ${bgResolvedWhatTried}\nWhy Existing Solutions Fail: ${bgResolvedWhyExistingNotWork}\nDescriptor: ${capturedInput.descriptor || "[INSERT_DESCRIPTOR]"}\nDesired Outcome: ${capturedInput.desiredOutcome}\nCredibility: ${bgResolvedCredibility}\nSocial Proof: ${capturedInput.socialProof}\n${bgIcpContext ? `\n${bgIcpContext}\n` : ''}\nCreate 5 BEAST MODE mechanisms with ultra-creative names and comprehensive descriptions (200-250 words) that include specific numbers, timeframes, results, and address objections.\n\nReturn ONLY a JSON array of 5 objects with "name" and "description" fields, nothing else.`;

          const powerModeResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a direct response copywriting expert who specialises in creating proprietary mechanism names and descriptions for coaches and consultants. You write mechanism names that are niche-specific — containing vocabulary from the target market's industry, not generic business language. Your mechanism descriptions make the reader feel the copy was written specifically for them. Return ONLY valid JSON arrays." },
              { role: "user", content: capturedCascadeContext + powerModePrompt }
            ],
          });
          const powerModeContent = typeof powerModeResponse.choices[0].message.content === 'string'
            ? powerModeResponse.choices[0].message.content
            : JSON.stringify(powerModeResponse.choices[0].message.content);
          // LLM occasionally returns explanatory text — guard prevents crash, empty array as fallback.
          let powerMode: { name: string; description: string }[] = [];
          try {
            const parsed = JSON.parse(stripMarkdownJson(powerModeContent));
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
              powerMode = parsed;
            } else {
              bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
            }
          } catch {
            bgGenerationWarning = "Mechanism generation returned unexpected format — please try again.";
          }
          powerMode.forEach((m: { name: string; description: string }) => {
            allMechanisms.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId, mechanismSetId, tabType: "beast_mode" as const, mechanismName: m.name, mechanismDescription: m.description, targetMarket: capturedInput.targetMarket, pressingProblem: capturedInput.pressingProblem, whyProblem: capturedInput.whyProblem, whatTried: capturedInput.whatTried, whyExistingNotWork: capturedInput.whyExistingNotWork, descriptor: capturedInput.descriptor, application: capturedInput.application, desiredOutcome: capturedInput.desiredOutcome, credibility: capturedInput.credibility, socialProof: capturedInput.socialProof });
          });

          // Save all mechanisms and increment quota
          await createHeroMechanisms(allMechanisms);
          await incrementHeroMechanismCount(capturedUserId);

          // Mark job complete — include generationWarning if any tab returned unexpected format
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ mechanismSetId, generationWarning: bgGenerationWarning }) })
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
