import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}
import { getDb } from "../db";
import { emailSequences, services, campaigns, idealCustomerProfiles, sourceOfTruth, jobs, campaignKits, offers, heroMechanisms, hvcoTitles, headlines as headlinesTable } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { complianceFilter } from "../lib/complianceFilter";
import { checkCompliance } from "../lib/complianceChecker";
import { scoreItem } from "../lib/selectionScorer";
import { autoSelectBest } from "./campaignKits";

// Apply compliance filter to an email's subject and body
async function filterEmail(email: { subject: string; body: string; [k: string]: any }): Promise<typeof email> {
  const subResult = complianceFilter(email.subject);
  const bodyResult = complianceFilter(email.body);
  const subject = subResult.wasModified ? subResult.cleanedText : email.subject;
  const body = bodyResult.wasModified ? bodyResult.cleanedText : email.body;
  const score = await checkCompliance(body);
  if (score.score < 100) {
    console.log(`[emailSequences] Compliance score ${score.score}/100 for subject "${subject.substring(0, 40)}": ${score.issues.map(i => i.phrase).join(", ")}`);
  }
  return { ...email, subject, body };
}

const generateEmailSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["welcome", "engagement", "sales"]),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      deadline: z.string().optional(),
    })
    .optional(),
});

const updateEmailSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  emails: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const emailSequencesRouter = router({
  // List all email sequences for current user
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

      const conditions = [eq(emailSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(emailSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(emailSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(emailSequences)
        .where(and(...conditions))
        .orderBy(desc(emailSequences.createdAt));
    }),

  // Get single email sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("Email sequence not found");
      }

      return sequence;
    }),

  // Generate email sequence using AI (Russell Brunson Soap Opera Sequence)
  generate: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "email");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "email");
        if (ctx.user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.`,
          });
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
      
      // Social proof guidance for email copy
      const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers
        ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials available from: ${socialProof.testimonials.map((t: any) => t.name).join(', ')}` : ''}

