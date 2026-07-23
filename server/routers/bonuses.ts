import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { and, eq, asc } from "drizzle-orm";
import { campaignKits, bonuses } from "../../drizzle/schema";

// Bonuses read surface (Layer 2) — the Kit's "Your bonuses" section reads this to show titles + download links
// + a generating/rendering state while the fire-and-forget PDF job runs. Ownership-scoped to the authed user.
export const bonusesRouter = router({
  listForKit: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.campaignKitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });

      const rows = await db.select({
        id: bonuses.id, bonusType: bonuses.bonusType, title: bonuses.title, shortLine: bonuses.shortLine,
        format: bonuses.format, magnetHtmlUrl: bonuses.magnetHtmlUrl, magnetPdfUrl: bonuses.magnetPdfUrl,
        assetBody: bonuses.assetBody,
      }).from(bonuses)
        .where(and(eq(bonuses.campaignKitId, input.campaignKitId), eq(bonuses.userId, ctx.user.id)))
        .orderBy(asc(bonuses.id));

      return rows.map((r) => ({
        id: r.id,
        bonusType: r.bonusType,
        title: r.title,
        shortLine: r.shortLine,
        format: r.format,
        pdfUrl: r.magnetPdfUrl,
        pageUrl: r.magnetHtmlUrl,
        // ready = hosted PDF; rendering = content generated, PDF in flight; generating = concept only.
        status: r.magnetPdfUrl ? "ready" : (r.assetBody != null ? "rendering" : "generating"),
      }));
    }),
});
