import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { whatsappSequences, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const generateWhatsAppSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["engagement", "sales"]),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
});

const updateWhatsAppSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  messages: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const whatsappSequencesRouter = router({
  // List all WhatsApp sequences for current user
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

      const conditions = [eq(whatsappSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(whatsappSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(whatsappSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(whatsappSequences)
        .where(and(...conditions))
        .orderBy(desc(whatsappSequences.createdAt));
    }),

  // Get single WhatsApp sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("WhatsApp sequence not found");
      }

      return sequence;
    }),

  // Generate WhatsApp sequence using AI (Helo.ai framework)
  generate: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
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

      let prompt = "";

      if (input.sequenceType === "engagement") {
        prompt = `You are an expert WhatsApp marketer. Create a 3-message WhatsApp engagement sequence for event attendees using Helo.ai's 7-Strategy Framework.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Host: ${input.eventDetails?.hostName || "Host"}
Event Date: ${input.eventDetails?.eventDate || "Date"}

Create 3 WhatsApp messages (Monday, Wednesday, Friday before event):
1. WELCOME & EXPECTATION SETTING (Monday) - Personal welcome, what to expect
2. EDUCATIONAL CONTENT (Wednesday) - Share valuable tip, build trust
3. URGENCY & REMINDER (Friday) - Event reminder, create urgency

Each message should:
- Be personal and conversational (98%+ open rate on WhatsApp)
- Use emojis appropriately (cultural sensitivity for UAE/India/Malaysia)
- Be 50-100 words (short and scannable)
- Include clear CTA
- Use second-person POV ("you" not "we")
- Be grade 4 language level

Format as JSON array.`;
      } else {
        // sales sequence
        prompt = `You are an expert WhatsApp marketer. Create a 3-message WhatsApp sales sequence for event attendees using Helo.ai's framework.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Offer: ${input.eventDetails?.offerName || "Offer"}
Price: ${input.eventDetails?.price || "Price"}

Create 3 WhatsApp messages (Day 1, 3, 5 after event):
1. EXCLUSIVE OFFER (Day 1) - Thank you, exclusive offer for attendees
2. SUCCESS STORY (Day 3) - Social proof, case study, testimonial
3. FINAL CALL (Day 5) - Scarcity, urgency, deadline

Each message should:
- Be personal and conversational (98%+ open rate on WhatsApp)
- Use emojis appropriately (cultural sensitivity for UAE/India/Malaysia)
- Be 50-100 words (short and scannable)
- Include clear CTA
- Use second-person POV ("you" not "we")
- Be grade 4 language level
- Include scarcity/urgency elements (+12% CVR)

Format as JSON array.`;
      }

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert WhatsApp marketer specializing in high-converting WhatsApp sequences for coaches, speakers, and consultants. Use Helo.ai's 7-Strategy Framework. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "whatsapp_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                messages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer" },
                      message: { type: "string" },
                      cta: { type: "string" },
                    },
                    required: ["day", "message", "cta"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["messages"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }
      const sequenceData = JSON.parse(content);

      // Save to database
      const insertResult: any = await db.insert(whatsappSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        messages: sequenceData.messages,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, insertResult[0].insertId))
        .limit(1);

      return newSequence;
    }),

  // Update WhatsApp sequence
  update: protectedProcedure
    .input(updateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .update(whatsappSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(whatsappSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Delete WhatsApp sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .delete(whatsappSequences)
        .where(eq(whatsappSequences.id, input.id));

      return { success: true };
    }),
});
