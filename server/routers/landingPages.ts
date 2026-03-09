import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { getQuotaLimit } from "../quotaLimits";
import { getDb } from "../db";
import { landingPages, services, users, campaigns, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
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

      // SOT query — Item 1.4
      const [sot] = await db
        .select()
        .from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, ctx.user.id))
        .limit(1);

      const sotLines = sot ? [
        sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
        sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
        sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
        sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
        sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
        sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
      ].filter(Boolean) : [];

      const sotContext = sotLines.length > 0
        ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
        : '';

      // Campaign fetch — Item 1.5 (campaignType) + Item 1.1b (icpId)
      let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
      let campaignType = 'course_launch'; // default

      if (input.campaignId) {
        const [campaign] = await db
          .select()
          .from(campaigns)
          .where(and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.userId, ctx.user.id)
          ))
          .limit(1);

        if (campaign?.campaignType) {
          campaignType = campaign.campaignType;
        }
        if (campaign?.icpId) {
          [icp] = await db.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1);
        }
      }
      // ICP serviceId fallback — Item 1.1b
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }
      const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.objections ? `Their objections to buying: ${icp.objections}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : ''}
${icp.successMetrics ? `How they measure success: ${icp.successMetrics}` : ''}
`.trim() : '';

      const campaignTypeContextMap: Record<string, string> = {
        webinar: `CAMPAIGN TYPE: Webinar
Framing: Show-up urgency — the live event is the vehicle. Copy must give a compelling reason to attend live, not just register.
Urgency mechanism: Date and time of the webinar. Limited seats available.
CTA language: Register now / Save your seat / Join us live on [date]`,

        challenge: `CAMPAIGN TYPE: Challenge
Framing: Community commitment — joining a group doing this together. Daily wins build momentum.
Urgency mechanism: Challenge start date. Community closes when the challenge begins.
CTA language: Join the challenge / Claim your spot / Start with us on [date]`,

        course_launch: `CAMPAIGN TYPE: Course Launch
Framing: Transformation journey — who they are now vs who they will become. Enrolment is the decision point.
Urgency mechanism: Enrolment deadline. Cohort size is limited.
CTA language: Enrol now / Join the programme / Claim your place before [date]`,

        product_launch: `CAMPAIGN TYPE: Product Launch
Framing: Early access and founding member status. First to experience something new.
Urgency mechanism: Launch day price increase. Founding member pricing closes on launch day.
CTA language: Get early access / Become a founding member / Lock in launch pricing`,
      };

      const campaignTypeContext = campaignTypeContextMap[campaignType] || campaignTypeContextMap['course_launch'];

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

      // Append SOT + campaignType + ICP context to avatarDescription — Item 1.2 + 1.4 + 1.5
      // Layer order: SOT → avatarDescription → campaignType → ICP
      const enrichedAvatarDescription = [
        sotContext || null,
        avatarDescription || null,
        campaignTypeContext || null,
        icpContext || null,
      ].filter(Boolean).join('\n\n');

      // Generate all 4 angles in parallel with social proof (Issue 2 fix)
      const allAngles = await generateAllAngles(
        service.name,
        service.description || "",
        avatarName,
        enrichedAvatarDescription,
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

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; landing page generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateLandingPageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await checkAndResetQuotaIfNeeded(ctx.user.id);
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new Error("User not found");
      if (user.role !== "superuser") {
        const quotaLimits = { trial: 2, pro: 50, agency: 500 };
        const limit = quotaLimits[user.subscriptionTier || "trial"];
        if (user.landingPageGeneratedCount >= limit) throw new Error(`Landing page generation limit reached (${limit}). Please upgrade your plan.`);
      }
      const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))).limit(1);
      if (!service) throw new Error("Service not found");
      const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, ctx.user.id)).limit(1);
      let icp: any;
      let campaignType = 'course_launch';
      if (input.campaignId) {
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, ctx.user.id))).limit(1);
        if (campaign?.campaignType) campaignType = campaign.campaignType;
        if (campaign?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1); }
      }
      if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1); }

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;
      const capturedService = { ...service };
      const capturedUser = { ...user };
      const capturedIcp = icp ? { ...icp } : undefined;
      const capturedSot = sot ? { ...sot } : undefined;
      const capturedCampaignType = campaignType;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const sotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '', capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '', capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '', capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : ''}\n${capturedIcp.successMetrics ? `How they measure success: ${capturedIcp.successMetrics}` : ''}`.trim() : '';

          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. Copy must give a compelling reason to attend live.\nCTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. Daily wins build momentum.\nCTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey.\nCTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access and founding member status.\nCTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];

          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, hasPress: !!capturedService.pressFeatures && capturedService.pressFeatures.trim().length > 0, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0, testimonials: [capturedService.testimonial1Name ? { name: capturedService.testimonial1Name, title: capturedService.testimonial1Title || '', quote: capturedService.testimonial1Quote || '' } : null, capturedService.testimonial2Name ? { name: capturedService.testimonial2Name, title: capturedService.testimonial2Title || '', quote: capturedService.testimonial2Quote || '' } : null, capturedService.testimonial3Name ? { name: capturedService.testimonial3Name, title: capturedService.testimonial3Title || '', quote: capturedService.testimonial3Quote || '' } : null].filter(Boolean), press: capturedService.pressFeatures || '' };

          let avatarName = capturedInput.avatarName || `${capturedService.targetCustomer}`;
          let avatarDescription = capturedInput.avatarDescription || capturedService.description || "Target Customer";
          if (avatarName.includes(',')) {
            const parts = avatarName.split(',').map((p: string) => p.trim());
            if (parts.length >= 3) { avatarName = `${parts[0]} the ${parts[2]}`; avatarDescription = parts.length >= 4 ? parts[3] : parts[2]; }
            else if (parts.length === 2) { avatarName = `${parts[0]} the ${parts[1]}`; avatarDescription = parts[1]; }
          }
          const enrichedAvatarDescription = [sotContext || null, avatarDescription || null, campaignTypeContext || null, icpContext || null].filter(Boolean).join('\n\n');

          const allAngles = await generateAllAngles(capturedService.name, capturedService.description || "", avatarName, enrichedAvatarDescription, socialProof);

          const insertResult: any = await bgDb.insert(landingPages).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, productName: capturedService.name, productDescription: capturedService.description || "", avatarName, avatarDescription, originalAngle: allAngles.original, godfatherAngle: allAngles.godfather, freeAngle: allAngles.free, dollarAngle: allAngles.dollar, activeAngle: "original", rating: 0 });
          await bgDb.update(users).set({ landingPageGeneratedCount: capturedUser.landingPageGeneratedCount + 1 }).where(eq(users.id, capturedUserId));
          const [newPage] = await bgDb.select().from(landingPages).where(eq(landingPages.id, insertResult[0].insertId)).limit(1);

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newPage?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[landingPages.generateAsync] Job ${jobId} completed, landingPageId: ${newPage?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[landingPages.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
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
