import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailSequences, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runEmailSequenceGeneration } from "../emailSequenceGenerator";
import { invokeLLM } from "../_core/llm";

// ---------------------------------------------------------------------------

const generateEmailSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum([
    "welcome", "engagement", "sales", "nurture", "launch", "re-engagement",
    // Workstream commit 3b — 4 new types matching DB migration 0068.
    "discovery_call_confirmation", "discovery_call_reminder",
    "event_logistics", "replay_for_no_shows",
  ]),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      deadline: z.string().optional(),
      // Workstream commit 2 — additive optional fields enabling downstream
      // sequence-type expansions (commits 3-5). All optional + string-typed,
      // backward-compatible: existing callsites that don't pass them get
      // undefined and the existing prompt-builder fallbacks ([INSERT_*]
      // operator placeholders or empty-string skips) handle the absence.
      // Pre-existing email-vs-WhatsApp drift on `deadline` field stays as-is
      // (out of scope for this commit, registered backlog).
      eventTime: z.string().optional(),       // "3:00 PM"
      eventTimezone: z.string().optional(),   // "GMT" / "London time" / "PT"
      eventVenue: z.string().optional(),      // for in_person_event
      eventAgenda: z.string().optional(),     // also useful for webinar pre-event emails
      eventDuration: z.string().optional(),   // "60 minutes" / "2 hours"
      replayUrl: z.string().optional(),       // enables future replay_for_no_shows email type
      bookingUrl: z.string().optional(),      // enables discovery_call campaign type
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
  // Auto Mode Phase B1: thin wrapper around runEmailSequenceGeneration.
  // No async-prompt drift — both sync + async use shared builders unchanged.
  generate: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      if (ctx.user.role !== "superuser") {
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "email");
        if (ctx.user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.`,
          });
        }
      }

      const { id } = await runEmailSequenceGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        sequenceType: input.sequenceType,
        name: input.name,
        eventDetails: input.eventDetails,
      });

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [newSequence] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, id))
        .limit(1);

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; email sequence generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runEmailSequenceGeneration.
   */
  generateAsync: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "email");
        if (user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.` });
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
          const result = await runEmailSequenceGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            sequenceType: capturedInput.sequenceType,
            name: capturedInput.name,
            eventDetails: capturedInput.eventDetails,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[emailSequences.generateAsync] Job ${jobId} completed, id: ${result.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[emailSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
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

  regenerateSingle: protectedProcedure
    .input(z.object({
      id: z.number(),
      index: z.number().int().min(0),
      promptOverride: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [row] = await db
        .select()
        .from(emailSequences)
        .where(and(eq(emailSequences.id, input.id), eq(emailSequences.userId, ctx.user.id)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Email sequence not found" });

      const emails: Array<{ day: number; subject: string; body: string; timing: string }> =
        typeof row.emails === "string" ? JSON.parse(row.emails) : (row.emails as any) ?? [];

      if (input.index >= emails.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Index ${input.index} out of range (${emails.length} emails)` });
      }

      const email = emails[input.index];
      const userInstruction = input.promptOverride?.trim()
        ? ` User instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this email (email #${input.index + 1} in a ${row.sequenceType || "marketing"} sequence). Current subject: ${email.subject}. Current body: ${email.body}.${userInstruction} Return ONLY valid JSON: {"subject":"...","body":"..."} — no markdown, no explanation.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct-response email copywriter for high-ticket coaching offers." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

      let newSubject: string;
      let newBody: string;
      try {
        const parsed = JSON.parse(cleaned);
        newSubject = parsed.subject || email.subject;
        newBody = parsed.body || email.body;
      } catch {
        newSubject = email.subject;
        newBody = cleaned;
      }

      emails[input.index] = { ...email, subject: newSubject, body: newBody };

      await db
        .update(emailSequences)
        .set({ emails: JSON.stringify(emails) })
        .where(eq(emailSequences.id, input.id));

      return { subject: newSubject, body: newBody };
    }),
});
