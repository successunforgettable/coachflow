import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getHeadlinesByUserId,
  getHeadlinesBySetId,
  updateHeadlineRating,
  deleteHeadlineSet,
} from "../db";
import { getDb } from "../db";
import { jobs, headlines } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { invokeLLM } from "../_core/llm";

// Helper to strip markdown code blocks from LLM responses

export const headlinesRouter = router({
  // List all headline sets for current user
  list: protectedProcedure
    .input(z.object({ serviceId: z.number() }).optional())
    .query(async ({ ctx, input }) => {
    const allHeadlines = await getHeadlinesByUserId(ctx.user.id);

    // Group by headlineSetId
    const sets = new Map<string, any>();
    allHeadlines.forEach((headline) => {
      if (!sets.has(headline.headlineSetId)) {
        sets.set(headline.headlineSetId, {
          headlineSetId: headline.headlineSetId,
          serviceId: headline.serviceId,
          targetMarket: headline.targetMarket,
          pressingProblem: headline.pressingProblem,
          desiredOutcome: headline.desiredOutcome,
          createdAt: headline.createdAt,
          count: 0,
        });
      }
      const set = sets.get(headline.headlineSetId)!;
      set.count += 1;
    });

    const sorted = Array.from(sets.values()).sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );
    if (input?.serviceId == null) return sorted;
    return sorted.filter((s: any) => s.serviceId === input.serviceId);
  }),

  // Get single headline by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [headline] = await db
        .select()
        .from(headlines)
        .where(
          and(eq(headlines.id, input.id), eq(headlines.userId, ctx.user.id))
        )
        .limit(1);

      if (!headline) {
        throw new Error("Headline not found");
      }

      return headline;
    }),

  // Get all headlines in a set
  getBySetId: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await getHeadlinesBySetId(input.headlineSetId, ctx.user.id);

      if (rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Headline set not found",
        });
      }

      // Normalise violationReasons from Drizzle's `unknown` JSON to
      // `string[] | null` so the type flows end-to-end (client doesn't
      // need to cast). Anything unexpected becomes null.
      const normalised = rows.map(r => ({
        ...r,
        violationReasons:
          Array.isArray((r as { violationReasons?: unknown }).violationReasons)
            ? ((r as { violationReasons?: unknown[] }).violationReasons ?? []).filter((v): v is string => typeof v === "string")
            : null,
      }));

      // Group by formula type
      const grouped = {
        story:     normalised.filter(h => h.formulaType === "story"),
        eyebrow:   normalised.filter(h => h.formulaType === "eyebrow"),
        question:  normalised.filter(h => h.formulaType === "question"),
        authority: normalised.filter(h => h.formulaType === "authority"),
        urgency:   normalised.filter(h => h.formulaType === "urgency"),
      };

      return {
        headlineSetId: input.headlineSetId,
        headlines: grouped,
        metadata: {
          serviceId: normalised[0].serviceId,
          targetMarket: normalised[0].targetMarket,
          pressingProblem: normalised[0].pressingProblem,
          desiredOutcome: normalised[0].desiredOutcome,
          uniqueMechanism: normalised[0].uniqueMechanism,
          createdAt: normalised[0].createdAt,
        },
      };
    }),

  // Generate new headline set (25 headlines: 5 per formula type, or 75 with Power Mode)
  // Auto Mode Phase B1: thin wrapper around runHeadlinesGeneration.
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string(),
        desiredOutcome: z.string(),
        uniqueMechanism: z.string(),
        powerMode: z.boolean().optional(),
        headlineStyle: z.enum(["story", "eyebrow", "question", "authority", "urgency"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      if (ctx.user.role !== "superuser") {
        const maxHeadlines = ctx.user.subscriptionTier === "agency" ? 20 : 6;
        if (ctx.user.headlineGeneratedCount >= maxHeadlines) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${maxHeadlines} headline sets. Upgrade to generate more.`,
          });
        }
      }

      return await runHeadlinesGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        targetMarket: input.targetMarket,
        pressingProblem: input.pressingProblem,
        desiredOutcome: input.desiredOutcome,
        uniqueMechanism: input.uniqueMechanism,
        powerMode: input.powerMode,
        headlineStyle: input.headlineStyle,
        userSubscriptionTier: ctx.user.subscriptionTier ?? null,
        userRole: ctx.user.role ?? null,
      });
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; headline generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runHeadlinesGeneration.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number().optional(),
      campaignId: z.number().optional(),
      targetMarket: z.string().max(5000),
      pressingProblem: z.string(),
      desiredOutcome: z.string(),
      uniqueMechanism: z.string(),
      powerMode: z.boolean().optional(),
      headlineStyle: z.enum(["story", "eyebrow", "question", "authority", "urgency"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const maxHeadlines = user.subscriptionTier === "agency" ? 50 : user.subscriptionTier === "pro" ? 20 : 6;
        if (user.headlineGeneratedCount >= maxHeadlines) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${maxHeadlines} headline sets. Upgrade to generate more.` });
        }
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedUserTier = user.subscriptionTier ?? null;
      const capturedUserRole = user.role ?? null;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const result = await runHeadlinesGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            targetMarket: capturedInput.targetMarket,
            pressingProblem: capturedInput.pressingProblem,
            desiredOutcome: capturedInput.desiredOutcome,
            uniqueMechanism: capturedInput.uniqueMechanism,
            powerMode: capturedInput.powerMode,
            headlineStyle: capturedInput.headlineStyle,
            userSubscriptionTier: capturedUserTier,
            userRole: capturedUserRole,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[headlines.generateAsync] Job ${jobId} completed, headlineSetId: ${result.headlineSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[headlines.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Rate a headline
  rate: protectedProcedure
    .input(
      z.object({
        headlineId: z.number(),
        rating: z.number().min(-1).max(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHeadlineRating(input.headlineId, ctx.user.id, input.rating);
      return { success: true };
    }),

  // Delete headline set
  delete: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHeadlineSet(input.headlineSetId, ctx.user.id);
      return { success: true };
    }),

  /**
   * listForServiceId — flat, compliance-filtered list of the campaign's Node 6
   * headlines, sorted by selectionScore desc. Used by V2AdImageCreator's edit
   * panel so users pick from compliant headlines instead of typing freeform.
   * Ownership is enforced by userId in the WHERE clause.
   * Strict gate: only rows with an explicit compliance score >= 70 (Mostly
   * Compliant or better per getComplianceLabel). NULL scores are pre-scoring
   * legacy and must not be picker-visible — user evidence confirmed zero such
   * rows are currently reachable, so this is defensive for future imports only.
   */
  listForServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { headlines: headlinesTable } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const rows = await db
        .select({
          id:              headlinesTable.id,
          text:            headlinesTable.headline,
          formulaType:     headlinesTable.formulaType,
          selectionScore:  headlinesTable.selectionScore,
          complianceScore: headlinesTable.complianceScore,
        })
        .from(headlinesTable)
        .where(and(
          eq(headlinesTable.userId, ctx.user.id),
          eq(headlinesTable.serviceId, input.serviceId),
        ))
        .orderBy(desc(headlinesTable.selectionScore));
      return rows.filter(r => r.complianceScore !== null && r.complianceScore >= 70);
    }),

  // Get the most recent headline set for a given serviceId (V2 results panel revisit)
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { headlines: headlinesTable } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const [latest] = await db
        .select({ headlineSetId: headlinesTable.headlineSetId })
        .from(headlinesTable)
        .where(and(eq(headlinesTable.userId, ctx.user.id), eq(headlinesTable.serviceId, input.serviceId)))
        .orderBy(desc(headlinesTable.createdAt))
        .limit(1);
      if (!latest) return null;
      const rows = await getHeadlinesBySetId(latest.headlineSetId, ctx.user.id);
      if (rows.length === 0) return null;
      const grouped = {
        story:     rows.filter(h => h.formulaType === "story"),
        eyebrow:   rows.filter(h => h.formulaType === "eyebrow"),
        question:  rows.filter(h => h.formulaType === "question"),
        authority: rows.filter(h => h.formulaType === "authority"),
        urgency:   rows.filter(h => h.formulaType === "urgency"),
      };
      return {
        headlineSetId: latest.headlineSetId,
        headlines: grouped,
        metadata: {
          serviceId: rows[0].serviceId,
          targetMarket: rows[0].targetMarket,
          pressingProblem: rows[0].pressingProblem,
          desiredOutcome: rows[0].desiredOutcome,
          uniqueMechanism: rows[0].uniqueMechanism,
          createdAt: rows[0].createdAt,
        },
      };
    }),

  regenerateSingle: protectedProcedure
    .input(z.object({
      id: z.number(),
      promptOverride: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [row] = await db
        .select()
        .from(headlines)
        .where(and(eq(headlines.id, input.id), eq(headlines.userId, ctx.user.id)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Headline not found" });

      const userInstruction = input.promptOverride?.trim()
        ? ` User instruction: ${input.promptOverride.trim()}.`
        : "";

      const hasSubheadline = row.formulaType === "eyebrow" || row.formulaType === "authority";
      const currentText = hasSubheadline && row.subheadline
        ? `Headline: ${row.headline}\nSubheadline: ${row.subheadline}`
        : row.headline;

      const formatInstruction = hasSubheadline
        ? `Return ONLY valid JSON: {"headline":"...","subheadline":"..."} — no markdown, no explanation.`
        : `Return ONLY the rewritten headline text. No JSON, no markdown, no explanation.`;

      const prompt = `Rewrite this ${row.formulaType} headline for a coaching/consulting offer. Current value: ${currentText}.${userInstruction} ${formatInstruction}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct-response copywriter for high-ticket coaching offers." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

      let newHeadline: string;
      let newSubheadline: string | null = null;

      if (hasSubheadline) {
        try {
          const parsed = JSON.parse(cleaned);
          newHeadline = parsed.headline || cleaned;
          newSubheadline = parsed.subheadline || null;
        } catch {
          newHeadline = cleaned;
        }
      } else {
        newHeadline = cleaned;
      }

      await db
        .update(headlines)
        .set({ headline: newHeadline, subheadline: newSubheadline, updatedAt: new Date() })
        .where(eq(headlines.id, input.id));

      return { headline: newHeadline, subheadline: newSubheadline };
    }),
});
