import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}
import { getDb } from "../db";
import { emailSequences, services, campaigns, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { truncateQuote } from "../_core/copywritingRules";

// ---------------------------------------------------------------------------
// Shared email prompt builders — used by generate (sync) and generateAsync.
// Per-email job structure is defined once here; both paths call these functions.
// ---------------------------------------------------------------------------

interface EmailPromptParams {
  sotContext: string;
  serviceName: string;
  campaignTypeContext: string;
  icpContext: string;
  socialProofGuidance: string;
  // welcome
  category?: string | null;
  description?: string | null;
  targetCustomer?: string | null;
  mainBenefit?: string | null;
  // engagement & sales
  eventName?: string;
  hostName?: string;
  // sales
  offerName?: string;
  price?: string;
  deadline?: string;
}

function getEmailRules(): string {
  return `ONE EMAIL ONE JOB RULE: Every email in this sequence has exactly ONE job. The entire email — subject line, body, and CTA — must serve only that one job. Nothing else. No secondary CTAs. No topic shifts.

SUBJECT LINE RULES:
- Every subject line must create curiosity or pattern interrupt — NEVER describe what the email is about
- Banned subject line patterns: "Welcome to [X]", "Here's what I promised", "Don't miss [X]", "[X] is now available"
- Good patterns: A provocative question, an incomplete statement, something unexpected, something specific and slightly strange
- Max 50 characters. Test: Would you open this if you didn't know the sender?

BODY COPY RULES:
- Welcome sequence emails: max 200 words
- Sales sequence emails: max 300 words
- Max 15 words per sentence. Max 2 sentences per paragraph. Line breaks between paragraphs.
- Grade 6 reading level. Short words. Direct language. Contractions (you're, it's, don't).
- Never use: "I hope this email finds you well", "As per my last email", "I wanted to reach out"
- Open with the most interesting sentence — not a greeting, not context-setting

PS LINE RULE: Every email MUST end with a PS. The PS must do ONE of: add a key piece of information not in the body, create additional urgency, or deepen the curiosity loop. The PS is often read first — make it pull them into the body.

CTA RULE: One CTA per email. State it once. Make it specific to the job of this email.`;
}

export function buildWelcomeEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email welcome sequence for new subscribers using Russell Brunson's Soap Opera Sequence framework.

Service: ${p.serviceName}
Category: ${p.category || ""}
Description: ${p.description || ""}
Target Customer: ${p.targetCustomer || ""}
Main Benefit: ${p.mainBenefit || ""}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

Create 3 emails. State the ONE JOB of each email before writing it.
1. DELIVER THE LEAD MAGNET + OPEN A LOOP (Day 1) — Job: Give them exactly what was promised — the lead magnet, the resource, or the access. Then open one unanswered question they need to come back for. The question must be real and specific to their situation. Do not answer it in this email. The loop must make them want to read Email 2.
2. ORIGIN STORY (Day 3) — Job: Why you do this work. One vulnerable moment (what it looked like when things were not working), one turning point (the specific thing that changed), one result (what became possible after). No selling. No pitch. The story must make them feel they are not alone in their situation.
3. PROOF (Day 5) — Job: One client story with a specific before/after. Name the situation they were in before, the specific change they made, and the specific outcome they got — a number, a named situation, or a measurable result. No generic testimonials. The story must be specific enough that the reader thinks "that could be me."

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line curiosity, max 50 chars)
- body: (max 200 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates curiosity or urgency)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildEngagementEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 5-email engagement sequence for event attendees using Russell Brunson's Soap Opera Sequence.

Service: ${p.serviceName}
Event: ${p.eventName || "Event"}
Host: ${p.hostName || "Host"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

Create 5 emails (Monday to Friday before event). State the ONE JOB of each email before writing it.
1. SET THE STAGE (Monday) — Job: Create anticipation for the event. Make them feel something valuable is coming — something they'd regret missing.
2. OPEN WITH HIGH DRAMA (Tuesday) — Job: Tell one specific story that makes the problem feel urgent and personal. No product pitch.
3. EPIPHANY (Wednesday) — Job: Reveal the insight that makes the event feel essential to attend. Not a feature list — one counterintuitive truth.
4. HIDDEN BENEFITS (Thursday) — Job: Name one specific benefit of attending that they haven't considered yet. Make showing up feel obviously worth it.
5. URGENCY & CTA (Friday) — Job: Create genuine urgency around showing up live. Name what they'll miss if they don't.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends subject line curiosity, max 50 chars)
- body: (max 200 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates curiosity or urgency)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildSalesEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 7-email sales sequence for event attendees who didn't buy.

