import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { offers, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const generateOfferSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  offerType: z.enum(["standard", "premium", "vip"]),
  price: z.string(),
});

const updateOfferSchema = z.object({
  id: z.number(),
  headline: z.string().optional(),
  whatIncluded: z.array(z.string()).optional(),
  bonuses: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  guarantee: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const offersRouter = router({
  // List all offers for current user
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

      const conditions = [eq(offers.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(offers.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(offers.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(offers)
        .where(and(...conditions))
        .orderBy(desc(offers.createdAt));
    }),

  // Get single offer by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [offer] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!offer) {
        throw new Error("Offer not found");
      }

      return offer;
    }),

  // Generate offer using AI (Godfather Offer framework)
  generate: protectedProcedure
    .input(generateOfferSchema)
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

      const offerTypeInstructions = {
        standard: "Entry-level offer with core benefits, good value",
        premium: "Mid-tier offer with additional bonuses, better value",
        vip: "High-ticket offer with maximum value, exclusive access, premium bonuses",
      };

      const prompt = `You are an expert offer creator. Create an irresistible "${input.offerType.toUpperCase()}" offer for this service using the Godfather Offer framework (an offer so good they can't refuse).

Service: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Price: ${input.price}

Offer Type: ${offerTypeInstructions[input.offerType]}

Create a complete offer with:
1. OFFER NAME (5-10 words, compelling and benefit-focused)
2. MAIN PROMISE (20-30 words, specific transformation)
3. CORE DELIVERABLES (3-5 items, what they get)
4. BONUSES (3-5 bonuses, high perceived value)
5. GUARANTEE (50-75 words, risk reversal, specific)
6. SCARCITY (limited spots, deadline, or exclusivity)
7. TOTAL VALUE (breakdown showing value vs price)
8. CTA (clear next step)

Format as JSON with these exact keys.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert offer creator specializing in irresistible offers for coaches, speakers, and consultants. Use the Godfather Offer framework. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "godfather_offer",
            strict: true,
            schema: {
              type: "object",
              properties: {
                offerName: { type: "string" },
                mainPromise: { type: "string" },
                coreDeliverables: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      value: { type: "string" },
                    },
                    required: ["title", "description", "value"],
                    additionalProperties: false,
                  },
                },
                bonuses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      value: { type: "string" },
                    },
                    required: ["title", "description", "value"],
                    additionalProperties: false,
                  },
                },
                guarantee: { type: "string" },
                scarcity: { type: "string" },
                totalValue: {
                  type: "object",
                  properties: {
                    breakdown: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          value: { type: "string" },
                        },
                        required: ["item", "value"],
                        additionalProperties: false,
                      },
                    },
                    total: { type: "string" },
                    price: { type: "string" },
                    savings: { type: "string" },
                  },
                  required: ["breakdown", "total", "price", "savings"],
                  additionalProperties: false,
                },
                cta: { type: "string" },
              },
              required: [
                "offerName",
                "mainPromise",
                "coreDeliverables",
                "bonuses",
                "guarantee",
                "scarcity",
                "totalValue",
                "cta",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }
      const offerData = JSON.parse(content);

      // Save to database
      const insertResult: any = await db.insert(offers).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        offerType: input.offerType,
        headline: offerData.offerName,
        whatIncluded: offerData.coreDeliverables.map((d: any) => `${d.title}: ${d.description}`),
        bonuses: offerData.bonuses.map((b: any) => ({ name: b.title, value: b.value })),
        guarantee: offerData.guarantee,
        price: input.price,
      });

      // Fetch the created offer
      const [newOffer] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, insertResult[0].insertId))
        .limit(1);

      return newOffer;
    }),

  // Update offer
  update: protectedProcedure
    .input(updateOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new Error("Offer not found");
      }

      await db
        .update(offers)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(offers.id, id));

      // Fetch updated offer
      const [updated] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, id))
        .limit(1);

      return updated;
    }),

  // Delete offer
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new Error("Offer not found");
      }

      await db.delete(offers).where(eq(offers.id, input.id));

      return { success: true };
    }),
});
