import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { filterRecord, getGlobalNegativePrompts } from "../lib/complianceFilter";

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
  // AI-expanded onboarding fields (Item 1.1 — Build Plan March 1 2026)
  falseBeliefsVsRealReasons: z.string().optional(),
  failedSolutions: z.string().optional(),
  hiddenReasons: z.string().optional(),
  riskReversal: z.string().optional(),
  uniqueMechanismSuggestion: z.string().optional(),
  painPoints: z.string().optional(),
  // Program Vault fields (W0 sprint)
  bonuses: z.string().optional(), // JSON array string
  guaranteeDuration: z.string().max(100).optional(),
  guaranteeType: z.string().max(255).optional(),
  deliveryFormat: z.enum(["live", "online", "hybrid"]).optional(),
  deliveryDuration: z.string().max(100).optional(),
  paymentPlan: z.string().max(255).optional(),
  earlyBirdPrice: z.number().optional(),
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

  /**
   * AI Profile Expansion — Item 1.1 (Build Plan March 1 2026)
   *
   * Called immediately after services.create during onboarding.
   * Uses the exact LLM prompt specified in the build plan.
   * Saves all 10 expanded fields to the service record BEFORE returning,
   * so values are persisted even if the user skips the review screen.
   */
  expandProfile: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership and get the service record
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!service) throw new Error("Service not found");

      // Determine which fields need to be generated vs already filled
      // Treat placeholder values ("To be defined") as empty — same logic as frontend
      const isPlaceholder = (v: string | null | undefined) =>
        !v?.trim() || v.trim().toLowerCase() === 'to be defined';
      const needsDescription = isPlaceholder(service.description);
      const needsTargetCustomer = isPlaceholder(service.targetCustomer);
      const needsMainBenefit = isPlaceholder(service.mainBenefit);

      const prompt = `You are a world-class direct response copywriter and market researcher.

A coach/consultant has described their service:
- Name: ${service.name}${service.description?.trim() ? `\n- Description: ${service.description}` : ""}${service.targetCustomer?.trim() ? `\n- Target Customer: ${service.targetCustomer}` : ""}${service.mainBenefit?.trim() ? `\n- Main Benefit: ${service.mainBenefit}` : ""}

Based on this service name${!service.targetCustomer?.trim() || !service.mainBenefit?.trim() ? " (and any other details provided)" : ""}, generate a complete marketing intelligence profile for a coach in this niche.
Be specific — not generic. Use language their customer would actually use.

Return JSON with these exact fields:
{
  "description": "A compelling 1-2 sentence description of what this service does and who it's for",
  "targetCustomer": "Specific demographic and psychographic description of the ideal customer (age, situation, desire)",
  "mainBenefit": "The single biggest transformation or result the customer gets — specific and outcome-focused",
  "painPoints": "3-5 specific pain points their customer feels daily",
  "falseBeliefsVsRealReasons": "3-5 pairs in format: what customer thinks is stopping them | what is really stopping them",
  "failedSolutions": "3-5 things they have tried before and exactly why each one failed for this specific audience",
  "hiddenReasons": "3-5 less-known real reasons behind their problem they would never admit or don't know",
  "whyProblemExists": "The root cause of the problem at a deep level",
  "uniqueMechanismSuggestion": "A compelling proprietary-sounding name for how this service solves the problem",
  "hvcoTopicSuggestion": "A specific lead magnet title that would attract this exact customer",
  "riskReversalSuggestion": "A compelling guarantee that removes the risk of buying",
  "avatarName": "A realistic first name for the ideal customer",
  "avatarTitle": "Their job title or life situation in 3-5 words"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a world-class direct response copywriter. Always return valid JSON only, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
            json_schema: {
            name: "service_profile_expansion",
            strict: true,
            schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                targetCustomer: { type: "string" },
                mainBenefit: { type: "string" },
                painPoints: { type: "string" },
                falseBeliefsVsRealReasons: { type: "string" },
                failedSolutions: { type: "string" },
                hiddenReasons: { type: "string" },
                whyProblemExists: { type: "string" },
                uniqueMechanismSuggestion: { type: "string" },
                hvcoTopicSuggestion: { type: "string" },
                riskReversalSuggestion: { type: "string" },
                avatarName: { type: "string" },
                avatarTitle: { type: "string" },
              },
              required: [
                "description",
                "targetCustomer",
                "mainBenefit",
                "painPoints",
                "falseBeliefsVsRealReasons",
                "failedSolutions",
                "hiddenReasons",
                "whyProblemExists",
                "uniqueMechanismSuggestion",
                "hvcoTopicSuggestion",
                "riskReversalSuggestion",
                "avatarName",
                "avatarTitle",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0].message.content;
      let expanded: Record<string, unknown>;

      // Helper: try to parse JSON from a string, stripping markdown fences first
      const tryParse = (s: string): Record<string, unknown> | null => {
        try {
          const stripped = s
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();
          return JSON.parse(stripped);
        } catch {
          return null;
        }
      };

      if (typeof rawContent !== "string") {
        // Already a parsed object (some LLM backends return objects directly)
        expanded = rawContent as unknown as Record<string, string>;
      } else {
        const parsed = tryParse(rawContent);
        if (parsed) {
          expanded = parsed;
        } else {
          // Claude sometimes wraps JSON in a preamble — find the first '{' and parse from there
          const firstBrace = rawContent.indexOf('{');
          const lastBrace = rawContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonSlice = rawContent.slice(firstBrace, lastBrace + 1);
            const sliceParsed = tryParse(jsonSlice);
            if (sliceParsed) {
              expanded = sliceParsed;
            } else {
              console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
              throw new Error("AI returned invalid JSON during profile expansion");
            }
          } else {
            console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
            throw new Error("AI returned invalid JSON during profile expansion");
          }
        }
      }

      // Helper to normalize a field: join arrays to newline-separated string, then truncate
      const normalize = (v: unknown, max: number): string => {
        if (Array.isArray(v)) return v.map(String).join('\n').slice(0, max);
        if (typeof v === 'string') return v.slice(0, max);
        if (v == null) return '';
        return String(v).slice(0, max);
      };
      const trunc = normalize; // alias for clarity

      // Compliance pre-filter on AI-generated service fields before DB write
      const SERVICE_FILTER_FIELDS = ["painPoints", "targetCustomer", "description", "mainBenefit", "falseBeliefsVsRealReasons", "failedSolutions", "hiddenReasons"];
      const { cleaned: cleanedServiceData, classification: serviceClassification, allFlaggedTerms: serviceFlaggedTerms } = filterRecord(expanded, SERVICE_FILTER_FIELDS);
      if (serviceClassification === "REJECTED") {
        throw new Error(`Generated service content contained prohibited language. Please regenerate. Flagged: ${serviceFlaggedTerms.join("; ")}`);
      }
      const filteredExpanded = { ...expanded, ...cleanedServiceData };

      // Map LLM field names to DB column names.
      // Only overwrite fields that were empty — never overwrite user-filled content.
      // Truncate to column limits: text = 65535, varchar(300) = 300, varchar(100) = 100
      const updateFields: Record<string, string> = {
        // Always overwrite deep-research fields (not user-editable in the form)
        painPoints: trunc(filteredExpanded.painPoints, 65535),
        falseBeliefsVsRealReasons: trunc(filteredExpanded.falseBeliefsVsRealReasons, 65535),
        failedSolutions: trunc(filteredExpanded.failedSolutions, 65535),
        hiddenReasons: trunc(filteredExpanded.hiddenReasons, 65535),
        whyProblemExists: trunc(filteredExpanded.whyProblemExists, 65535),
        riskReversal: trunc(filteredExpanded.riskReversalSuggestion, 65535),
        avatarName: trunc(filteredExpanded.avatarName, 100),
        avatarTitle: trunc(filteredExpanded.avatarTitle, 100),
        // Only overwrite user-visible fields if they were empty
        ...(needsDescription && filteredExpanded.description ? { description: trunc(filteredExpanded.description, 65535) } : {}),
        ...(needsTargetCustomer && filteredExpanded.targetCustomer ? { targetCustomer: trunc(filteredExpanded.targetCustomer, 65535) } : {}),
        ...(needsMainBenefit && filteredExpanded.mainBenefit ? { mainBenefit: trunc(filteredExpanded.mainBenefit, 65535) } : {}),
        uniqueMechanismSuggestion: trunc(filteredExpanded.uniqueMechanismSuggestion, 65535),
        hvcoTopic: trunc(filteredExpanded.hvcoTopicSuggestion, 300),
      };

      // REQUIREMENT 3: Save to DB BEFORE returning — persists even if user skips review
      try {
        await db
          .update(services)
          .set({ ...updateFields, updatedAt: new Date() })
          .where(eq(services.id, input.serviceId));
      } catch (dbErr: unknown) {
        const e = dbErr as { code?: string; sqlMessage?: string; message?: string };
        console.error('[expandProfile] DB update failed:', {
          code: e.code,
          sqlMessage: e.sqlMessage,
          message: e.message,
          fieldLengths: Object.fromEntries(
            Object.entries(updateFields).map(([k, v]) => [k, typeof v === 'string' ? v.length : v])
          ),
        });
        throw dbErr;
      }

      // Return the expanded fields so the review screen can display them
      // Always include all generated fields (even if not saved to DB) so frontend can pre-fill form
      const expandedResult = {
        painPoints: updateFields.painPoints || '',
        falseBeliefsVsRealReasons: updateFields.falseBeliefsVsRealReasons || '',
        failedSolutions: updateFields.failedSolutions || '',
        hiddenReasons: updateFields.hiddenReasons || '',
        whyProblemExists: updateFields.whyProblemExists || '',
        riskReversal: updateFields.riskReversal || '',
        avatarName: updateFields.avatarName || '',
        avatarTitle: updateFields.avatarTitle || '',
        uniqueMechanismSuggestion: updateFields.uniqueMechanismSuggestion || '',
        hvcoTopic: updateFields.hvcoTopic || '',
        // Include user-visible generated fields even if they weren't saved (already had content)
        targetCustomer: trunc(expanded.targetCustomer, 65535) || updateFields.targetCustomer || '',
        mainBenefit: trunc(expanded.mainBenefit, 65535) || updateFields.mainBenefit || '',
        description: trunc(expanded.description, 65535) || updateFields.description || '',
      };
      return {
        serviceId: input.serviceId,
        expanded: expandedResult,
      };
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

  /**
   * W0 Program Vault — Extract structured program data from a document via LLM.
   * Saves all extracted non-null fields to the service record before returning.
   */
  extractProgramVault: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      rawText: z.string().min(1, "Document text is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!service) throw new Error("Service not found");

      const prompt = `You are extracting structured program details from a document.
