import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.enum(["coaching", "speaking", "consulting"]),
  description: z.string().min(1, "Description is required"),
  targetCustomer: z.string().min(1, "Target customer is required").max(500),
  mainBenefit: z.string().min(1, "Main benefit is required").max(500),
  price: z.number().optional(),
});

const updateServiceSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  category: z.enum(["coaching", "speaking", "consulting"]).optional(),
  description: z.string().min(1).optional(),
  targetCustomer: z.string().min(1).max(500).optional(),
  mainBenefit: z.string().min(1).max(500).optional(),
  price: z.number().optional(),
  // Social proof fields (Issue 2 fix)
  totalCustomers: z.number().optional(),
  averageRating: z.number().optional(),
  totalReviews: z.number().optional(),
  testimonial1Name: z.string().max(255).optional(),
  testimonial1Title: z.string().max(255).optional(),
  testimonial1Quote: z.string().max(1000).optional(),
  testimonial2Name: z.string().max(255).optional(),
  testimonial2Title: z.string().max(255).optional(),
  testimonial2Quote: z.string().max(1000).optional(),
  testimonial3Name: z.string().max(255).optional(),
  testimonial3Title: z.string().max(255).optional(),
  testimonial3Quote: z.string().max(1000).optional(),
  pressFeatures: z.string().max(1000).optional(),
  // Video authority badge stat
  socialProofStat: z.string().max(255).optional(),
  // AutoPop fields (Phase 39 FIX 2)
  whyProblemExists: z.string().optional(),
  hvcoTopic: z.string().max(300).optional(),
  mechanismDescriptor: z.enum(["AI", "System", "Framework", "Method", "Blueprint", "Process"]).optional(),
  applicationMethod: z.string().max(150).optional(),
  avatarName: z.string().max(100).optional(),
  avatarTitle: z.string().max(100).optional(),
});

export const servicesRouter = router({
  // List all services for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    return await db
      .select()
      .from(services)
      .where(eq(services.userId, ctx.user.id))
      .orderBy(desc(services.createdAt));
  }),

  // Get single service by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!service) {
        throw new Error("Service not found");
      }
      
      return service;
    }),

  // Create new service
  create: protectedProcedure
    .input(createServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Convert price to string for decimal field
      const insertData: any = {
        userId: ctx.user.id,
        ...input,
      };
      if (insertData.price !== undefined) {
        insertData.price = insertData.price.toString();
      }
      
      const result: any = await db.insert(services).values(insertData);
      
      // MySQL doesn't support RETURNING, fetch the inserted record
      const [newService] = await db
        .select()
        .from(services)
        .where(eq(services.id, result[0].insertId))
        .limit(1);
      
      return newService;
    }),

  // Update existing service
  update: protectedProcedure
    .input(updateServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...updateData } = input;
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!existing) {
        throw new Error("Service not found");
      }
      
      // Convert price to string for decimal field
      const setData: any = { ...updateData, updatedAt: new Date() };
      if (setData.price !== undefined) {
        setData.price = setData.price?.toString();
      }
      
      await db
        .update(services)
        .set(setData)
        .where(eq(services.id, id));
      
      // Fetch updated record
      const [updated] = await db
        .select()
        .from(services)
        .where(eq(services.id, id))
        .limit(1);
      
      return updated;
    }),

  // Delete service
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!existing) {
        throw new Error("Service not found");
      }
      
      await db.delete(services).where(eq(services.id, input.id));
      
      return { success: true };
    }),
});