Service: ${p.serviceName}
Event: ${p.eventName || "Event"}
Offer: ${p.offerName || "Offer"}
Price: ${p.price || "Price"}
Deadline: ${p.deadline || "Deadline"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

Create 7 emails (Day 1-7 after event). State the ONE JOB of each email before writing it.
1. THANK YOU (Day 1) — Job: Re-open the door. Thank them and name the one specific insight from the event that would have felt most personally true to someone in their situation. One clear next step at the end. Nothing else.
2. CASE STUDY (Day 2) — Job: Remove the "will it work for me?" objection. Name the specific situation the case study person was in before — it must mirror the reader's situation. Name the specific change they made. Name the specific result with a number or named outcome. The reader must think "that person was exactly like me."
3. OBJECTION HANDLING (Day 3) — Job: Name the real objection — not the polite version they'd say out loud, but the actual thought in their head. Then answer it with specifics: a number, a story, or a mechanism. Do not be defensive. Do not sell. Just dismantle the objection with evidence.
4. BONUS REVEAL (Day 4) — Job: Make the offer feel more irresistible by revealing one bonus that solves a specific problem they didn't think was included. State the specific dollar value of the bonus. Use anchoring — state total value before revealing the ask. The bonus must feel directly useful, not like padding.
5. GUARANTEE (Day 5) — Job: Remove all risk from the decision. State the exact duration, the exact result guaranteed, and the exact refund process. Make keeping their money feel riskier than spending it — name the ongoing cost of not solving this problem for one more month.
6. SCARCITY (Day 6) — Job: Make inaction feel costly and concrete. Name the specific thing that closes or changes — a cohort deadline, a price increase, or a genuine limit. Never fabricate scarcity. Name what specifically happens after the deadline.
7. FINAL CALL (Day 7) — Job: Create the last-chance moment with one clear choice. Do not introduce new information. Remind them of the one thing that matters most. Make saying yes easy. Make inaction feel like a deliberate choice with a named consequence.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends subject line curiosity, max 50 chars)
- body: (max 300 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates urgency or reveals additional stakes)

Return as a JSON object with an 'emails' key containing the array.`;
}

// ---------------------------------------------------------------------------

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
      
      // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
      // Social proof guidance for email copy
      const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers
        ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}

You MUST use these exact numbers and real names. Do not fabricate.`
        : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts, ratings, or specific testimonials
