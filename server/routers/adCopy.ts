import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adCopy, services, campaigns, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { nanoid } from "nanoid";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { checkCompliance } from "../lib/complianceChecker";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}

const META_COMPLIANCE_RULES = `
CRITICAL COMPLIANCE RULES — Every piece of ad copy you generate MUST follow these rules without exception. These are Meta (Facebook/Instagram) advertising policy requirements.

NEVER include:
1. Income or earnings claims — Do NOT write: "make $10k/month", "earn passive income", "quit your 9-5", "replace your salary", "make money from home", "6-figure income", "financial freedom in 30 days"
2. Guaranteed results — Do NOT write: "guaranteed", "100% results", "works every time", "proven to work for everyone"
3. Specific transformation claims — Do NOT write: "lose 20kg in 30 days", "get abs in 6 weeks", "cure your anxiety", "fix your relationship overnight"
4. Superlatives without qualification — Do NOT write: "#1 coach", "the best program", "world's greatest", "unbeatable results" (unless qualified with "in [specific verified category]")
5. Sensationalist language — Do NOT write: "shocking secret", "they don't want you to know", "banned method", "underground technique", "what doctors won't tell you"
6. False urgency or scarcity — Do NOT write: "only 3 spots left" (unless literally true), "offer expires tonight" (unless literally true), "last chance forever"
7. Before/after transformation language — Do NOT write: "before I was broke, now I'm rich", "I used to be fat, now I'm thin" style claims
8. Personal attribute targeting language — Do NOT write copy that singles out age, religion, race, sexual orientation, disability, health conditions, or financial hardship as audience identifiers
9. Misleading claims — Do NOT imply celebrity endorsement, Meta endorsement, government approval, or scientific proof without verified evidence
10. Prohibited CTAs — Do NOT use: "Click here to get rich", "Buy now before it's too late", "You'd be stupid not to"

ALWAYS include:
1. Results qualifier when making any outcome claim: use "results may vary", "typical results", "individual results will differ"
2. Honest benefit language: focus on the process and experience, not guaranteed outcomes
3. Approved CTA formats: "Learn More", "Sign Up", "Book a Call", "Get Started", "Download Free Guide", "Watch Free Training"
4. Professional tone: authoritative but not sensationalist

REFRAME THESE COMMON VIOLATIONS:
- "Make $10k/month" → "Build a sustainable coaching income"
- "Guaranteed results" → "A proven framework used by [X] coaches"
- "Lose 20kg guaranteed" → "A structured approach to sustainable weight loss"
- "Secret method" → "A counterintuitive approach that most coaches overlook"
- "Quit your 9-5" → "Create a coaching business that fits your life"
- "Only 3 spots left" → "Applications now open" (unless truly limited)

Your output must be ad copy that could be submitted directly to Meta without triggering a policy violation review.
`;

const generateAdCopySchema = z.object({
  serviceId: z.coerce.number(),
  campaignId: z.number().optional(),
  adType: z.enum(["lead_gen", "ecommerce"]).default("lead_gen"),
  // 17 fields
  adStyle: z.string(),
  adCallToAction: z.string(),
  targetMarket: z.string(),
  productCategory: z.string(),
  specificProductName: z.string(),
  pressingProblem: z.string(),
  desiredOutcome: z.string(),
  uniqueMechanism: z.string().optional(),
  listBenefits: z.string().optional(),
  specificTechnology: z.string().optional(),
  scientificStudies: z.string().optional(),
  credibleAuthority: z.string().optional(),
  featuredIn: z.string().optional(),
  numberOfReviews: z.string().optional(),
  averageReviewRating: z.string().optional(),
  totalCustomers: z.string().optional(),
  testimonials: z.string().optional(),
  powerMode: z.boolean().optional(),
});

