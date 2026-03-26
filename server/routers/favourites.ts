import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { favourites } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const favouritesRouter = router({
  /**
   * Add a favourite (thumbs-up) for a specific item in a node
   */
  add: protectedProcedure
    .input(z.object({
      nodeId: z.string().min(1).max(50),
      itemIndex: z.number().int().min(0),
      itemText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check if already favourited
      const [existing] = await db.select().from(favourites)
        .where(and(
          eq(favourites.userId, ctx.user.id),
          eq(favourites.nodeId, input.nodeId),
          eq(favourites.itemIndex, input.itemIndex),
        ))
        .limit(1);

      if (existing) return { id: existing.id, alreadyExists: true };

      const result: any = await db.insert(favourites).values({
        userId: ctx.user.id,
        nodeId: input.nodeId,
        itemIndex: input.itemIndex,
        itemText: input.itemText || null,
      });

      return { id: result[0].insertId, alreadyExists: false };
    }),

  /**
   * Remove a favourite (un-thumbs-up) for a specific item in a node
   */
  remove: protectedProcedure
    .input(z.object({
      nodeId: z.string().min(1).max(50),
      itemIndex: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(favourites)
        .where(and(
          eq(favourites.userId, ctx.user.id),
          eq(favourites.nodeId, input.nodeId),
          eq(favourites.itemIndex, input.itemIndex),
        ));

      return { success: true };
    }),

  /**
   * Get all favourited item indices for a specific node
   */
  getByNode: protectedProcedure
    .input(z.object({
      nodeId: z.string().min(1).max(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const rows = await db.select().from(favourites)
        .where(and(
          eq(favourites.userId, ctx.user.id),
          eq(favourites.nodeId, input.nodeId),
        ));

      return rows.map(r => ({ itemIndex: r.itemIndex, itemText: r.itemText }));
    }),
});
