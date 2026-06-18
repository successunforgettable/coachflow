/**
 * Testimonials router — CRUD for the testimonial library + activate-for-campaign.
 *
 * The library stores unlimited testimonials per user. When the user selects
 * up to 3 for a campaign, they're written to services.testimonial1-3 columns
 * that all 5 generators already read — zero generator changes.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { testimonials, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const testimonialsRouter = router({
  /** List all testimonials in the user's library. */
  list: protectedProcedure
    .input(z.object({ serviceId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const rows = await db
        .select()
        .from(testimonials)
        .where(eq(testimonials.userId, ctx.user.id))
        .orderBy(desc(testimonials.createdAt));
      return rows;
    }),

  /** Add a testimonial to the library. Real testimonials only — nothing auto-generated. */
  add: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      title: z.string().max(255).optional(),
      quote: z.string().min(1).max(1000),
      serviceId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const [result] = await db.insert(testimonials).values({
        userId: ctx.user.id,
        serviceId: input.serviceId ?? null,
        name: input.name,
        title: input.title ?? null,
        quote: input.quote,
      });
      const id = Number(result.insertId);
      const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
      return row;
    }),

  /** Delete a testimonial from the library. */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.delete(testimonials).where(
        and(eq(testimonials.id, input.id), eq(testimonials.userId, ctx.user.id)),
      );
      return { ok: true };
    }),

  /**
   * Activate up to 3 testimonials for a service — writes them VERBATIM into
   * services.testimonial1-3 columns. The 5 generators read those columns as-is.
   * Passing an empty array clears all 3 slots (skip path).
   */
  activateForService: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      testimonialIds: z.array(z.number()).max(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Verify service ownership
      const [svc] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });

      // Fetch the selected testimonials (verify ownership)
      const selected: { name: string; title: string | null; quote: string }[] = [];
      for (const tid of input.testimonialIds) {
        const [t] = await db.select().from(testimonials)
          .where(and(eq(testimonials.id, tid), eq(testimonials.userId, ctx.user.id)))
          .limit(1);
        if (t) selected.push({ name: t.name, title: t.title, quote: t.quote });
      }

      // Write verbatim into the 3 slots — generators read these as-is
      await db.update(services).set({
        testimonial1Name: selected[0]?.name ?? null,
        testimonial1Title: selected[0]?.title ?? null,
        testimonial1Quote: selected[0]?.quote ?? null,
        testimonial2Name: selected[1]?.name ?? null,
        testimonial2Title: selected[1]?.title ?? null,
        testimonial2Quote: selected[1]?.quote ?? null,
        testimonial3Name: selected[2]?.name ?? null,
        testimonial3Title: selected[2]?.title ?? null,
        testimonial3Quote: selected[2]?.quote ?? null,
      }).where(eq(services.id, input.serviceId));

      return { activated: selected.length };
    }),
});
