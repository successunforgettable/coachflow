import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { whatsappSequences, services, campaigns, idealCustomerProfiles, sourceOfTruth } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateWhatsAppSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["engagement", "sales"]),
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

      // ICP query — Item 1.2
      const [icp] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.serviceId, input.serviceId))
        .limit(1);

      const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : ''}
`.trim() : '';

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

      // Campaign type fetch — Item 1.5
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
      }

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
        prompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 3-message WhatsApp engagement sequence for event attendees.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Host: ${input.eventDetails?.hostName || "Host"}
Event Date: ${input.eventDetails?.eventDate || "Date"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Create 3 WhatsApp messages (Monday, Wednesday, Friday before event):
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

Format as JSON array.`;
      } else {
        // sales sequence
        prompt = `${sotContext ? `${sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 3-message WhatsApp sales sequence for event attendees.

Service: ${service.name}
Event: ${input.eventDetails?.eventName || "Event"}
Offer: ${input.eventDetails?.offerName || "Offer"}
Price: ${input.eventDetails?.price || "Price"}

${socialProofGuidance}

${campaignTypeContext ? `${campaignTypeContext}\n\n` : ''}${icpContext}

Create 3 WhatsApp messages (Day 1, 3, 5 after event):
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

Format as JSON array.`;
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
      const sequenceData = JSON.parse(content);

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
});