- Focus on benefit claims and transformation outcomes
- Use outcome-based stories WITHOUT specific names ("One client" instead of "John Smith")`;


      // Both sync and async use the shared builder functions — per-email job structure lives there.
      const emailPromptParams: EmailPromptParams = {
        sotContext,
        serviceName: service.name,
        campaignTypeContext,
        icpContext,
        socialProofGuidance,
        category: service.category,
        description: service.description,
        targetCustomer: service.targetCustomer,
        mainBenefit: service.mainBenefit,
        eventName: input.eventDetails?.eventName,
        hostName: input.eventDetails?.hostName,
        offerName: input.eventDetails?.offerName,
        price: input.eventDetails?.price,
        deadline: input.eventDetails?.deadline,
      };
      const prompt = input.sequenceType === "welcome"
        ? buildWelcomeEmailPrompt(emailPromptParams)
        : input.sequenceType === "engagement"
          ? buildEngagementEmailPrompt(emailPromptParams)
          : buildSalesEmailPrompt(emailPromptParams);
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. You apply the ONE EMAIL ONE JOB principle — every email has a single clear job and the entire email serves only that job. You write curiosity-driven, pattern-interrupt subject lines that are never descriptive. You write short sentences (max 15 words), short paragraphs (max 2 sentences), with line breaks between paragraphs. Every email ends with a mandatory PS that creates curiosity or urgency. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON.",
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
                      ps: { type: "string" },
                    },
                    required: ["day", "subject", "previewText", "body", "cta", "ps"],
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
      // Note: email sequences generated before commit 4d04611 may have null ps fields — the LLM
      // was returning ps but it was dropped before DB save. To find affected records run:
      // DB is MySQL/TiDB — do not use Postgres jsonb syntax.
      // SELECT id, JSON_LENGTH(emails) AS total,
      //   JSON_LENGTH(JSON_EXTRACT(emails, '$[*].ps')) AS with_ps
      // FROM email_sequences
      // WHERE JSON_LENGTH(emails) != JSON_LENGTH(JSON_EXTRACT(emails, '$[*].ps'))
      //    OR JSON_SEARCH(emails, 'one', NULL, NULL, '$[*].ps') IS NOT NULL;
      // Do not attempt to backfill — downstream display code should treat null/missing ps as empty string.
      sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({
        subject: email.subject || `Email ${idx + 1}: Check this out`,
        previewText: email.previewText || '',
        body: email.body || `This is email ${idx + 1}. Click the link to learn more.`,
        delay: email.delay || (idx * 24),
        delayUnit: email.delayUnit || 'hours',
        cta: email.cta || 'Learn More',
        ctaLink: email.ctaLink || '#',
        ps: email.ps || '',
      }));
      // Save to database
      const insertResult: any = await db.insert(emailSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        emails: sequenceData.emails,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, insertResult[0].insertId))
        .limit(1);

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
          // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
          const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers ? `REAL SOCIAL PROOF AVAILABLE:\n${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}\n${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}\n${socialProof.hasTestimonials ? `- Real testimonials:\n${(socialProof.testimonials as any[]).map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}\n\nYou MUST use these exact numbers and real names. Do not fabricate.` : `NO SOCIAL PROOF DATA PROVIDED:\n- DO NOT mention customer counts, ratings, or specific testimonials\n- Focus on benefit claims and transformation outcomes\n- Use outcome-based stories WITHOUT specific names`;

          // Use the shared builders — same per-email job structure as the sync path.
          const bgEmailParams: EmailPromptParams = {
            sotContext,
            serviceName: capturedService.name,
            campaignTypeContext,
            icpContext,
            socialProofGuidance,
            category: capturedService.category,
            description: capturedService.description,
            targetCustomer: capturedService.targetCustomer,
            mainBenefit: capturedService.mainBenefit,
            eventName: capturedInput.eventDetails?.eventName,
            hostName: capturedInput.eventDetails?.hostName,
            offerName: capturedInput.eventDetails?.offerName,
            price: capturedInput.eventDetails?.price,
            deadline: capturedInput.eventDetails?.deadline,
          };
          const prompt = capturedInput.sequenceType === "welcome"
            ? buildWelcomeEmailPrompt(bgEmailParams)
            : capturedInput.sequenceType === "engagement"
              ? buildEngagementEmailPrompt(bgEmailParams)
              : buildSalesEmailPrompt(bgEmailParams);

          const response = await invokeLLM({ messages: [{ role: "system", content: "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. You apply the ONE EMAIL ONE JOB principle — every email has a single clear job and the entire email serves only that job. You write curiosity-driven, pattern-interrupt subject lines that are never descriptive. You write short sentences (max 15 words), short paragraphs (max 2 sentences), with line breaks between paragraphs. Every email ends with a mandatory PS that creates curiosity or urgency. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "email_sequence", strict: true, schema: { type: "object", properties: { emails: { type: "array", items: { type: "object", properties: { day: { type: "integer" }, subject: { type: "string" }, previewText: { type: "string" }, body: { type: "string" }, cta: { type: "string" }, ps: { type: "string" } }, required: ["day", "subject", "previewText", "body", "cta", "ps"], additionalProperties: false } } }, required: ["emails"], additionalProperties: false } } } });

          const content = response.choices[0].message.content;
          if (typeof content !== "string") throw new Error("Invalid response format from AI");
          let sequenceData = JSON.parse(stripMarkdownJson(content));
          if (Array.isArray(sequenceData)) sequenceData = { emails: sequenceData };
          if (!sequenceData.emails || !Array.isArray(sequenceData.emails)) throw new Error("LLM did not return a valid emails array");
          sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({ subject: email.subject || `Email ${idx + 1}: Check this out`, previewText: email.previewText || '', body: email.body || `This is email ${idx + 1}. Click the link to learn more.`, delay: email.delay || (idx * 24), delayUnit: email.delayUnit || 'hours', cta: email.cta || 'Learn More', ctaLink: email.ctaLink || '#', ps: email.ps || '' }));

          const insertResult: any = await bgDb.insert(emailSequences).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, sequenceType: capturedInput.sequenceType, name: capturedInput.name, emails: sequenceData.emails });
          const [newSequence] = await bgDb.select().from(emailSequences).where(eq(emailSequences.id, insertResult[0].insertId)).limit(1);

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
