import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { nodeSkips } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const nodeSkipsRouter = router({
  skip: protectedProcedure
    .input(z.object({
      serviceId: z.number().int(),
      nodeType: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .insert(nodeSkips)
        .values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          nodeType: input.nodeType,
        })
        .onDuplicateKeyUpdate({ set: { skippedAt: new Date() } });
      return { success: true };
    }),

  getSkippedNodes: protectedProcedure
    .input(z.object({ serviceId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({ nodeType: nodeSkips.nodeType })
        .from(nodeSkips)
        .where(and(
          eq(nodeSkips.userId, ctx.user.id),
          eq(nodeSkips.serviceId, input.serviceId),
        ));
      return rows.map(r => r.nodeType);
    }),
});
