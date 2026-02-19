import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailSequences, services, campaigns } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateEmailSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["welcome", "engagement", "sales"]),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      deadline: z.string().optional(),
    })
    .optional(),
});

const updateEmailSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  emails: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const emailSequencesRouter = router({
  // List all email sequences for current user
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

      const conditions = [eq(emailSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(emailSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(emailSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(emailSequences)
        .where(and(...conditions))
        .orderBy(desc(emailSequences.createdAt));
    }),

  // Get single email sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("Email sequence not found");
      }

      return sequence;
    }),

  // Generate email sequence using AI (Russell Brunson Soap Opera Sequence)
  generate: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "email");
        if (ctx.user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.`,
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

      let prompt = "";

      if (input.sequenceType === "welcome") {
        prompt = `You are an expert email marketer. Create a 3-email welcome sequence for new subscribers using Russell Brunson's Soap Opera Sequence framework.

Service: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Create 3 emails:
1. SET THE STAGE (Day 1) - Welcome, set expectations, introduce yourself
2. EPIPHANY (Day 3) - Share your transformation story, introduce solution
3. HIDDEN BENEFITS (Day 5) - Show secondary benefits, soft CTA

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (200-300 words, conversational tone, grade 4 language)
- CTA (clear next step)

Format as JSON array.`;
      } else if (input.sequenceType === "engagement") {
        prompt = `You are an expert email marketer. Create a 5-email engagement sequence for event attendees using Russell Brunson's Soap Opera Sequence.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Host: ${input.eventDetails?.hostName || "Host"}

Create 5 emails (Monday to Friday before event):
1. SET THE STAGE (Monday) - Introduce, set expectations
2. OPEN WITH HIGH DRAMA (Tuesday) - Tell your biggest problem
3. EPIPHANY (Wednesday) - Reveal solution, promote event
4. HIDDEN BENEFITS (Thursday) - Show secondary benefits
5. URGENCY & CTA (Friday) - Create scarcity, final push

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (200-300 words, conversational tone, grade 4 language)
- CTA (clear next step)

Format as JSON array.`;
      } else {
        // sales sequence
        prompt = `You are an expert email marketer. Create a 7-email sales sequence for event attendees who didn't buy.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Offer: ${input.eventDetails?.offerName || "Offer"}
Price: ${input.eventDetails?.price || "Price"}
Deadline: ${input.eventDetails?.deadline || "Deadline"}

Create 7 emails (Day 1-7 after event):
1. THANK YOU (Day 1) - Gratitude, recap key points
2. CASE STUDY (Day 2) - Success story, social proof
3. OBJECTION HANDLING (Day 3) - Address common objections
4. BONUS REVEAL (Day 4) - Exclusive bonuses
5. GUARANTEE (Day 5) - Risk reversal, guarantee
6. SCARCITY (Day 6) - Limited spots, urgency
7. FINAL CALL (Day 7) - Last chance, deadline

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (250-350 words, conversational tone, grade 4 language)
- CTA (clear next step)

Format as JSON array.`;
      }

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                emails: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer" },
                      subject: { type: "string" },
                      previewText: { type: "string" },
                      body: { type: "string" },
                      cta: { type: "string" },
                    },
                    required: ["day", "subject", "previewText", "body", "cta"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["emails"],
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
      const insertResult: any = await db.insert(emailSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        emails: sequenceData.emails,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, insertResult[0].insertId))
        .limit(1);

      return newSequence;
    }),

  // Update email sequence
  update: protectedProcedure
    .input(updateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .update(emailSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(emailSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Delete email sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .delete(emailSequences)
        .where(eq(emailSequences.id, input.id));

      return { success: true };
    }),
});
