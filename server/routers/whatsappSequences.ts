import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}
import { whatsappSequences, services, campaigns, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateWhatsAppSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["engagement", "sales"]),
  sequenceLength: z.number().min(3).max(14).default(3),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
});

const updateWhatsAppSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  messages: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const whatsappSequencesRouter = router({
  // List all WhatsApp sequences for current user
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

      const conditions = [eq(whatsappSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(whatsappSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(whatsappSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(whatsappSequences)
        .where(and(...conditions))
        .orderBy(desc(whatsappSequences.createdAt));
    }),

  // Get single WhatsApp sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("WhatsApp sequence not found");
      }

      return sequence;
    }),

  // Generate WhatsApp sequence using AI
  generate: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "whatsapp");
        if (ctx.user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.`,
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
      const coachContext = ctx.user.coachName
        ? `COACH IDENTITY — ABSOLUTE PRIORITY — THIS OVERRIDES ALL OTHER CONTEXT:\n- The coach writing this content is: ${ctx.user.coachName}\n- Coach gender: ${ctx.user.coachGender ?? 'not specified'} — write ALL first-person content from this gender perspective without exception\n- Coach background: ${ctx.user.coachBackground ?? 'not specified'}\n\nCRITICAL RULES:\n1. Always sign off as ${ctx.user.coachName} — never write [Name] or any placeholder\n2. Write entirely in ${ctx.user.coachName}'s voice and gender perspective\n3. The ICP (ideal customer) may be a different gender — do not confuse ICP gender with coach gender\n4. Never invent fictional experts or third-party personas`
        : '';
      const contextPrefix = [coachContext, sotContext].filter(Boolean).join('\n\n');

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
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : ''}
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
        hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
        customerCount: service.totalCustomers || 0,
      };
      
      // Social proof guidance for WhatsApp messages
      const socialProofGuidance = socialProof.hasCustomers || socialProof.hasTestimonials
        ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}

