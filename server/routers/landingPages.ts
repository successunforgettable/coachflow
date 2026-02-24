import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { getQuotaLimit } from "../quotaLimits";
import { getDb } from "../db";
import { landingPages, services, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateAllAngles } from "../landingPageGenerator";

const generateLandingPageSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  avatarName: z.string().optional(), // e.g., "Amir from Abu Dhabi"
  avatarDescription: z.string().optional(), // e.g., "Expat Professional"
});

const updateActiveAngleSchema = z.object({
  id: z.number(),
  activeAngle: z.enum(["original", "godfather", "free", "dollar"]),
});

const updateRatingSchema = z.object({
  id: z.number(),
  rating: z.number().min(0).max(5),
});

export const landingPagesRouter = router({
  // List all landing pages for current user
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

      const conditions = [eq(landingPages.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(landingPages.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(landingPages.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(landingPages)
        .where(and(...conditions))
        .orderBy(desc(landingPages.createdAt));
    }),

  // Get single landing page by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [page] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!page) {
        throw new Error("Landing page not found");
      }

      return page;
    }),

  // Generate landing page with all 4 angles using AI
  generate: protectedProcedure
    .input(generateLandingPageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Check quota
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) throw new Error("User not found");

      // Superusers have unlimited quota
      if (user.role !== "superuser") {
        const quotaLimits = {
          trial: 2,
          pro: 50,
          agency: 500,
        };

        const limit = quotaLimits[user.subscriptionTier || "trial"];
        if (user.landingPageGeneratedCount >= limit) {
          throw new Error(`Landing page generation limit reached (${limit}). Please upgrade your plan.`);
        }
      }

      // Get service details with social proof (Issue 2 fix)
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
      
      // Extract real social proof data
      const socialProof = {
        hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
        hasRating: !!service.averageRating && parseFloat(service.averageRating) > 0,
        hasReviews: !!service.totalReviews && service.totalReviews > 0,
        hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
        hasPress: !!service.pressFeatures && service.pressFeatures.trim().length > 0,
        customerCount: service.totalCustomers || 0,
        rating: service.averageRating || '',
        reviewCount: service.totalReviews || 0,
        testimonials: [
          service.testimonial1Name ? { name: service.testimonial1Name, title: service.testimonial1Title || '', quote: service.testimonial1Quote || '' } : null,
          service.testimonial2Name ? { name: service.testimonial2Name, title: service.testimonial2Title || '', quote: service.testimonial2Quote || '' } : null,
          service.testimonial3Name ? { name: service.testimonial3Name, title: service.testimonial3Title || '', quote: service.testimonial3Quote || '' } : null,
        ].filter(Boolean),
        press: service.pressFeatures || '',
      };

      // Issue 5: Parse avatar from comma-separated format (name, age, role, location)
      let avatarName = input.avatarName || `${service.targetCustomer}`;
      let avatarDescription = input.avatarDescription || service.description || "Target Customer";
      
      // If avatarName contains commas, parse it
      if (avatarName.includes(',')) {
        const parts = avatarName.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          // Format: "Name, Age, Role, Location" or "Name, Age, Role"
          const name = parts[0];
          const role = parts[2];
          avatarName = `${name} the ${role}`; // "Sarah the Marketing Director"
          avatarDescription = parts.length >= 4 ? parts[3] : role; // Location or Role
        } else if (parts.length === 2) {
          // Format: "Name, Role"
          const name = parts[0];
          const role = parts[1];
          avatarName = `${name} the ${role}`;
          avatarDescription = role;
        }
        // Otherwise keep original format
      }

      // Generate all 4 angles in parallel with social proof (Issue 2 fix)
      const allAngles = await generateAllAngles(
        service.name,
        service.description || "",
        avatarName,
        avatarDescription,
        socialProof
      );

      // Save to database
      const insertResult: any = await db.insert(landingPages).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        productName: service.name,
        productDescription: service.description || "",
        avatarName,
        avatarDescription,
        originalAngle: allAngles.original,
        godfatherAngle: allAngles.godfather,
        freeAngle: allAngles.free,
        dollarAngle: allAngles.dollar,
        activeAngle: "original",
        rating: 0,
      });

      // Update usage count
      await db
        .update(users)
        .set({
          landingPageGeneratedCount: user.landingPageGeneratedCount + 1,
        })
        .where(eq(users.id, ctx.user.id));

      // Fetch the created landing page
      const [newPage] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, insertResult[0].insertId))
        .limit(1);

      return newPage;
    }),

  // Update active angle (instant switching)
  updateActiveAngle: protectedProcedure
    .input(updateActiveAngleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db
        .update(landingPages)
        .set({
          activeAngle: input.activeAngle,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, input.id));

      // Fetch updated landing page
      const [updated] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.id))
        .limit(1);

      return updated;
    }),

  // Update rating
  updateRating: protectedProcedure
    .input(updateRatingSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db
        .update(landingPages)
        .set({
          rating: input.rating,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, input.id));

      // Fetch updated landing page
      const [updated] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.id))
        .limit(1);

      return updated;
    }),

  // Delete landing page
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db.delete(landingPages).where(eq(landingPages.id, input.id));

      return { success: true };
    }),
});