const updateAdCopySchema = z.object({
  id: z.number(),
  content: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const adCopyRouter = router({
  // List all ad sets for current user
  list: protectedProcedure
    .input(
      z
        .object({
          serviceId: z.number().optional(),
          campaignId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(adCopy.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(adCopy.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(adCopy.campaignId, input.campaignId));
      }

      const allAds = await db
        .select()
        .from(adCopy)
        .where(and(...conditions))
        .orderBy(desc(adCopy.createdAt));

      // Group by adSetId
      const adSets = new Map<string, any>();
      for (const ad of allAds) {
        if (!adSets.has(ad.adSetId)) {
          adSets.set(ad.adSetId, {
            adSetId: ad.adSetId,
            adType: ad.adType,
            serviceId: ad.serviceId,
            campaignId: ad.campaignId,
            // 17 fields
            adStyle: ad.adStyle,
            adCallToAction: ad.adCallToAction,
            targetMarket: ad.targetMarket,
            productCategory: ad.productCategory,
            specificProductName: ad.specificProductName,
            pressingProblem: ad.pressingProblem,
            desiredOutcome: ad.desiredOutcome,
            uniqueMechanism: ad.uniqueMechanism,
            listBenefits: ad.listBenefits,
            specificTechnology: ad.specificTechnology,
            scientificStudies: ad.scientificStudies,
            credibleAuthority: ad.credibleAuthority,
            featuredIn: ad.featuredIn,
            numberOfReviews: ad.numberOfReviews,
            averageReviewRating: ad.averageReviewRating,
            totalCustomers: ad.totalCustomers,
            testimonials: ad.testimonials,
            createdAt: ad.createdAt,
            headlines: [],
            bodies: [],
            links: [],
          });
        }
        const adSet = adSets.get(ad.adSetId);
        if (ad.contentType === "headline") adSet.headlines.push(ad);
        else if (ad.contentType === "body") adSet.bodies.push(ad);
        else if (ad.contentType === "link") adSet.links.push(ad);
      }

      return Array.from(adSets.values());
    }),

  // Get single ad set by adSetId
  getByAdSetId: protectedProcedure
    .input(z.object({ adSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const ads = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, input.adSetId), eq(adCopy.userId, ctx.user.id)))
        .orderBy(desc(adCopy.createdAt));

      if (ads.length === 0) {
        throw new Error("Ad set not found");
      }

      const adSet = {
        adSetId: ads[0].adSetId,
        adType: ads[0].adType,
        serviceId: ads[0].serviceId,
        campaignId: ads[0].campaignId,
        // 17 fields
        adStyle: ads[0].adStyle,
        adCallToAction: ads[0].adCallToAction,
        targetMarket: ads[0].targetMarket,
        productCategory: ads[0].productCategory,
        specificProductName: ads[0].specificProductName,
        pressingProblem: ads[0].pressingProblem,
        desiredOutcome: ads[0].desiredOutcome,
        uniqueMechanism: ads[0].uniqueMechanism,
        listBenefits: ads[0].listBenefits,
        specificTechnology: ads[0].specificTechnology,
        scientificStudies: ads[0].scientificStudies,
        credibleAuthority: ads[0].credibleAuthority,
        featuredIn: ads[0].featuredIn,
        numberOfReviews: ads[0].numberOfReviews,
        averageReviewRating: ads[0].averageReviewRating,
        totalCustomers: ads[0].totalCustomers,
        testimonials: ads[0].testimonials,
        createdAt: ads[0].createdAt,
        headlines: ads.filter(a => a.contentType === "headline"),
        bodies: ads.filter(a => a.contentType === "body"),
        links: ads.filter(a => a.contentType === "link"),
      };

      return adSet;
    }),

  // Generate ad copy using AI (Industry standard: 15 headlines, 15 bodies, 15 links)
  generate: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await enforceQuota(ctx.user.id, "adCopy");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "adCopy");
        if (ctx.user.adCopyGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} ad copy sets. Upgrade to generate more.`,
          });
        }
      }

      // Get service details with social proof (Issue 2 fix)
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // Campaign fetch — Item 1.1b (icpId support)
      let campaignRecord;
      if (input.campaignId) {
        [campaignRecord] = await db
          .select()
          .from(campaigns)
          .where(and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.userId, ctx.user.id)
          ))
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

      const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.objections ? `Their objections to buying: ${icp.objections}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : ''}
`.trim() : '';

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

      // Item 1.3 — Rule 4: server-side fallbacks (use input if provided, else fall back to service record)
      const resolvedPressingProblem = input.pressingProblem?.trim() || service.painPoints || "";
      const resolvedDesiredOutcome = input.desiredOutcome?.trim() || service.mainBenefit || "";
      const resolvedUniqueMechanism = input.uniqueMechanism?.trim() || service.uniqueMechanismSuggestion || "";
      const resolvedCredibleAuthority = input.credibleAuthority?.trim() || service.pressFeatures || "";
      const resolvedFeaturedIn = input.featuredIn?.trim() || service.pressFeatures || "";
      const resolvedNumberOfReviews = input.numberOfReviews?.trim() || service.totalReviews?.toString() || "";
      const resolvedAverageReviewRating = input.averageReviewRating?.trim() || service.averageRating?.toString() || "";
      const resolvedTotalCustomers = input.totalCustomers?.trim() || service.totalCustomers?.toString() || "";
      const resolvedTestimonials = input.testimonials?.trim() ||
        [service.testimonial1Quote, service.testimonial2Quote, service.testimonial3Quote]
          .filter(Boolean).join(" | ") || "";

      // Extract real social proof data
      const socialProof = {
        hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
        hasRating: !!service.averageRating && parseFloat(service.averageRating) > 0,
        hasReviews: !!service.totalReviews && service.totalReviews > 0,
        hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
        hasPress: !!service.pressFeatures && service.pressFeatures.trim().length > 0,
        customerCount: service.totalCustomers || 0,
        rating: service.averageRating || '',
        reviewCount: service.totalReviews || 0,
        press: service.pressFeatures || '',
      };

      const adSetId = nanoid();
      const count = input.powerMode ? 30 : 15; // Power Mode generates 2x

      const adTypeContext = input.adType === "lead_gen"
        ? "Lead Generation (free webinar, consultation, download)"
        : "E-commerce (direct product sale)";

      // Generate Headlines with social proof guidance (Issue 2 fix)
      const socialProofGuidance = socialProof.hasCustomers || socialProof.hasRating || socialProof.hasReviews
        ? `REAL SOCIAL PROOF AVAILABLE - Use these verified numbers:
- ${socialProof.customerCount} total customers
- ${socialProof.rating} average rating
- ${socialProof.reviewCount} reviews
You MUST use these exact numbers when incorporating social proof. Do not fabricate or inflate.`
        : `NO SOCIAL PROOF DATA PROVIDED - Use launch-safe alternatives:
- Focus on benefit claims and outcomes ("Get X result")
- Use curiosity hooks ("The method that...")
- Use contrast ("Before vs After")
- DO NOT mention customer counts, ratings, or reviews
- DO NOT fabricate testimonials or statistics`;
      
      const headlinePrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting ad HEADLINES for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism || 'N/A'}
Key Benefits: ${input.listBenefits || 'N/A'}
Specific Technology: ${input.specificTechnology || 'N/A'}
Scientific Studies: ${input.scientificStudies || 'N/A'}
Credible Authority: ${resolvedCredibleAuthority || 'N/A'}

${socialProofGuidance}

${icpContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}
Call To Action: ${input.adCallToAction}

Create ${count} attention-grabbing headlines (max 40 characters each) that:
- Hook the reader immediately using the pressing problem or unique mechanism
- Highlight the transformation or benefit
- Incorporate social proof (reviews, customers, authority figures) when available
- Create curiosity or urgency
- Are specific and concrete
- Match the ad style (${input.adStyle})

Format as JSON array:
{
  "headlines": ["headline 1", "headline 2", ...]
}`;

      const headlineResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.`,
          },
          { role: "user", content: headlinePrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ad_headlines",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headlines: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["headlines"],
              additionalProperties: false,
            },
          },
        },
      });

      const headlineContent = headlineResponse.choices[0].message.content;
      if (typeof headlineContent !== "string") {
        throw new Error("Invalid headline response");
      }
      const headlineData = JSON.parse(stripMarkdownJson(headlineContent));

      // Issue 3: Generate Body Copy using 15 distinct angles
      const { ALL_BODY_ANGLES, BODY_ANGLE_PROMPTS } = await import('../adCopyAngles');
      
      // Select 15 angles (or fewer if count < 15)
      const selectedAngles = ALL_BODY_ANGLES.slice(0, Math.min(count, 15));
      
      // Generate one body per angle in parallel
      const bodyPromises = selectedAngles.map(async (angle) => {
        const anglePrompt = BODY_ANGLE_PROMPTS[angle];
        
        const bodyPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ONE high-converting ad BODY COPY using the ${angle.replace('_', ' ')} angle:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Pressing Problem: ${resolvedPressingProblem}
Desired Outcome: ${resolvedDesiredOutcome}
Unique Mechanism: ${resolvedUniqueMechanism || 'N/A'}
Key Benefits: ${input.listBenefits || 'N/A'}
Specific Technology: ${input.specificTechnology || 'N/A'}
Scientific Studies: ${input.scientificStudies || 'N/A'}
Credible Authority: ${resolvedCredibleAuthority || 'N/A'}

${socialProofGuidance}

${icpContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}
Call To Action: ${input.adCallToAction}

${anglePrompt}

Create ONE body copy (125-150 words) following the ${angle.replace('_', ' ')} structure above.
End with clear call-to-action: ${input.adCallToAction}

Return ONLY the body text as a single string, no JSON wrapper.`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.`,
            },
            { role: "user", content: bodyPrompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) throw new Error(`Empty response for ${angle} angle`);
        const content = typeof rawContent === 'string' ? rawContent.trim() : '';
        if (!content) throw new Error(`Invalid content type for ${angle} angle`);
        
        return { angle, body: content };
      });
      
      const bodyResults = await Promise.all(bodyPromises);
      const bodyData = { bodies: bodyResults.map(r => r.body) };

      // Generate Link Descriptions
      const linkPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting LINK DESCRIPTIONS for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Product Category: ${input.productCategory}
Specific Product Name: ${input.specificProductName}
Desired Outcome: ${resolvedDesiredOutcome}
Call To Action: ${input.adCallToAction}

${icpContext}

Ad Type: ${adTypeContext}
Ad Style: ${input.adStyle}

Create ${count} clear, action-oriented link descriptions (max 30 characters each) that:
- State the clear next step aligned with the CTA (${input.adCallToAction})
- Create urgency or excitement
- Are benefit-focused
- Match the ad style tone

Format as JSON array:
{
  "links": ["link 1", "link 2", ...]
}`;

      const linkResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.`,
          },
          { role: "user", content: linkPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ad_links",
            strict: true,
            schema: {
              type: "object",
              properties: {
                links: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["links"],
              additionalProperties: false,
            },
          },
        },
      });

      const linkContent = linkResponse.choices[0].message.content;
      if (typeof linkContent !== "string") {
        throw new Error("Invalid link response");
      }
      const linkData = JSON.parse(stripMarkdownJson(linkContent));

      // Save all variations to database
      const allInserts = [];

      // Insert headlines
      for (const headline of headlineData.headlines) {
        const complianceResult = await checkCompliance(headline, {
          userId: ctx.user.id,
          generatorType: 'adCopy',
          trackUsage: true,
        });
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          adStyle: input.adStyle,
          adCallToAction: input.adCallToAction,
          contentType: "headline" as const,
          content: headline,
          // 17 fields
          targetMarket: input.targetMarket,
          productCategory: input.productCategory,
          specificProductName: input.specificProductName,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism || null,
          listBenefits: input.listBenefits || null,
          specificTechnology: input.specificTechnology || null,
          scientificStudies: input.scientificStudies || null,
          credibleAuthority: input.credibleAuthority || null,
          featuredIn: input.featuredIn || null,
          numberOfReviews: input.numberOfReviews || null,
          averageReviewRating: input.averageReviewRating || null,
          totalCustomers: input.totalCustomers || null,
          testimonials: input.testimonials || null,
          // Compliance fields
          complianceScore: complianceResult.score,
          complianceVersion: complianceResult.version,
          complianceCheckedAt: new Date(),
        });
      }

      // Insert body copies with angles (Issue 3)
      for (const result of bodyResults) {
        const complianceResult = await checkCompliance(result.body, {
          userId: ctx.user.id,
          generatorType: 'adCopy',
          trackUsage: true,
        });
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          adStyle: input.adStyle,
          adCallToAction: input.adCallToAction,
          contentType: "body" as const,
          bodyAngle: result.angle,
          content: result.body,
          targetMarket: input.targetMarket,
          productCategory: input.productCategory,
          specificProductName: input.specificProductName,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism || null,
          listBenefits: input.listBenefits || null,
          specificTechnology: input.specificTechnology || null,
          scientificStudies: input.scientificStudies || null,
          credibleAuthority: input.credibleAuthority || null,
          featuredIn: input.featuredIn || null,
          numberOfReviews: input.numberOfReviews || null,
          averageReviewRating: input.averageReviewRating || null,
          totalCustomers: input.totalCustomers || null,
          testimonials: input.testimonials || null,
          // Compliance fields
          complianceScore: complianceResult.score,
          complianceVersion: complianceResult.version,
          complianceCheckedAt: new Date(),
        });
      }

      // Insert links
      for (const link of linkData.links) {
        const complianceResult = await checkCompliance(link);
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          adStyle: input.adStyle,
          adCallToAction: input.adCallToAction,
          contentType: "link" as const,
          content: link,
          targetMarket: input.targetMarket,
          productCategory: input.productCategory,
          specificProductName: input.specificProductName,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism || null,
          listBenefits: input.listBenefits || null,
          specificTechnology: input.specificTechnology || null,
          scientificStudies: input.scientificStudies || null,
          credibleAuthority: input.credibleAuthority || null,
          featuredIn: input.featuredIn || null,
          numberOfReviews: input.numberOfReviews || null,
          averageReviewRating: input.averageReviewRating || null,
          totalCustomers: input.totalCustomers || null,
          testimonials: input.testimonials || null,
          // Compliance fields
          complianceScore: complianceResult.score,
          complianceVersion: complianceResult.version,
          complianceCheckedAt: new Date(),
        });
      }

      await db.insert(adCopy).values(allInserts);

      await incrementQuotaCount(ctx.user.id, "adCopy");

      return {
        adSetId,
        count: allInserts.length,
        headlineCount: headlineData.headlines.length,
        bodyCount: bodyData.bodies.length,
        linkCount: linkData.links.length,
      };
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; ad copy generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(ctx.user.id, "adCopy");
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "adCopy");
        if (user.adCopyGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} ad copy sets. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");

      let campaignRecord: any;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
      }
      let icp: any;
      if (campaignRecord?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1); }
      if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1); }
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

          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.communicationStyle ? `How they communicate: ${capturedIcp.communicationStyle}` : ''}`.trim() : '';
          const sotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '', capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '', capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '', capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';

          const resolvedPressingProblem = capturedInput.pressingProblem?.trim() || capturedService.painPoints || "";
          const resolvedDesiredOutcome = capturedInput.desiredOutcome?.trim() || capturedService.mainBenefit || "";
          const resolvedUniqueMechanism = capturedInput.uniqueMechanism?.trim() || capturedService.uniqueMechanismSuggestion || "";
          const resolvedCredibleAuthority = capturedInput.credibleAuthority?.trim() || capturedService.pressFeatures || "";
          const resolvedFeaturedIn = capturedInput.featuredIn?.trim() || capturedService.pressFeatures || "";
          const resolvedNumberOfReviews = capturedInput.numberOfReviews?.trim() || capturedService.totalReviews?.toString() || "";
          const resolvedAverageReviewRating = capturedInput.averageReviewRating?.trim() || capturedService.averageRating?.toString() || "";
          const resolvedTotalCustomers = capturedInput.totalCustomers?.trim() || capturedService.totalCustomers?.toString() || "";
          const resolvedTestimonials = capturedInput.testimonials?.trim() || [capturedService.testimonial1Quote, capturedService.testimonial2Quote, capturedService.testimonial3Quote].filter(Boolean).join(" | ") || "";

          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, hasPress: !!capturedService.pressFeatures && capturedService.pressFeatures.trim().length > 0, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0, press: capturedService.pressFeatures || '' };
          const adSetId = nanoid();
          const count = capturedInput.powerMode ? 30 : 15;
          const adTypeContext = capturedInput.adType === "lead_gen" ? "Lead Generation (free webinar, consultation, download)" : "E-commerce (direct product sale)";
          const socialProofGuidance = socialProof.hasCustomers || socialProof.hasRating || socialProof.hasReviews ? `REAL SOCIAL PROOF AVAILABLE - Use these verified numbers:\n- ${socialProof.customerCount} total customers\n- ${socialProof.rating} average rating\n- ${socialProof.reviewCount} reviews\nYou MUST use these exact numbers when incorporating social proof. Do not fabricate or inflate.` : `NO SOCIAL PROOF DATA PROVIDED - Use launch-safe alternatives:\n- Focus on benefit claims and outcomes ("Get X result")\n- Use curiosity hooks ("The method that...")\n- Use contrast ("Before vs After")\n- DO NOT mention customer counts, ratings, or reviews\n- DO NOT fabricate testimonials or statistics`;

          const headlinePrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting ad HEADLINES for this service:\n\nService: ${capturedService.name}\nCategory: ${capturedService.category}\nTarget Market: ${capturedInput.targetMarket}\nProduct Category: ${capturedInput.productCategory}\nSpecific Product Name: ${capturedInput.specificProductName}\nPressing Problem: ${resolvedPressingProblem}\nDesired Outcome: ${resolvedDesiredOutcome}\nUnique Mechanism: ${resolvedUniqueMechanism || 'N/A'}\nKey Benefits: ${capturedInput.listBenefits || 'N/A'}\n\n${socialProofGuidance}\n\n${icpContext}\n\nAd Type: ${adTypeContext}\nAd Style: ${capturedInput.adStyle}\nCall To Action: ${capturedInput.adCallToAction}\n\nCreate ${count} attention-grabbing headlines (max 40 characters each).\n\nFormat as JSON array: { "headlines": ["headline 1", ...] }`;
          const headlineResponse = await invokeLLM({ messages: [{ role: "system", content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.` }, { role: "user", content: headlinePrompt }], response_format: { type: "json_schema", json_schema: { name: "ad_headlines", strict: true, schema: { type: "object", properties: { headlines: { type: "array", items: { type: "string" } } }, required: ["headlines"], additionalProperties: false } } } });
          const headlineContent = headlineResponse.choices[0].message.content;
          if (typeof headlineContent !== "string") throw new Error("Invalid headline response");
          const headlineData = JSON.parse(stripMarkdownJson(headlineContent));

          const { ALL_BODY_ANGLES, BODY_ANGLE_PROMPTS } = await import('../adCopyAngles');
          const selectedAngles = ALL_BODY_ANGLES.slice(0, Math.min(count, 15));
          const bodyPromises = selectedAngles.map(async (angle: string) => {
            const anglePrompt = (BODY_ANGLE_PROMPTS as any)[angle];
            const bodyPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ONE high-converting ad BODY COPY using the ${angle.replace('_', ' ')} angle:\n\nService: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nPressing Problem: ${resolvedPressingProblem}\nDesired Outcome: ${resolvedDesiredOutcome}\nUnique Mechanism: ${resolvedUniqueMechanism || 'N/A'}\n\n${socialProofGuidance}\n\n${icpContext}\n\nAd Type: ${adTypeContext}\nAd Style: ${capturedInput.adStyle}\nCall To Action: ${capturedInput.adCallToAction}\n\n${anglePrompt}\n\nCreate ONE body copy (125-150 words). End with clear call-to-action: ${capturedInput.adCallToAction}\n\nReturn ONLY the body text as a single string, no JSON wrapper.`;
            const r = await invokeLLM({ messages: [{ role: "system", content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants.` }, { role: "user", content: bodyPrompt }] });
            const rawContent = r.choices[0]?.message?.content;
            if (!rawContent) throw new Error(`Empty response for ${angle} angle`);
            const content = typeof rawContent === 'string' ? rawContent.trim() : '';
            return { angle, body: content };
          });
          const bodyResults = await Promise.all(bodyPromises);
          const bodyData = { bodies: bodyResults.map((r: any) => r.body) };

          const linkPrompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting LINK DESCRIPTIONS for this service:\n\nService: ${capturedService.name}\nTarget Market: ${capturedInput.targetMarket}\nDesired Outcome: ${resolvedDesiredOutcome}\nCall To Action: ${capturedInput.adCallToAction}\n\n${icpContext}\n\nAd Type: ${adTypeContext}\nAd Style: ${capturedInput.adStyle}\n\nCreate ${count} clear, action-oriented link descriptions (max 30 characters each).\n\nFormat as JSON array: { "links": ["link 1", ...] }`;
          const linkResponse = await invokeLLM({ messages: [{ role: "system", content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.` }, { role: "user", content: linkPrompt }], response_format: { type: "json_schema", json_schema: { name: "ad_links", strict: true, schema: { type: "object", properties: { links: { type: "array", items: { type: "string" } } }, required: ["links"], additionalProperties: false } } } });
          const linkContent = linkResponse.choices[0].message.content;
          if (typeof linkContent !== "string") throw new Error("Invalid link response");
          const linkData = JSON.parse(stripMarkdownJson(linkContent));

          const allInserts: any[] = [];
          for (const headline of headlineData.headlines) {
            const complianceResult = await checkCompliance(headline, { userId: capturedUserId, generatorType: 'adCopy', trackUsage: true });
            allInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: "headline" as const, content: headline, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: complianceResult.score, complianceVersion: complianceResult.version, complianceCheckedAt: new Date() });
          }
          for (const result of bodyResults) {
            const complianceResult = await checkCompliance((result as any).body, { userId: capturedUserId, generatorType: 'adCopy', trackUsage: true });
            allInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: "body" as const, bodyAngle: (result as any).angle, content: (result as any).body, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: complianceResult.score, complianceVersion: complianceResult.version, complianceCheckedAt: new Date() });
          }
          for (const link of linkData.links) {
            const complianceResult = await checkCompliance(link);
            allInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: "link" as const, content: link, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: complianceResult.score, complianceVersion: complianceResult.version, complianceCheckedAt: new Date() });
          }

          await bgDb.insert(adCopy).values(allInserts);

          await incrementQuotaCount(capturedUserId, "adCopy");

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ adSetId, count: allInserts.length, headlineCount: headlineData.headlines.length, bodyCount: bodyData.bodies.length, linkCount: linkData.links.length }) })
            .where(eq(jobs.id, jobId));
          console.log(`[adCopy.generateAsync] Job ${jobId} completed, adSetId: ${adSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // ── Network-error auto-retry (once, 30-second delay) ─────────────────
          // Only retry on transient network failures — never on Zod/validation errors.
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('AbortError') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network timeout');
          if (isNetworkError) {
            try {
              const checkDb = await getDb();
              const [currentJob] = checkDb ? await checkDb.select().from(jobs).where(eq(jobs.id, jobId)).limit(1) : [];
              const retryCount = (currentJob as any)?.retryCount ?? 0;
              if (retryCount < 1) {
                console.warn(`[adCopy.generateAsync] Job ${jobId} network error (attempt ${retryCount + 1}), retrying in 30s:`, errorMessage);
                if (checkDb) await checkDb.update(jobs).set({ retryCount: retryCount + 1, progress: JSON.stringify({ step: 0, total: 1, label: 'Network hiccup — retrying in 30s…' }) }).where(eq(jobs.id, jobId));
                await new Promise(resolve => setTimeout(resolve, 30_000));
                // Re-run the full generation logic using the same captured closure variables
                setImmediate(async () => {
                  try {
                    const retryDb = await getDb();
                    if (!retryDb) throw new Error('Database not available on retry');
                    const retryIcpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.communicationStyle ? `How they communicate: ${capturedIcp.communicationStyle}` : ''}`.trim() : '';
                    const retrySotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : ''].filter(Boolean) : [];
                    const retrySotContext = retrySotLines.length > 0 ? ['BRAND CONTEXT:', ...retrySotLines].join('\n') : '';
                    const retryResolvedPressingProblem = capturedInput.pressingProblem?.trim() || capturedService.painPoints || '';
                    const retryResolvedDesiredOutcome = capturedInput.desiredOutcome?.trim() || capturedService.mainBenefit || '';
                    const retryResolvedUniqueMechanism = capturedInput.uniqueMechanism?.trim() || capturedService.uniqueMechanismSuggestion || '';
                    const retrySocialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0 };
                    const retrySocialProofGuidance = retrySocialProof.hasCustomers || retrySocialProof.hasRating || retrySocialProof.hasReviews ? `REAL SOCIAL PROOF: ${retrySocialProof.customerCount} customers, ${retrySocialProof.rating} rating, ${retrySocialProof.reviewCount} reviews.` : 'NO SOCIAL PROOF DATA - use benefit claims only.';
                    const retryAdSetId = nanoid();
                    const retryCount = capturedInput.powerMode ? 30 : 15;
                    const retryAdTypeContext = capturedInput.adType === 'lead_gen' ? 'Lead Generation' : 'E-commerce';
                    const retryHeadlinePrompt = `${retrySotContext ? `${retrySotContext}\n\n` : ''}Create ${retryCount} ad headlines for: ${capturedService.name}. Target: ${capturedInput.targetMarket}. Problem: ${retryResolvedPressingProblem}. Outcome: ${retryResolvedDesiredOutcome}. ${retrySocialProofGuidance}\n\nFormat: { "headlines": ["headline 1", ...] }`;
                    const retryHeadlineResp = await invokeLLM({ messages: [{ role: 'system', content: `${META_COMPLIANCE_RULES}\n\nAlways respond with valid JSON.` }, { role: 'user', content: retryHeadlinePrompt }], response_format: { type: 'json_schema', json_schema: { name: 'ad_headlines', strict: true, schema: { type: 'object', properties: { headlines: { type: 'array', items: { type: 'string' } } }, required: ['headlines'], additionalProperties: false } } } });
                    const retryHeadlineContent = retryHeadlineResp.choices[0].message.content;
                    if (typeof retryHeadlineContent !== 'string') throw new Error('Invalid retry headline response');
                    const retryHeadlineData = JSON.parse(stripMarkdownJson(retryHeadlineContent));
                    const { ALL_BODY_ANGLES: RETRY_ANGLES, BODY_ANGLE_PROMPTS: RETRY_ANGLE_PROMPTS } = await import('../adCopyAngles');
                    const retrySelectedAngles = RETRY_ANGLES.slice(0, Math.min(retryCount, 15));
                    const retryBodyResults = await Promise.all(retrySelectedAngles.map(async (angle: string) => {
                      const anglePrompt = (RETRY_ANGLE_PROMPTS as any)[angle];
                      const bp = `Create ONE ad body using ${angle} angle for: ${capturedService.name}. Problem: ${retryResolvedPressingProblem}. Outcome: ${retryResolvedDesiredOutcome}. ${retrySocialProofGuidance}\n\n${retryIcpContext}\n\n${anglePrompt}\n\nReturn ONLY the body text (125-150 words), no JSON.`;
                      const r = await invokeLLM({ messages: [{ role: 'system', content: META_COMPLIANCE_RULES }, { role: 'user', content: bp }] });
                      const rawContent = r.choices[0]?.message?.content;
                      const content = typeof rawContent === 'string' ? rawContent.trim() : (Array.isArray(rawContent) ? '' : String(rawContent || ''));
                      return { angle, body: content };
                    }));
                    const retryLinkPrompt = `Create ${retryCount} ad link descriptions for: ${capturedService.name}. CTA: ${capturedInput.adCallToAction}. Format: { "links": ["link 1", ...] }`;
                    const retryLinkResp = await invokeLLM({ messages: [{ role: 'system', content: `${META_COMPLIANCE_RULES}\n\nAlways respond with valid JSON.` }, { role: 'user', content: retryLinkPrompt }], response_format: { type: 'json_schema', json_schema: { name: 'ad_links', strict: true, schema: { type: 'object', properties: { links: { type: 'array', items: { type: 'string' } } }, required: ['links'], additionalProperties: false } } } });
                    const retryLinkContent = retryLinkResp.choices[0].message.content;
                    if (typeof retryLinkContent !== 'string') throw new Error('Invalid retry link response');
                    const retryLinkData = JSON.parse(stripMarkdownJson(retryLinkContent));
                    const retryInserts: any[] = [];
                    for (const h of retryHeadlineData.headlines) {
                      const cr = await checkCompliance(h, { userId: capturedUserId, generatorType: 'adCopy', trackUsage: false });
                      retryInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId: retryAdSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: 'headline' as const, content: h, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: cr.score, complianceVersion: cr.version, complianceCheckedAt: new Date() });
                    }
                    for (const result of retryBodyResults) {
                      const cr = await checkCompliance(result.body, { userId: capturedUserId, generatorType: 'adCopy', trackUsage: false });
                      retryInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId: retryAdSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: 'body' as const, bodyAngle: result.angle, content: result.body, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: cr.score, complianceVersion: cr.version, complianceCheckedAt: new Date() });
                    }
                    for (const link of retryLinkData.links) {
                      const cr = await checkCompliance(link);
                      retryInserts.push({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, adSetId: retryAdSetId, adType: capturedInput.adType, adStyle: capturedInput.adStyle, adCallToAction: capturedInput.adCallToAction, contentType: 'link' as const, content: link, targetMarket: capturedInput.targetMarket, productCategory: capturedInput.productCategory, specificProductName: capturedInput.specificProductName, pressingProblem: capturedInput.pressingProblem, desiredOutcome: capturedInput.desiredOutcome, uniqueMechanism: capturedInput.uniqueMechanism || null, listBenefits: capturedInput.listBenefits || null, specificTechnology: capturedInput.specificTechnology || null, scientificStudies: capturedInput.scientificStudies || null, credibleAuthority: capturedInput.credibleAuthority || null, featuredIn: capturedInput.featuredIn || null, numberOfReviews: capturedInput.numberOfReviews || null, averageReviewRating: capturedInput.averageReviewRating || null, totalCustomers: capturedInput.totalCustomers || null, testimonials: capturedInput.testimonials || null, complianceScore: cr.score, complianceVersion: cr.version, complianceCheckedAt: new Date() });
                    }
                    if (retryInserts.length > 0) await retryDb.insert(adCopy).values(retryInserts);
                    await retryDb.update(jobs).set({ status: 'complete', result: JSON.stringify({ adSetId: retryAdSetId, count: retryInserts.length }) }).where(eq(jobs.id, jobId));
                    console.log(`[adCopy.generateAsync] Job ${jobId} retry succeeded, adSetId: ${retryAdSetId}`);
                  } catch (retryErr: unknown) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    console.error(`[adCopy.generateAsync] Job ${jobId} retry also failed:`, retryMsg);
                    try { const fd = await getDb(); if (fd) await fd.update(jobs).set({ status: 'failed', error: retryMsg.slice(0, 1024) }).where(eq(jobs.id, jobId)); } catch { /* ignore */ }
                  }
                });
                return; // Don't mark as failed yet — retry is in flight
              }
            } catch { /* if retry setup fails, fall through to permanent failure */ }
          }
          console.error(`[adCopy.generateAsync] Job ${jobId} failed (permanent):`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update ad copy
  update: protectedProcedure
    .input(updateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad copy not found");
      }

      await db
        .update(adCopy)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(adCopy.id, id));

      // Fetch updated ad
      const [updated] = await db
        .select()
        .from(adCopy)
        .where(eq(adCopy.id, id))
        .limit(1);

      return updated;
    }),

  // Regenerate a single ad copy item via AI
  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number(), promptOverride: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await enforceQuota(ctx.user.id, "adCopy");

      // Fetch existing row + verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, input.id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ad copy not found" });
      }

      const overrideInstruction = input.promptOverride?.trim()
        ? ` Additional instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this ${existing.contentType} ad copy. Original text: ${existing.content}.${overrideInstruction} Return only the rewritten text with no explanation, no labels, no quotes.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert ad copywriter. Respond with only the rewritten text." },
          { role: "user", content: prompt },
        ],
      });

      const newContent = response.choices[0].message.content;
      if (typeof newContent !== "string" || !newContent.trim()) {
        throw new Error("Invalid response from AI");
      }

      await db
        .update(adCopy)
        .set({ content: newContent.trim(), updatedAt: new Date() })
        .where(eq(adCopy.id, input.id));

      const [updated] = await db
        .select()
        .from(adCopy)
        .where(eq(adCopy.id, input.id))
        .limit(1);

      return updated;
    }),

  // Delete entire ad set
  deleteAdSet: protectedProcedure
    .input(z.object({ adSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, input.adSetId), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad set not found");
      }

      await db.delete(adCopy).where(eq(adCopy.adSetId, input.adSetId));

      return { success: true };
    }),

  // Get the most recent ad set for a given serviceId (V2 results panel revisit)
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Find the most recent adSetId for this user + service
      const [latest] = await db
        .select({ adSetId: adCopy.adSetId })
        .from(adCopy)
        .where(and(eq(adCopy.userId, ctx.user.id), eq(adCopy.serviceId, input.serviceId)))
        .orderBy(desc(adCopy.createdAt))
        .limit(1);
      if (!latest) return null;
      const ads = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, latest.adSetId), eq(adCopy.userId, ctx.user.id)))
        .orderBy(desc(adCopy.createdAt));
      if (ads.length === 0) return null;
      return {
        adSetId: ads[0].adSetId,
        adType: ads[0].adType,
        serviceId: ads[0].serviceId,
        campaignId: ads[0].campaignId,
        adStyle: ads[0].adStyle,
        adCallToAction: ads[0].adCallToAction,
        targetMarket: ads[0].targetMarket,
        productCategory: ads[0].productCategory,
        specificProductName: ads[0].specificProductName,
        pressingProblem: ads[0].pressingProblem,
        desiredOutcome: ads[0].desiredOutcome,
        createdAt: ads[0].createdAt,
        headlines: ads.filter(a => a.contentType === "headline"),
        bodies:    ads.filter(a => a.contentType === "body"),
        links:     ads.filter(a => a.contentType === "link"),
      };
    }),
});
