import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { bannedPhrases, complianceVersions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

export const complianceRouter = router({
  // Get all banned phrases
  listPhrases: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const phrases = await db.select().from(bannedPhrases).orderBy(bannedPhrases.category, bannedPhrases.phrase);
    return phrases;
  }),

  // Get current compliance version
  getVersion: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const [version] = await db.select().from(complianceVersions).orderBy(complianceVersions.id).limit(1);
    return version || null;
  }),

  // Add new banned phrase
  addPhrase: adminProcedure
    .input(
      z.object({
        phrase: z.string().min(1).max(255),
        category: z.enum(["critical", "warning"]),
        description: z.string().optional(),
        suggestion: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [result] = await db.insert(bannedPhrases).values({
        phrase: input.phrase.toLowerCase(),
        category: input.category,
        description: input.description || null,
        suggestion: input.suggestion || null,
        active: true,
      });

      return { success: true, id: result.insertId };
    }),

  // Update banned phrase
  updatePhrase: adminProcedure
    .input(
      z.object({
        id: z.number(),
        phrase: z.string().min(1).max(255),
        category: z.enum(["critical", "warning"]),
        description: z.string().optional(),
        suggestion: z.string().optional(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .update(bannedPhrases)
        .set({
          phrase: input.phrase.toLowerCase(),
          category: input.category,
          description: input.description || null,
          suggestion: input.suggestion || null,
          active: input.active,
          updatedAt: new Date(),
        })
        .where(eq(bannedPhrases.id, input.id));

      return { success: true };
    }),

  // Delete banned phrase
  deletePhrase: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(bannedPhrases).where(eq(bannedPhrases.id, input.id));

      return { success: true };
    }),

  // Update compliance version (increment version, update dates)
  updateVersion: adminProcedure
    .input(
      z.object({
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get current version
      const [currentVersion] = await db.select().from(complianceVersions).orderBy(complianceVersions.id).limit(1);

      if (!currentVersion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No compliance version found" });
      }

      // Parse version number (e.g., "v1.0" -> 1.0)
      const versionMatch = currentVersion.version.match(/v(\d+\.\d+)/);
      const currentVersionNumber = versionMatch ? parseFloat(versionMatch[1]) : 1.0;
      const newVersionNumber = (currentVersionNumber + 0.1).toFixed(1);
      const newVersion = `v${newVersionNumber}`;

      // Calculate new dates (today + 90 days)
      const today = new Date();
      const nextReview = new Date(today);
      nextReview.setDate(nextReview.getDate() + 90);

      // Insert new version record
      await db.insert(complianceVersions).values({
        version: newVersion,
        lastUpdated: new Date(today.toISOString().split('T')[0]),
        nextReviewDue: new Date(nextReview.toISOString().split('T')[0]),
        notes: input.notes || `Updated compliance rules to ${newVersion}`,
      });

      return { success: true, version: newVersion };
    }),
});
