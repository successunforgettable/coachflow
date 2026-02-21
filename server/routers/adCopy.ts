import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adCopy, services, campaigns } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { nanoid } from "nanoid";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { checkCompliance } from "../lib/complianceChecker";

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
  serviceId: z.number(),
  campaignId: z.number().optional(),
  adType: z.enum(["lead_gen", "ecommerce"]),
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

      // Get service details
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

      const adSetId = nanoid();
      const count = input.powerMode ? 30 : 15; // Power Mode generates 2x

      const adTypeContext = input.adType === "lead_gen"
        ? "Lead Generation (free webinar, consultation, download)"
        : "E-commerce (direct product sale)";

      // Generate Headlines
      const headlinePrompt = `You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting ad HEADLINES for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Pressing Problem: ${input.pressingProblem}
Desired Outcome: ${input.desiredOutcome}
Unique Mechanism: ${input.uniqueMechanism}

Ad Type: ${adTypeContext}

Create ${count} attention-grabbing headlines (max 40 characters each) that:
- Hook the reader immediately
- Highlight the transformation or benefit
- Create curiosity or urgency
- Are specific and concrete

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
      const headlineData = JSON.parse(headlineContent);

      // Generate Body Copy
      const bodyPrompt = `You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting ad BODY COPY variations for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Pressing Problem: ${input.pressingProblem}
Desired Outcome: ${input.desiredOutcome}
Unique Mechanism: ${input.uniqueMechanism}

Ad Type: ${adTypeContext}

Create ${count} compelling body copy variations (125-150 words each) that:
- Start with a hook related to the pressing problem
- Agitate the pain or desire
- Present the unique mechanism as the solution
- Include social proof or credibility
- End with a clear call-to-action

Format as JSON array:
{
  "bodies": ["body 1", "body 2", ...]
}`;

      const bodyResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `${META_COMPLIANCE_RULES}\n\nYou are an expert ad copywriter who specializes in Meta-compliant advertising for coaches, speakers and consultants. Always respond with valid JSON.`,
          },
          { role: "user", content: bodyPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ad_bodies",
            strict: true,
            schema: {
              type: "object",
              properties: {
                bodies: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["bodies"],
              additionalProperties: false,
            },
          },
        },
      });

      const bodyContent = bodyResponse.choices[0].message.content;
      if (typeof bodyContent !== "string") {
        throw new Error("Invalid body response");
      }
      const bodyData = JSON.parse(bodyContent);

      // Generate Link Descriptions
      const linkPrompt = `You are an expert Facebook/Instagram ad copywriter. Create ${count} high-converting LINK DESCRIPTIONS for this service:

Service: ${service.name}
Category: ${service.category}
Target Market: ${input.targetMarket}
Desired Outcome: ${input.desiredOutcome}

Ad Type: ${adTypeContext}

Create ${count} clear, action-oriented link descriptions (max 30 characters each) that:
- State the clear next step
- Create urgency or excitement
- Are benefit-focused

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
      const linkData = JSON.parse(linkContent);

      // Save all variations to database
      const allInserts = [];

      // Insert headlines
      for (const headline of headlineData.headlines) {
        const complianceResult = await checkCompliance(headline);
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

      // Insert bodies
      for (const body of bodyData.bodies) {
        const complianceResult = await checkCompliance(body);
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          adStyle: input.adStyle,
          adCallToAction: input.adCallToAction,
          contentType: "body" as const,
          content: body,
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

      return {
        adSetId,
        count: allInserts.length,
        headlineCount: headlineData.headlines.length,
        bodyCount: bodyData.bodies.length,
        linkCount: linkData.links.length,
      };
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
});