You MUST use these exact numbers and real names. Do not fabricate.`
        : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts, ratings, or specific testimonials
- Focus on benefit claims and transformation outcomes
- Use outcome-based stories WITHOUT specific names ("One client" instead of "John Smith")`;


      // ── Cascade context from Campaign Kit ──
      let cascadeContext = "";
      try {
        const [relIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        if (relIcp) {
          const [kit] = await db.select().from(campaignKits).where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, relIcp.id))).limit(1);
          if (kit) {
            const parts: string[] = [];
            if (kit.selectedHvcoId) {
              const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, kit.selectedHvcoId)).limit(1);
              if (hvco) parts.push(`Lead magnet: ${hvco.title}`);
            }
            if (kit.selectedMechanismId) {
              const [mech] = await db.select().from(heroMechanisms).where(eq(heroMechanisms.id, kit.selectedMechanismId)).limit(1);
              if (mech) parts.push(`Hero mechanism: ${mech.mechanismName}`);
            }
            if (kit.selectedHeadlineId) {
              const [hl] = await db.select().from(headlinesTable).where(eq(headlinesTable.id, kit.selectedHeadlineId)).limit(1);
              if (hl) parts.push(`Selected headline: ${hl.headline}`);
            }
            if (kit.selectedOfferId) {
              const [offer] = await db.select().from(offers).where(eq(offers.id, kit.selectedOfferId)).limit(1);
              if (offer) parts.push(`Offer angle: ${offer.activeAngle || "godfather"}`);
            }
            if (parts.length > 0) {
              cascadeContext = `UPSTREAM CONTEXT — SELECTED ASSETS:\n${parts.join(". ")}. Early emails must reference the lead magnet. The sequence must build toward the offer.\n\n`;
            }
          }
        }
      } catch (e) { console.warn("[cascade] emailSequences context fetch failed:", e); }

      let prompt = "";

      if (input.sequenceType === "welcome") {
        prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email welcome sequence for new subscribers using Russell Brunson's Soap Opera Sequence framework.

Service: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Create 3 emails:
1. SET THE STAGE (Day 1) - Welcome, set expectations, introduce yourself
2. EPIPHANY (Day 3) - Share your transformation story, introduce solution
3. HIDDEN BENEFITS (Day 5) - Show secondary benefits, soft CTA

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (200-300 words, conversational tone, grade 4 language)
- CTA (clear next step)

Return as a JSON object with an 'emails' key containing the array.`;
      } else if (input.sequenceType === "engagement") {
        prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 5-email engagement sequence for event attendees using Russell Brunson's Soap Opera Sequence.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Host: ${input.eventDetails?.hostName || "Host"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Create 5 emails (Monday to Friday before event):
1. SET THE STAGE (Monday) - Introduce, set expectations
2. OPEN WITH HIGH DRAMA (Tuesday) - Tell your biggest problem
3. EPIPHANY (Wednesday) - Reveal solution, promote event
4. HIDDEN BENEFITS (Thursday) - Show secondary benefits
5. URGENCY & CTA (Friday) - Create scarcity, final push

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (200-300 words, conversational tone, grade 4 language)
- CTA (clear next step)

Return as a JSON object with an 'emails' key containing the array.`;
      } else {
        // sales sequence
        prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 7-email sales sequence for event attendees who didn't buy.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Offer: ${input.eventDetails?.offerName || "Offer"}
Price: ${input.eventDetails?.price || "Price"}
Deadline: ${input.eventDetails?.deadline || "Deadline"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Create 7 emails (Day 1-7 after event):
1. THANK YOU (Day 1) - Gratitude, recap key points
2. CASE STUDY (Day 2) - Success story, social proof
3. OBJECTION HANDLING (Day 3) - Address common objections
4. BONUS REVEAL (Day 4) - Exclusive bonuses
5. GUARANTEE (Day 5) - Risk reversal, guarantee
6. SCARCITY (Day 6) - Limited spots, urgency
7. FINAL CALL (Day 7) - Last chance, deadline

Each email should have:
- Subject line (40-60 characters, curiosity-driven)
- Preview text (30-50 characters)
- Body (250-350 words, conversational tone, grade 4 language)
- CTA (clear next step)

Return as a JSON object with an 'emails' key containing the array.`;
      }
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                emails: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer" },
                      subject: { type: "string" },
                      previewText: { type: "string" },
                      body: { type: "string" },
                      cta: { type: "string" },
                    },
                    required: ["day", "subject", "previewText", "body", "cta"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["emails"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }
      let sequenceData = JSON.parse(stripMarkdownJson(content));
      // Defensive: if LLM returned a raw array instead of { emails: [...] }, wrap it
      if (Array.isArray(sequenceData)) {
        sequenceData = { emails: sequenceData };
      }
      if (!sequenceData.emails || !Array.isArray(sequenceData.emails)) {
        throw new Error("LLM did not return a valid emails array");
      }
      sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({
        subject: email.subject || `Email ${idx + 1}: Check this out`,
        body: email.body || `This is email ${idx + 1}. Click the link to learn more.`,
        delay: email.delay || (idx * 24),
        delayUnit: email.delayUnit || 'hours',
        cta: email.cta || 'Learn More',
        ctaLink: email.ctaLink || '#',
      }));
      // Apply compliance filter to all emails
      sequenceData.emails = await Promise.all(sequenceData.emails.map((e: any) => filterEmail(e)));
      // Save to database
      const insertResult: any = await db.insert(emailSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        emails: sequenceData.emails,
      });

      await incrementQuotaCount(ctx.user.id, "email");

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, insertResult[0].insertId))
        .limit(1);

      // Auto-score and auto-select into campaign kit (non-blocking)
      try {
        const emailContent = sequenceData.emails.map((e: any) => `${e.subject} ${e.body}`).join(" ");
        const s = await scoreItem({ content: emailContent, nodeType: "emailSequences" });
        await db.update(emailSequences).set({ selectionScore: String(s) } as any).where(eq(emailSequences.id, insertResult[0].insertId));
        const [relatedIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        if (relatedIcp) await autoSelectBest(ctx.user.id, relatedIcp.id, "selectedEmailSequenceId", insertResult[0].insertId);
      } catch (e) { console.warn("[auto-select] emailSequences failed:", e); }

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; email sequence generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await enforceQuota(user.id, "email");
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "email");
        if (user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");
      const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, user.id)).limit(1);
      let icp: any;
      let campaignType = 'course_launch';
      if (input.campaignId) {
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
        if (campaign?.campaignType) campaignType = campaign.campaignType;
        if (campaign?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1); }
      }
      if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1); }

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };
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
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : ''}`.trim() : '';
          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. CTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. CTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey. CTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access. CTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];
          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0, testimonials: [capturedService.testimonial1Name ? { name: capturedService.testimonial1Name, title: capturedService.testimonial1Title || '', quote: capturedService.testimonial1Quote || '' } : null, capturedService.testimonial2Name ? { name: capturedService.testimonial2Name, title: capturedService.testimonial2Title || '', quote: capturedService.testimonial2Quote || '' } : null, capturedService.testimonial3Name ? { name: capturedService.testimonial3Name, title: capturedService.testimonial3Title || '', quote: capturedService.testimonial3Quote || '' } : null].filter(Boolean) };
          const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers ? `REAL SOCIAL PROOF AVAILABLE:\n${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}\n${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}\n${socialProof.hasTestimonials ? `- Real testimonials available from: ${(socialProof.testimonials as any[]).map((t: any) => t.name).join(', ')}` : ''}\n\nYou MUST use these exact numbers and real names. Do not fabricate.` : `NO SOCIAL PROOF DATA PROVIDED:\n- DO NOT mention customer counts, ratings, or specific testimonials\n- Focus on benefit claims and transformation outcomes\n- Use outcome-based stories WITHOUT specific names`;

          let prompt = "";
          if (capturedInput.sequenceType === "welcome") {
            prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email welcome sequence for new subscribers using Russell Brunson's Soap Opera Sequence framework.\n\nService: ${capturedService.name}\nCategory: ${capturedService.category}\nDescription: ${capturedService.description}\nTarget Customer: ${capturedService.targetCustomer}\nMain Benefit: ${capturedService.mainBenefit}\n\n${socialProofGuidance}\n\n${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}\n\nCreate 3 emails (Day 1, 3, 5). Each email: subject line, preview text, body (200-300 words), CTA.\n\nReturn as a JSON object with an 'emails' key containing the array.`;
          } else if (capturedInput.sequenceType === "engagement") {
            prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 5-email engagement sequence for event attendees using Russell Brunson's Soap Opera Sequence.\n\nService: ${capturedService.name}\nEvent: ${capturedInput.eventDetails?.eventName || "Event"}\nHost: ${capturedInput.eventDetails?.hostName || "Host"}\n\n${socialProofGuidance}\n\n${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}\n\nCreate 5 emails (Monday to Friday before event). Each email: subject line, preview text, body (200-300 words), CTA.\n\nReturn as a JSON object with an 'emails' key containing the array.`;
          } else {
            prompt = `${cascadeContext}${sotContext ? `${sotContext}\n\n` : ''}You are an expert email marketer. Create a 7-email sales sequence for event attendees who didn't buy.\n\nService: ${capturedService.name}\nEvent: ${capturedInput.eventDetails?.eventName || "Event"}\nOffer: ${capturedInput.eventDetails?.offerName || "Offer"}\nPrice: ${capturedInput.eventDetails?.price || "Price"}\nDeadline: ${capturedInput.eventDetails?.deadline || "Deadline"}\n\n${socialProofGuidance}\n\n${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}\n\nCreate 7 emails (Day 1-7 after event). Each email: subject line, preview text, body (250-350 words), CTA.\n\nReturn as a JSON object with an 'emails' key containing the array.`;
          }

          const response = await invokeLLM({ messages: [{ role: "system", content: "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "email_sequence", strict: true, schema: { type: "object", properties: { emails: { type: "array", items: { type: "object", properties: { day: { type: "integer" }, subject: { type: "string" }, previewText: { type: "string" }, body: { type: "string" }, cta: { type: "string" } }, required: ["day", "subject", "previewText", "body", "cta"], additionalProperties: false } } }, required: ["emails"], additionalProperties: false } } } });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") throw new Error("Invalid response format from AI");
          let sequenceData = JSON.parse(stripMarkdownJson(content));
          if (Array.isArray(sequenceData)) sequenceData = { emails: sequenceData };
          if (!sequenceData.emails || !Array.isArray(sequenceData.emails)) throw new Error("LLM did not return a valid emails array");
          sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({ subject: email.subject || `Email ${idx + 1}: Check this out`, body: email.body || `This is email ${idx + 1}. Click the link to learn more.`, delay: email.delay || (idx * 24), delayUnit: email.delayUnit || 'hours', cta: email.cta || 'Learn More', ctaLink: email.ctaLink || '#' }));
          sequenceData.emails = await Promise.all(sequenceData.emails.map((e: any) => filterEmail(e)));

          const insertResult: any = await bgDb.insert(emailSequences).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, sequenceType: capturedInput.sequenceType, name: capturedInput.name, emails: sequenceData.emails });
          await incrementQuotaCount(capturedUserId, "email");
          const [newSequence] = await bgDb.select().from(emailSequences).where(eq(emailSequences.id, insertResult[0].insertId)).limit(1);

          // Auto-score and auto-select into campaign kit (non-blocking)
          try {
            const emailContent = sequenceData.emails.map((e: any) => `${e.subject} ${e.body}`).join(" ");
            const s = await scoreItem({ content: emailContent, nodeType: "emailSequences" });
            await bgDb.update(emailSequences).set({ selectionScore: String(s) } as any).where(eq(emailSequences.id, insertResult[0].insertId));
            const [relatedIcp] = await bgDb.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, capturedInput.serviceId)).limit(1);
            if (relatedIcp) await autoSelectBest(capturedUserId, relatedIcp.id, "selectedEmailSequenceId", insertResult[0].insertId);
          } catch (e) { console.warn("[auto-select] emailSequences async failed:", e); }

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newSequence?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[emailSequences.generateAsync] Job ${jobId} completed, sequenceId: ${newSequence?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[emailSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update email sequence
  update: protectedProcedure
    .input(updateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .update(emailSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(emailSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Regenerate a single email within a sequence via AI
  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number(), index: z.number(), promptOverride: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await enforceQuota(ctx.user.id, "email");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [row] = await db
        .select()
        .from(emailSequences)
        .where(and(eq(emailSequences.id, input.id), eq(emailSequences.userId, ctx.user.id)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email sequence not found" });
      }

      const emails: any[] = typeof row.emails === "string" ? JSON.parse(row.emails) : (row.emails ?? []);

      if (input.index < 0 || input.index >= emails.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Email index ${input.index} out of range (0-${emails.length - 1})` });
      }

      const target = emails[input.index];
      const overrideInstruction = input.promptOverride?.trim()
        ? ` Additional instruction: ${input.promptOverride.trim()}.`
        : "";

      const prompt = `Rewrite this email in a sequence for a coaching offer. Current subject: ${target.subject}. Current body: ${target.body}.${overrideInstruction} Return a JSON object with exactly two keys: subject (string) and body (string). No explanation, no markdown, just the JSON object.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert email copywriter for coaches and consultants. Respond with only valid JSON." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response from AI");
      }

      const parsed = JSON.parse(stripMarkdownJson(content));
      if (!parsed.subject || !parsed.body) {
        throw new Error("AI response missing subject or body");
      }

      // Apply compliance filter to regenerated email
      const filtered = await filterEmail({ subject: parsed.subject, body: parsed.body });
      emails[input.index] = { ...emails[input.index], subject: filtered.subject, body: filtered.body };

      await db
        .update(emailSequences)
        .set({ emails: JSON.stringify(emails), updatedAt: new Date() })
        .where(eq(emailSequences.id, input.id));

      return emails[input.index];
    }),

  // Delete email sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .delete(emailSequences)
        .where(eq(emailSequences.id, input.id));

      return { success: true };
    }),
});