Extract exactly these fields if present in the text below. Return ONLY valid JSON.
If a field is not found in the document, return null for that field.

Fields to extract:
- programName: string or null
- description: string or null (1-2 sentences about what the program does)
- targetCustomer: string or null (who it's for)
- mainBenefit: string or null (the main result/transformation)
- price: string or null (full program price, e.g. "£3,000")
- paymentPlan: string or null (e.g. "3 x £1,000")
- earlyBirdPrice: string or null (e.g. "£2,500")
- bonuses: array or null (each item: {name: string, value: string, description: string})
- guaranteeDuration: string or null (e.g. "90 days")
- guaranteeType: string or null (e.g. "Full refund", "Results or money back")
- deliveryFormat: "live" | "online" | "hybrid" | null
- deliveryDuration: string or null (e.g. "12 weeks", "6 months")
- testimonial1Name: string or null
- testimonial1Title: string or null
- testimonial1Quote: string or null
- testimonial2Name: string or null
- testimonial2Title: string or null
- testimonial2Quote: string or null
- testimonial3Name: string or null
- testimonial3Title: string or null
- testimonial3Quote: string or null
- socialProofStat: string or null (e.g. "900,000 students trained")
- pressFeatures: string or null (comma-separated press mentions)

Document text:
${input.rawText.slice(0, 12000)}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a structured data extractor. Return only valid JSON with no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0].message.content;
      let extracted: Record<string, any>;
      try {
        const cleaned = typeof raw === "string"
          ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
          : JSON.stringify(raw);
        extracted = JSON.parse(cleaned);
      } catch {
        throw new Error("AI returned invalid JSON during vault extraction");
      }

      // Build update payload — only save non-null, non-empty values
      const updates: Record<string, any> = { updatedAt: new Date() };
      const str = (v: any, max = 65535) => (typeof v === "string" && v.trim()) ? v.trim().slice(0, max) : null;

      if (str(extracted.programName) && !service.name.trim()) updates.name = str(extracted.programName, 255)!;
      if (str(extracted.description) && !service.description?.trim()) updates.description = str(extracted.description)!;
      if (str(extracted.targetCustomer)) updates.targetCustomer = str(extracted.targetCustomer, 500)!;
      if (str(extracted.mainBenefit)) updates.mainBenefit = str(extracted.mainBenefit, 500)!;
      if (str(extracted.price)) {
        const priceNum = parseFloat(String(extracted.price).replace(/[£$€,\s]/g, ""));
        if (!isNaN(priceNum)) updates.price = priceNum.toFixed(2);
      }
      if (str(extracted.paymentPlan)) updates.paymentPlan = str(extracted.paymentPlan, 255)!;
      if (str(extracted.earlyBirdPrice)) {
        const ebNum = parseFloat(String(extracted.earlyBirdPrice).replace(/[£$€,\s]/g, ""));
        if (!isNaN(ebNum)) updates.earlyBirdPrice = ebNum.toFixed(2);
      }
      if (Array.isArray(extracted.bonuses) && extracted.bonuses.length > 0) {
        updates.bonuses = JSON.stringify(extracted.bonuses.slice(0, 5));
      }
      if (str(extracted.guaranteeDuration)) updates.guaranteeDuration = str(extracted.guaranteeDuration, 100)!;
      if (str(extracted.guaranteeType)) updates.guaranteeType = str(extracted.guaranteeType, 255)!;
      if (["live", "online", "hybrid"].includes(extracted.deliveryFormat)) updates.deliveryFormat = extracted.deliveryFormat;
      if (str(extracted.deliveryDuration)) updates.deliveryDuration = str(extracted.deliveryDuration, 100)!;
      if (str(extracted.testimonial1Name)) updates.testimonial1Name = str(extracted.testimonial1Name, 255)!;
      if (str(extracted.testimonial1Title)) updates.testimonial1Title = str(extracted.testimonial1Title, 255)!;
      if (str(extracted.testimonial1Quote)) updates.testimonial1Quote = str(extracted.testimonial1Quote)!;
      if (str(extracted.testimonial2Name)) updates.testimonial2Name = str(extracted.testimonial2Name, 255)!;
      if (str(extracted.testimonial2Title)) updates.testimonial2Title = str(extracted.testimonial2Title, 255)!;
      if (str(extracted.testimonial2Quote)) updates.testimonial2Quote = str(extracted.testimonial2Quote)!;
      if (str(extracted.testimonial3Name)) updates.testimonial3Name = str(extracted.testimonial3Name, 255)!;
      if (str(extracted.testimonial3Title)) updates.testimonial3Title = str(extracted.testimonial3Title, 255)!;
      if (str(extracted.testimonial3Quote)) updates.testimonial3Quote = str(extracted.testimonial3Quote)!;
      if (str(extracted.socialProofStat)) updates.socialProofStat = str(extracted.socialProofStat, 255)!;
      if (str(extracted.pressFeatures)) updates.pressFeatures = str(extracted.pressFeatures)!;

      if (Object.keys(updates).length > 1) {
        await db.update(services).set(updates).where(eq(services.id, input.serviceId));
      }

      // Return the raw extracted object so client can display confirmation screen
      return { serviceId: input.serviceId, extracted };
    }),

  /**
   * W0 Program Vault — Parse a file (PDF or plain text) from base64 and return extracted text.
   * Client passes base64-encoded file content and mimeType.
   */
  parseVaultFile: protectedProcedure
    .input(z.object({
      base64: z.string().min(1),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");

      // Plain text
      if (input.mimeType === "text/plain") {
        return { text: buffer.toString("utf-8").slice(0, 50000) };
      }

      // PDF
      if (input.mimeType === "application/pdf") {
        try {
          // Dynamic import to avoid bundling issues
          const pdfParse = (await import("pdf-parse")).default;
          const result = await pdfParse(buffer);
          return { text: result.text.slice(0, 50000) };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`PDF parsing failed: ${msg}`);
        }
      }

      // Word documents — extract as plain text (strip XML tags)
      if (
        input.mimeType === "application/msword" ||
        input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        try {
          const mammoth = (await import("mammoth")).default;
          const result = await mammoth.extractRawText({ buffer });
          return { text: result.value.slice(0, 50000) };
        } catch {
          // Fall back to raw buffer as text
          return { text: buffer.toString("utf-8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000) };
        }
      }

      throw new Error(`Unsupported file type: ${input.mimeType}. Please upload a PDF, Word document, or plain text file.`);
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