You MUST use these exact numbers. Do not fabricate.`
        : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts or specific testimonials
- Focus on benefit claims and value propositions
- Use outcome-based language WITHOUT specific names`;

      let prompt = "";

      if (input.sequenceType === "engagement") {
        prompt = `${contextPrefix ? `${contextPrefix}\n\n` : ''}You are an expert WhatsApp marketer. Create a WhatsApp engagement sequence for event attendees.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Host: ${input.eventDetails?.hostName || "Host"}
Event Date: ${input.eventDetails?.eventDate || "Date"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Generate exactly ${input.sequenceLength} WhatsApp messages:
1. WELCOME & EXPECTATION SETTING (Monday) - Personal welcome, what to expect
2. EDUCATIONAL CONTENT (Wednesday) - Share valuable tip, build trust
3. URGENCY & REMINDER (Friday) - Event reminder, create urgency

Each message should:
- Be personal and conversational (98%+ open rate on WhatsApp)
- Use emojis appropriately (cultural sensitivity for UAE/India/Malaysia)
- Be 50-100 words (short and scannable)
- Include clear CTA
- Use second-person POV ("you" not "we")
- Be grade 4 language level
- Use [First Name] for personalization (NOT {{Name}})
- Use actual service name "${service.name}" (NOT {{Product}})
- Use actual event name "${input.eventDetails?.eventName || "the event"}" (NOT {{Event}})
- DO NOT use placeholder syntax like {{Date}} or {{Time}} - write actual timing descriptions

Return as a JSON object with a 'messages' key containing the array.`;
      } else {
        // sales sequence
        prompt = `${contextPrefix ? `${contextPrefix}\n\n` : ''}You are an expert WhatsApp marketer. Create a WhatsApp sales sequence for event attendees.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Offer: ${input.eventDetails?.offerName || "Offer"}
Price: ${input.eventDetails?.price || "Price"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Generate exactly ${input.sequenceLength} WhatsApp messages:
1. EXCLUSIVE OFFER (Day 1) - Thank you, exclusive offer for attendees
2. SUCCESS STORY (Day 3) - Social proof, case study, testimonial
3. FINAL CALL (Day 5) - Scarcity, urgency, deadline

Each message should:
- Be personal and conversational (98%+ open rate on WhatsApp)
- Use emojis appropriately (cultural sensitivity for UAE/India/Malaysia)
- Be 50-100 words (short and scannable)
- Include clear CTA
- Use second-person POV ("you" not "we")
- Be grade 4 language level
- Include scarcity/urgency elements (+12% CVR)
- Use [First Name] for personalization (NOT {{Name}})
- Use actual service name "${service.name}" (NOT {{Product}})
- Use actual offer name "${input.eventDetails?.offerName || "this offer"}" (NOT {{Offer}})
- DO NOT use placeholder syntax like {{Date}} or {{Time}} - write actual timing descriptions

Return as a JSON object with a 'messages' key containing the array.`;
      }
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert WhatsApp marketer specializing in high-converting WhatsApp sequences for coaches, speakers, and consultants. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "whatsapp_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                messages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer" },
                      message: { type: "string" },
                      cta: { type: "string" },
                    },
                    required: ["day", "message", "cta"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["messages"],
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
      // Defensive: if LLM returned a raw array instead of { messages: [...] }, wrap it
      if (Array.isArray(sequenceData)) {
        sequenceData = { messages: sequenceData };
      }
      if (!sequenceData.messages || !Array.isArray(sequenceData.messages)) {
        throw new Error("LLM did not return a valid messages array");
      }
      sequenceData.messages = sequenceData.messages.map((msg: any, idx: number) => ({
        text: msg.message || msg.text || `Message ${idx + 1}: Check this out`,
        delay: msg.delay || (idx * 24),
        delayUnit: msg.delayUnit || 'hours',
        mediaUrl: msg.mediaUrl || null,
        mediaType: msg.mediaType || null,
      }));
      // Save to database
      const insertResult: any = await db.insert(whatsappSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        messages: sequenceData.messages,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, insertResult[0].insertId))
        .limit(1);

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; WhatsApp sequence generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "whatsapp");
        if (user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.` });
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
      const capturedCoachContext = user.coachName
        ? `COACH IDENTITY — ABSOLUTE PRIORITY — THIS OVERRIDES ALL OTHER CONTEXT:\n- The coach writing this content is: ${user.coachName}\n- Coach gender: ${user.coachGender ?? 'not specified'} — write ALL first-person content from this gender perspective without exception\n- Coach background: ${user.coachBackground ?? 'not specified'}\n\nCRITICAL RULES:\n1. Always sign off as ${user.coachName} — never write [Name] or any placeholder\n2. Write entirely in ${user.coachName}'s voice and gender perspective\n3. The ICP (ideal customer) may be a different gender — do not confuse ICP gender with coach gender\n4. Never invent fictional experts or third-party personas`
        : '';

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const sotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '', capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '', capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '', capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';
          const contextPrefix = [capturedCoachContext, sotContext].filter(Boolean).join('\n\n');
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.communicationStyle ? `How they communicate: ${capturedIcp.communicationStyle}` : ''}`.trim() : '';
          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. CTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. CTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey. CTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access. CTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];
          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, customerCount: capturedService.totalCustomers || 0 };
          const socialProofGuidance = socialProof.hasCustomers || socialProof.hasTestimonials ? `REAL SOCIAL PROOF AVAILABLE:\n${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}\n\nYou MUST use these exact numbers. Do not fabricate.` : `NO SOCIAL PROOF DATA PROVIDED:\n- DO NOT mention customer counts or specific testimonials\n- Focus on benefit claims and value propositions\n- Use outcome-based language WITHOUT specific names`;

          let prompt = "";
          if (capturedInput.sequenceType === "engagement") {
            prompt = `${contextPrefix ? `${contextPrefix}\n\n` : ''}You are an expert WhatsApp marketer. Create a WhatsApp engagement sequence for event attendees.\n\nService: ${capturedService.name}\nEvent: ${capturedInput.eventDetails?.eventName || "Event"}\nHost: ${capturedInput.eventDetails?.hostName || "Host"}\nEvent Date: ${capturedInput.eventDetails?.eventDate || "Date"}\n\n${socialProofGuidance}\n\n${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}\n\nGenerate exactly ${capturedInput.sequenceLength} WhatsApp messages. Each message: 50-100 words, personal, conversational, emojis, clear CTA, use [First Name] for personalization.\n\nReturn as a JSON object with a 'messages' key containing the array.`;
          } else {
            prompt = `${contextPrefix ? `${contextPrefix}\n\n` : ''}You are an expert WhatsApp marketer. Create a WhatsApp sales sequence for event attendees.\n\nService: ${capturedService.name}\nEvent: ${capturedInput.eventDetails?.eventName || "Event"}\nOffer: ${capturedInput.eventDetails?.offerName || "Offer"}\nPrice: ${capturedInput.eventDetails?.price || "Price"}\n\n${socialProofGuidance}\n\n${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}\n\nGenerate exactly ${capturedInput.sequenceLength} WhatsApp messages. Each message: 50-100 words, personal, conversational, emojis, clear CTA, use [First Name] for personalization.\n\nReturn as a JSON object with a 'messages' key containing the array.`;
          }

          const response = await invokeLLM({ messages: [{ role: "system", content: "You are an expert WhatsApp marketer specializing in high-converting WhatsApp sequences for coaches, speakers, and consultants. Always respond with valid JSON." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "whatsapp_sequence", strict: true, schema: { type: "object", properties: { messages: { type: "array", items: { type: "object", properties: { day: { type: "integer" }, message: { type: "string" }, cta: { type: "string" } }, required: ["day", "message", "cta"], additionalProperties: false } } }, required: ["messages"], additionalProperties: false } } } });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") throw new Error("Invalid response format from AI");
          let sequenceData = JSON.parse(stripMarkdownJson(content));
          if (Array.isArray(sequenceData)) sequenceData = { messages: sequenceData };
          if (!sequenceData.messages || !Array.isArray(sequenceData.messages)) throw new Error("LLM did not return a valid messages array");
          sequenceData.messages = sequenceData.messages.map((msg: any, idx: number) => ({ text: msg.message || msg.text || `Message ${idx + 1}: Check this out`, delay: msg.delay || (idx * 24), delayUnit: msg.delayUnit || 'hours', mediaUrl: msg.mediaUrl || null, mediaType: msg.mediaType || null }));

          const insertResult: any = await bgDb.insert(whatsappSequences).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, sequenceType: capturedInput.sequenceType, name: capturedInput.name, messages: sequenceData.messages });
          const [newSequence] = await bgDb.select().from(whatsappSequences).where(eq(whatsappSequences.id, insertResult[0].insertId)).limit(1);

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newSequence?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[whatsappSequences.generateAsync] Job ${jobId} completed, sequenceId: ${newSequence?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[whatsappSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update WhatsApp sequence
  update: protectedProcedure
    .input(updateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .update(whatsappSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(whatsappSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Delete WhatsApp sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .delete(whatsappSequences)
        .where(eq(whatsappSequences.id, input.id));

      return { success: true };
    }),

  // Get most recent WhatsApp sequence for a given serviceId (generation history)
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [latest] = await db
        .select()
        .from(whatsappSequences)
        .where(and(eq(whatsappSequences.userId, ctx.user.id), eq(whatsappSequences.serviceId, input.serviceId)))
        .orderBy(desc(whatsappSequences.createdAt))
        .limit(1);
      return latest ?? null;
    }),
});
