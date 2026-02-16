import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const generateICPSchema = z.object({
  serviceId: z.number(),
  name: z.string().min(1).max(255),
});

const updateICPSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  demographics: z.any().optional(),
  painPoints: z.string().optional(),
  desiredOutcomes: z.string().optional(),
  valuesMotivations: z.string().optional(),
  buyingTriggers: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const icpsRouter = router({
  // List all ICPs for current user
  list: protectedProcedure
    .input(z.object({ serviceId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(idealCustomerProfiles.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(idealCustomerProfiles.serviceId, input.serviceId));
      }

      return await db
        .select()
        .from(idealCustomerProfiles)
        .where(and(...conditions))
        .orderBy(desc(idealCustomerProfiles.createdAt));
    }),

  // Get single ICP by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [icp] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, input.id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!icp) {
        throw new Error("ICP not found");
      }

      return icp;
    }),

  // Generate ICP using AI
  generate: protectedProcedure
    .input(generateICPSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get service details
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // Generate ICP using AI
      const prompt = `You are an expert marketing strategist. Create a detailed Ideal Customer Profile (ICP) for the following service:

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Generate a comprehensive ICP with the following sections:

1. DEMOGRAPHICS (return as JSON object with keys: age_range, gender, income_level, education, occupation, location, family_status)
2. PAIN POINTS (detailed list of 5-7 specific pain points they experience)
3. DESIRED OUTCOMES (what they want to achieve, 4-6 specific goals)
4. VALUES & MOTIVATIONS (what drives them, their core values, 4-5 points)
5. BUYING TRIGGERS (what makes them ready to buy, 4-5 specific triggers)

Format your response as JSON with these exact keys:
{
  "demographics": { ... },
  "painPoints": "• Point 1\\n• Point 2\\n...",
  "desiredOutcomes": "• Outcome 1\\n• Outcome 2\\n...",
  "valuesMotivations": "• Value 1\\n• Value 2\\n...",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n..."
}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert marketing strategist specializing in creating detailed customer profiles for coaches, speakers, and consultants. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ideal_customer_profile",
            strict: true,
            schema: {
              type: "object",
              properties: {
                demographics: {
                  type: "object",
                  properties: {
                    age_range: { type: "string" },
                    gender: { type: "string" },
                    income_level: { type: "string" },
                    education: { type: "string" },
                    occupation: { type: "string" },
                    location: { type: "string" },
                    family_status: { type: "string" },
                  },
                  required: [
                    "age_range",
                    "gender",
                    "income_level",
                    "education",
                    "occupation",
                    "location",
                    "family_status",
                  ],
                  additionalProperties: false,
                },
                painPoints: { type: "string" },
                desiredOutcomes: { type: "string" },
                valuesMotivations: { type: "string" },
                buyingTriggers: { type: "string" },
              },
              required: [
                "demographics",
                "painPoints",
                "desiredOutcomes",
                "valuesMotivations",
                "buyingTriggers",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== 'string') {
        throw new Error('Invalid response format from AI');
      }
      const icpData = JSON.parse(content);

      // Save to database
      const insertResult: any = await db
        .insert(idealCustomerProfiles)
        .values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          name: input.name,
          demographics: icpData.demographics,
          painPoints: icpData.painPoints,
          desiredOutcomes: icpData.desiredOutcomes,
          valuesMotivations: icpData.valuesMotivations,
          buyingTriggers: icpData.buyingTriggers,
        });

      // Fetch the created ICP
      const [newICP] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, insertResult[0].insertId))
        .limit(1);

      return newICP;
    }),

  // Update ICP
  update: protectedProcedure
    .input(updateICPSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("ICP not found");
      }

      await db
        .update(idealCustomerProfiles)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(idealCustomerProfiles.id, id));

      // Fetch updated ICP
      const [updated] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, id))
        .limit(1);

      return updated;
    }),

  // Delete ICP
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, input.id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("ICP not found");
      }

      await db
        .delete(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, input.id));

      return { success: true };
    }),
});
