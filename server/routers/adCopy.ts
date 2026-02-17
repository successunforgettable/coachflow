import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adCopy, services, campaigns } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { nanoid } from "nanoid";

const generateAdCopySchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  adType: z.enum(["lead_gen", "ecommerce"]),
  targetMarket: z.string(),
  pressingProblem: z.string(),
  desiredOutcome: z.string(),
  uniqueMechanism: z.string(),
  beastMode: z.boolean().optional(),
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
            targetMarket: ad.targetMarket,
            pressingProblem: ad.pressingProblem,
            desiredOutcome: ad.desiredOutcome,
            uniqueMechanism: ad.uniqueMechanism,
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
        targetMarket: ads[0].targetMarket,
        pressingProblem: ads[0].pressingProblem,
        desiredOutcome: ads[0].desiredOutcome,
        uniqueMechanism: ads[0].uniqueMechanism,
        createdAt: ads[0].createdAt,
        headlines: ads.filter(a => a.contentType === "headline"),
        bodies: ads.filter(a => a.contentType === "body"),
        links: ads.filter(a => a.contentType === "link"),
      };

      return adSet;
    }),

  // Generate ad copy using AI (Kong parity: 15 headlines, 15 bodies, 15 links)
  generate: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

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
      const count = input.beastMode ? 30 : 15; // Beast Mode generates 2x

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
            content: "You are an expert ad copywriter. Always respond with valid JSON.",
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
            content: "You are an expert ad copywriter. Always respond with valid JSON.",
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
            content: "You are an expert ad copywriter. Always respond with valid JSON.",
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
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          contentType: "headline" as const,
          content: headline,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism,
        });
      }

      // Insert bodies
      for (const body of bodyData.bodies) {
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          contentType: "body" as const,
          content: body,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism,
        });
      }

      // Insert links
      for (const link of linkData.links) {
        allInserts.push({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adSetId,
          adType: input.adType,
          contentType: "link" as const,
          content: link,
          targetMarket: input.targetMarket,
          pressingProblem: input.pressingProblem,
          desiredOutcome: input.desiredOutcome,
          uniqueMechanism: input.uniqueMechanism,
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
