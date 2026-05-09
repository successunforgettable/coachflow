import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { whatsappSequences, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runWhatsappSequenceGeneration } from "../whatsappSequenceGenerator";

const generateWhatsAppSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum([
    "engagement", "sales",
    // Workstream commit 4b — 4 new types matching DB migration 0069.
    "discovery_call_confirmation", "discovery_call_reminder",
    "nurture", "event_logistics",
  ]),
  name: z.string().min(1).max(255),
  // Length × tone (commit 2 of WhatsApp wire sprint).
  // Optional with defaults so callsites that omit them get the
  // canonical pre-wire behavior (length=3, tone=conversational).
  tone: z.enum(["conversational", "professional", "urgent"]).optional().default("conversational"),
  sequenceLength: z.union([z.literal(3), z.literal(5), z.literal(7)]).optional().default(3),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      // Workstream commit 2 — additive optional fields enabling downstream
      // sequence-type expansions (commits 3-5). Mirror of the emailSequences
      // extension. Pre-existing email-vs-WhatsApp drift on `deadline` field
      // (email has it, WhatsApp doesn't) stays as-is — out of scope here,
      // registered backlog.
      eventTime: z.string().optional(),       // "3:00 PM"
      eventTimezone: z.string().optional(),   // "GMT" / "London time" / "PT"
      eventVenue: z.string().optional(),      // for in_person_event
      eventAgenda: z.string().optional(),     // also useful for webinar pre-event reminders
      eventDuration: z.string().optional(),   // "60 minutes" / "2 hours"
      replayUrl: z.string().optional(),       // enables future replay_for_no_shows variants
      bookingUrl: z.string().optional(),      // enables discovery_call campaign type
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

  // Generate WhatsApp sequence using AI
  // Auto Mode Phase B1: thin wrapper around runWhatsappSequenceGeneration.
  // No async-prompt drift — both sync + async use shared builders unchanged.
  generate: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      if (ctx.user.role !== "superuser") {
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "whatsapp");
        if (ctx.user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.`,
          });
        }
      }

      const { id } = await runWhatsappSequenceGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        sequenceType: input.sequenceType,
        name: input.name,
        tone: input.tone,
        sequenceLength: input.sequenceLength,
        eventDetails: input.eventDetails,
      });

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [newSequence] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, id))
        .limit(1);

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; WhatsApp sequence generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runWhatsappSequenceGeneration.
   */
  generateAsync: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "whatsapp");
        if (user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.` });
        }
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = user.id;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const result = await runWhatsappSequenceGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            sequenceType: capturedInput.sequenceType,
            name: capturedInput.name,
            tone: capturedInput.tone,
            sequenceLength: capturedInput.sequenceLength,
            eventDetails: capturedInput.eventDetails,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[whatsappSequences.generateAsync] Job ${jobId} completed, id: ${result.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[whatsappSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
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
