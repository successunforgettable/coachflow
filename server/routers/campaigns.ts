import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { campaigns } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const campaignsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    
    const result = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, ctx.user.id))
      .orderBy(campaigns.createdAt);
    
    return result;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        serviceId: z.number().optional(),
        campaignType: z.enum(["webinar", "challenge", "course_launch", "product_launch"]).optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(campaigns).values({
        userId: ctx.user.id,
        name: input.name,
        serviceId: input.serviceId || null,
        campaignType: input.campaignType || null,
        status: input.status || "draft",
      });

      return { id: Number(result[0].insertId) };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(200).optional(),
        campaignType: z.enum(["webinar", "challenge", "course_launch", "product_launch"]).optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.campaignType !== undefined) updateData.campaignType = input.campaignType;
      if (input.status) updateData.status = input.status;

      await db
        .update(campaigns)
        .set(updateData)
        .where(and(eq(campaigns.id, input.id), eq(campaigns.userId, ctx.user.id)));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(campaigns)
        .where(and(eq(campaigns.id, input.id), eq(campaigns.userId, ctx.user.id)));

      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, input.id), eq(campaigns.userId, ctx.user.id)))
        .limit(1);

      return result[0] || null;
    }),
});
