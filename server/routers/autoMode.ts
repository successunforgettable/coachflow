/**
 * Auto Mode Phase B2 — autoMode router.
 *
 * Single mutation `orchestrate` that enqueues a multi-step generation job.
 * The orchestration handler in server/_core/orchestration.ts runs the 8-step
 * cascade (offer → mechanism → hvco → headlines → adCopy → landingPage →
 * emailSequence → whatsappSequence) outside the HTTP request cycle via
 * setImmediate.
 *
 * Returns jobId immediately. Client polls /api/jobs/:jobId every 5s for
 * status + progress (Phase B3's V2AutoModeProgress UI consumes the
 * progress.label strings from runOrchestration's writeProgress calls).
 *
 * Status transitions:
 *   pending (insert here) → running (orchestration handler's first DB write,
 *   pre-LLM, escapes the 5-min reaper) → complete | failed (orchestration
 *   handler's terminal write).
 *
 * v1 retry semantics (locked): on failure, job is marked 'failed' with
 * error message; orchestration's skip-already-populated logic lets a
 * re-triggered run resume from the failed step (DB rows already inserted
 * for prior steps stay in place).
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, idealCustomerProfiles, offers, heroMechanisms, hvcoTitles, services } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runOrchestration, runOrchestrationStep, ORCHESTRATION_STEP_NAMES, type OrchestrationStepName } from "../_core/orchestration";
import { autoSelectBest } from "./campaignKits";
import { complianceFilter, filterRecord } from "../lib/complianceFilter";
import { invokeLLM } from "../_core/llm";

/**
 * Phase C C0: Auto Mode tier gate.
 *
 * Auto Mode is a paid-only feature. Per the locked Phase C product
 * decisions (Sprint B+1 path d completion + Phase C scope writeup):
 *   - Free-tier ("trial") users would consume their entire trial
 *     allotment of ad creatives in one cascade (FREE_TIER_AD_IMAGE_LIMIT
 *     = 2 vs 5 generated per Auto Mode run)
 *   - Per-asset quotas live at the per-router tRPC layer; Auto Mode's
 *     runX cores bypass them (B1 design), so trial users would burn
 *     through 8 quota slots per cascade — bad UX and bad economics
 *   - The greeting overlay CTA promises a launchable campaign; gating
 *     mid-flow is worse UX than gating at intake
 *
 * Backend FORBIDDEN check is mandatory (belt-and-suspenders behind the
 * V2AutoModeIntake frontend gate). Free-tier users hitting the endpoint
 * directly (or via stale frontend cache) get a clean tRPC error.
 *
 * Pure helper extracted for unit-testability — the mutation calls it
 * with ctx.user; tests call it directly with synthetic user shapes.
 *
 * Subscription tiers (drizzle/schema.ts: `["trial", "pro", "agency"]`):
 *   - trial: blocked (free-equivalent entry tier)
 *   - pro / agency: allowed
 *   - null/missing subscriptionTier: blocked (defensive — defaults to
 *     trial per schema, but coerce explicitly)
 *
 * Role bypass: `superuser` AND `admin` always allowed regardless of tier
 * (matches V2GeneratorWizard's existing isFreeTier client-side predicate
 * which already treats both roles as bypassing — and C0.1 client/server
 * predicate mirror per Phase F sequencing decision). Admin is an
 * internal-only role never held by customers, so bypass is safe and
 * keeps Auto Mode consistent with the wizard's gating model.
 *
 * Pure helper, single call site at autoMode.orchestrate below. No
 * cross-router dependency — this change does not widen bypass behavior
 * on any other tier gate (per-router quota checks at adCopy.ts:203,
 * adCreatives.ts:123, etc. remain unaffected).
 */
export function isAutoModeTierAllowed(user: {
  role: string;
  subscriptionTier: string | null | undefined;
}): { allowed: boolean; reason?: string } {
  if (user.role === "superuser" || user.role === "admin") return { allowed: true };
  const tier = user.subscriptionTier;
  if (tier === "pro" || tier === "agency") return { allowed: true };
  return {
    allowed: false,
    reason:
      "Auto Mode is a Pro feature. Upgrade your subscription to unlock the 1-click campaign builder.",
  };
}

const orchestrateSchema = z.object({
  serviceId: z.number(),
  icpId: z.number(),
  campaignType: z
    .enum(["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"])
    .optional(),
});

export const autoModeRouter = router({
  /**
   * orchestrate — kick off the 8-step Auto Mode generation job.
   * Quota enforcement is upstream (intake screen handles entry-gate; per-
   * generator quotas would otherwise fire mid-cascade and partially
   * complete — undesirable UX). Orchestrator skips per-generator quota
   * checks by calling runX cores directly (which omit quota checks per the
   * B1 pattern — quota lives in the wizard's tRPC mutation wrappers).
   *
   * If a per-generator quota IS hit mid-cascade (e.g. user upgraded mid-
   * run), it surfaces as a step failure with the tRPC FORBIDDEN message
   * via runX → throw → orchestrator catch → mark job failed.
   */
  orchestrate: protectedProcedure
    .input(orchestrateSchema)
    .mutation(async ({ ctx, input }) => {
      // Phase C C0: tier gate. Trial-tier users must upgrade to use Auto
      // Mode. Superuser bypass per existing quota-check convention.
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;

      const jobId = randomUUID();
      await db.insert(jobs).values({
        id: jobId,
        userId: String(capturedUserId),
        status: "pending",
      });

      setImmediate(async () => {
        try {
          await runOrchestration({
            jobId,
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            icpId: capturedInput.icpId,
            campaignType: capturedInput.campaignType,
          });
          console.log(`[autoMode.orchestrate] Job ${jobId} completed.`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[autoMode.orchestrate] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb = await getDb();
            if (bgDb) {
              await bgDb.update(jobs)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eq(jobs.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * orchestrateStep — Trail Sprint 3 C1: run ONE cascade node as its own job.
   *
   * The chat-paced Trail loop (spec §5.1) drives the cascade node by node:
   * reveal → chips → next step request. Same tier ground-truth gate as
   * orchestrate; same jobs/poll pattern (a synchronous step mutation would
   * re-create the B3.3 Railway proxy-timeout failure for 30-120s LLM calls).
   *
   * Job result payload: { stepName, skipped, generatedId, kitField } —
   * the client reveals from kit.selected*Id (committed by autoSelectBest
   * inside the step, before the job flips complete).
   */
  orchestrateStep: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number(),
      step: z.enum(ORCHESTRATION_STEP_NAMES as [OrchestrationStepName, ...OrchestrationStepName[]]),
      campaignType: z
        .enum(["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"])
        .optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;
      const stepIndex = ORCHESTRATION_STEP_NAMES.indexOf(input.step) + 1;
      const totalSteps = ORCHESTRATION_STEP_NAMES.length;

      const jobId = randomUUID();
      await db.insert(jobs).values({
        id: jobId,
        userId: String(capturedUserId),
        status: "pending",
      });

      setImmediate(async () => {
        const bgDb = await getDb();
        try {
          // pending → running before the LLM call (reaper immunity, same
          // ordering rule as runOrchestration).
          if (bgDb) {
            await bgDb.update(jobs)
              .set({ status: "running", progress: JSON.stringify({ step: stepIndex, total: totalSteps, label: `Starting ${capturedInput.step}…` }) })
              .where(eq(jobs.id, jobId));
          }

          const result = await runOrchestrationStep(
            {
              userId: capturedUserId,
              serviceId: capturedInput.serviceId,
              icpId: capturedInput.icpId,
              campaignType: capturedInput.campaignType,
            },
            capturedInput.step,
            async (label) => {
              if (!bgDb) return;
              await bgDb.update(jobs)
                .set({ progress: JSON.stringify({ step: stepIndex, total: totalSteps, label }) })
                .where(eq(jobs.id, jobId));
            },
          );

          if (bgDb) {
            await bgDb.update(jobs)
              .set({
                status: "complete",
                result: JSON.stringify({
                  stepName: capturedInput.step,
                  skipped: result.skipped,
                  generatedId: result.generatedId,
                  kitField: result.kitField,
                }),
              })
              .where(eq(jobs.id, jobId));
          }
          console.log(`[autoMode.orchestrateStep] Job ${jobId} (${capturedInput.step}) completed.`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[autoMode.orchestrateStep] Job ${jobId} (${capturedInput.step}) failed:`, errorMessage);
          try {
            if (bgDb) {
              await bgDb.update(jobs)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eq(jobs.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * importIcp — synchronous ICP import for existing-assets users.
   *
   * Inserts a single ICP row with user-supplied fields and returns icpId
   * immediately (no job/polling). The Confirm screen calls this instead of
   * icps.generateAsync when the user toggles "I Have One" on the ICP card.
   *
   * Required: name. Optional: pains, goals, implementationBarriers.
   * All 14 remaining Kong tabs are left null — acceptable v1 tradeoff
   * (generators that read those tabs produce less personalised output,
   * but the cascade still runs end-to-end).
   */
  importIcp: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      name: z.string().min(1).max(255),
      pains: z.string().max(2000).optional(),
      goals: z.string().max(2000).optional(),
      implementationBarriers: z.string().max(2000).optional(),
      demographics: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Compliance gate — filter imported ICP fields before DB write
      const icpFields = { name: input.name, pains: input.pains || "", goals: input.goals || "", implementationBarriers: input.implementationBarriers || "", demographics: input.demographics || "" };
      const { cleaned: cleanedIcp, classification: icpClassification, allFlaggedTerms: icpFlaggedTerms } = filterRecord(
        icpFields,
        ["name", "pains", "goals", "implementationBarriers", "demographics"]
      );
      if (icpClassification === "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your ICP description contains language that Meta's ad policies prohibit: ${icpFlaggedTerms.join("; ")}. Please rephrase and try again.`,
        });
      }

      const result: any = await db.insert(idealCustomerProfiles).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        name: cleanedIcp.name,
        pains: cleanedIcp.pains || null,
        goals: cleanedIcp.goals || null,
        implementationBarriers: cleanedIcp.implementationBarriers || null,
        demographics: cleanedIcp.demographics ? { ageRange: cleanedIcp.demographics } : null,
        source: "imported",
      });

      return {
        icpId: result[0].insertId as number,
        complianceApplied: icpClassification === "PIVOT_REQUIRED",
        flaggedTerms: icpFlaggedTerms,
      };
    }),

  /**
   * importAssets — pre-populate kit slots for user-imported assets.
   *
   * Called between icpId-resolve and orchestrate on the Confirm screen.
   * For each provided asset (offer, mechanism, hvco), inserts one row
   * into the target table with source='imported', then calls
   * autoSelectBest to write the kit slot. The orchestrator's
   * skip-already-populated logic (orchestration.ts:191-196) then skips
   * these steps on the first cascade run.
   *
   * All three asset fields are optional — only populated for assets
   * where the user toggled "I Have One". Blank-slate users skip this
   * call entirely (or call with no assets — both work).
   */
  importAssets: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number(),
      offer: z.object({
        name: z.string().min(1).max(500),
        valueProposition: z.string().min(1).max(2000),
        cta: z.string().min(1).max(500),
      }).optional(),
      mechanism: z.object({
        name: z.string().min(1).max(255),
        description: z.string().min(1).max(2000),
      }).optional(),
      hvco: z.object({
        title: z.string().min(1).max(500),
        topic: z.string().min(1).max(2000),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch service for auto-populating context fields
      const [svc] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      const targetMarket = svc?.targetCustomer || "";

      let allFlaggedTerms: string[] = [];
      let anyComplianceApplied = false;

      // --- Offer ---
      if (input.offer) {
        const offerFields = {
          name: input.offer.name,
          valueProposition: input.offer.valueProposition,
          cta: input.offer.cta,
        };
        const { cleaned: cleanedOffer, classification: offerClass, allFlaggedTerms: offerFlags } = filterRecord(
          offerFields,
          ["name", "valueProposition", "cta"]
        );
        if (offerClass === "REJECTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Your offer contains language that Meta's ad policies prohibit: ${offerFlags.join("; ")}. Please rephrase the flagged phrases.`,
          });
        }
        allFlaggedTerms.push(...offerFlags);
        if (offerClass === "PIVOT_REQUIRED") anyComplianceApplied = true;

        const offerResult: any = await db.insert(offers).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          productName: cleanedOffer.name,
          activeAngle: "godfather",
          godfatherAngle: {
            offerName: cleanedOffer.name,
            valueProposition: cleanedOffer.valueProposition,
            cta: cleanedOffer.cta,
            pricing: "",
            bonuses: "",
            guarantee: "",
            urgency: "",
          },
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedOfferId", offerResult[0].insertId);
      }

      // --- Mechanism ---
      if (input.mechanism) {
        const mechFields = { name: input.mechanism.name, description: input.mechanism.description };
        const { cleaned: cleanedMech, classification: mechClass, allFlaggedTerms: mechFlags } = filterRecord(
          mechFields, ["name", "description"]
        );
        if (mechClass === "REJECTED") {
          throw new TRPCError({ code: "BAD_REQUEST",
            message: `Your method description contains prohibited language: ${mechFlags.join("; ")}. Please rephrase.`,
          });
        }
        allFlaggedTerms.push(...mechFlags);
        if (mechClass === "PIVOT_REQUIRED") anyComplianceApplied = true;

        const mechResult: any = await db.insert(heroMechanisms).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          mechanismSetId: nanoid(),
          tabType: "hero_mechanisms",
          mechanismName: cleanedMech.name,
          mechanismDescription: cleanedMech.description,
          targetMarket,
          pressingProblem: "",
          whyProblem: "",
          whatTried: "",
          whyExistingNotWork: "",
          desiredOutcome: "",
          credibility: "",
          socialProof: "",
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedMechanismId", mechResult[0].insertId);
      }

      // --- HVCO (lead magnet / free opt-in) ---
      if (input.hvco) {
        const hvcoFields = { title: input.hvco.title, topic: input.hvco.topic };
        const { cleaned: cleanedHvco, classification: hvcoClass, allFlaggedTerms: hvcoFlags } = filterRecord(
          hvcoFields, ["title", "topic"]
        );
        if (hvcoClass === "REJECTED") {
          throw new TRPCError({ code: "BAD_REQUEST",
            message: `Your lead magnet description contains prohibited language: ${hvcoFlags.join("; ")}. Please rephrase.`,
          });
        }
        allFlaggedTerms.push(...hvcoFlags);
        if (hvcoClass === "PIVOT_REQUIRED") anyComplianceApplied = true;

        const hvcoResult: any = await db.insert(hvcoTitles).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          hvcoSetId: nanoid(),
          tabType: "long",
          title: cleanedHvco.title,
          targetMarket,
          hvcoTopic: cleanedHvco.topic,
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedHvcoId", hvcoResult[0].insertId);
      }

      return {
        success: true,
        complianceApplied: anyComplianceApplied,
        flaggedTerms: allFlaggedTerms,
      };
    }),

  extractFromAssets: protectedProcedure
    .input(z.object({
      rawText: z.string().min(50, "Need at least 50 characters to extract useful assets.").max(150000, "Your material is very large. Try uploading fewer files or the most important one — I work best with focused content."),
    }))
    .mutation(async ({ input }) => {
      // Intelligent truncation: if text exceeds 100k chars, truncate at a
      // sentence boundary. Real coaching docs rarely exceed this, but
      // concatenated multi-file uploads might. The LLM extracts from whatever
      // is present — truncation loses tail content but the most important
      // material (offer, method, ICP) is typically at the start.
      const MAX_EXTRACT_CHARS = 100_000;
      let rawText = input.rawText;
      if (rawText.length > MAX_EXTRACT_CHARS) {
        const truncated = rawText.slice(0, MAX_EXTRACT_CHARS);
        const lastSentence = truncated.lastIndexOf(".");
        rawText = lastSentence > MAX_EXTRACT_CHARS * 0.8
          ? truncated.slice(0, lastSentence + 1)
          : truncated;
      }

      const systemPrompt = `You extract structured marketing assets from raw material provided by coaches, speakers, and consultants. The user has uploaded or pasted their existing business documents — sales pages, course outlines, offer descriptions, testimonials, or any combination.

Your job: identify and extract every recognisable marketing asset from the text. The user will review your extraction on a confirmation screen and correct anything wrong. Accuracy about what IS present matters more than completeness — an empty field the user fills in is always better than an invented field the user must delete.

ASSET CATEGORIES TO EXTRACT:

1. ICP (Ideal Customer Profile)
   - name: one-line descriptor of who they serve, in the user's own language (verbatim from source, ≤ 120 chars)
   - pains: what problems/frustrations/fears the ICP faces, as described in the source material
   - goals: what outcomes/desires the ICP wants
   - demographics: any age, profession, location, or life-stage details mentioned
   - implementationBarriers: what has stopped the ICP from solving this before

2. OFFER
   - name: the product/programme name exactly as it appears in the source (verbatim, ≤ 120 chars). If the source uses a pronoun ("my X programme"), extract the actual programme name without the pronoun and without adding the creator's name. "my 10-Week Incredible You System" becomes "The 10-Week Incredible You System", NOT "Arfeen Khan's 10-Week Incredible You System".
   - valueProposition: what the offer delivers, in the user's own framing (≤ 500 chars)
   - pricing: any pricing information mentioned (exact figures, payment plans, currency — verbatim from source)
   - bonuses: any bonuses, extras, or included items beyond the core offer
   - guarantee: any guarantee, risk-reversal, or support promise mentioned (verbatim from source)
   - urgency: any urgency/scarcity language present (verbatim from source)
   - duration: programme length or delivery timeline
   - cta: the primary call-to-action if one is stated; otherwise empty string

3. MECHANISM (Method / Framework / System)
   - name: the method name exactly as it appears in the source (verbatim, ≤ 120 chars). Use the name from the text without adding the creator's name. If the source says "my 10-Week System", extract "The 10-Week System" — do not prepend anyone's name unless it is part of the method name in the source text itself.
   - description: how the method works — steps, phases, modules, components (≤ 500 chars)

4. HVCO (High-Value Content Offer / Lead Magnet / Free Opt-In)
   - title: the lead magnet name exactly as it appears (verbatim, ≤ 120 chars)
   - topic: what it covers and why it appeals to the ICP (≤ 300 chars)

5. TESTIMONIALS — array of objects, each with:
   - name: the person's real name as given (verbatim)
   - quote: their exact words (verbatim — character-for-character from the source. NEVER paraphrase, summarise, clean up, or improve testimonial text. If the quote contains specific income figures, timelines, or health claims, preserve them exactly as written.)
   - title: any role, location, or descriptor given (verbatim)

EXTRACTION RULES:

- VERBATIM INTEGRITY: Programme names, method names, testimonial quotes, pricing figures, and guarantee language are extracted character-for-character from the source. You identify and extract; you never rephrase, improve, or paraphrase.

- GROUNDING RULE: If a category is not present or clearly implied in the source text, return null for that entire category. Within a category, leave individual fields as empty string ("") when the information is not present.

- ONE EXTRACTION, NOT FOUR: The user may paste everything in one block. A single paragraph might contain offer details, ICP hints, and method references interleaved. Extract across the full text holistically.

- CONFIDENCE SCORING: For each top-level category, report perFieldConfidence with:
  - "high": clearly and explicitly stated in the source text
  - "medium": reasonably inferred from context
  - "low": weak inference, possibly wrong
  - "missing": not present in the source at all`;

      const userPrompt = `RAW MATERIAL (uploaded/pasted by user):

"""
${rawText}
"""

Extract all marketing assets you can identify. Return JSON matching the schema.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extract_from_assets",
            strict: true,
            schema: {
              type: "object",
              properties: {
                icp: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    pains: { type: "string" },
                    goals: { type: "string" },
                    demographics: { type: "string" },
                    implementationBarriers: { type: "string" },
                  },
                  required: ["name", "pains", "goals", "demographics", "implementationBarriers"],
                },
                offer: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    valueProposition: { type: "string" },
                    pricing: { type: "string" },
                    bonuses: { type: "string" },
                    guarantee: { type: "string" },
                    urgency: { type: "string" },
                    duration: { type: "string" },
                    cta: { type: "string" },
                  },
                  required: ["name", "valueProposition", "pricing", "bonuses", "guarantee", "urgency", "duration", "cta"],
                },
                mechanism: {
                  type: ["object", "null"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["name", "description"],
                },
                hvco: {
                  type: ["object", "null"],
                  properties: {
                    title: { type: "string" },
                    topic: { type: "string" },
                  },
                  required: ["title", "topic"],
                },
                testimonials: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      quote: { type: "string" },
                      title: { type: "string" },
                    },
                    required: ["name", "quote", "title"],
                  },
                },
                perFieldConfidence: {
                  type: "object",
                  properties: {
                    icp: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    offer: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    mechanism: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    hvco: { type: "string", enum: ["high", "medium", "low", "missing"] },
                    testimonials: { type: "string", enum: ["high", "medium", "low", "missing"] },
                  },
                  required: ["icp", "offer", "mechanism", "hvco", "testimonials"],
                },
              },
              required: ["icp", "offer", "mechanism", "hvco", "testimonials", "perFieldConfidence"],
              additionalProperties: false,
            },
          },
        },
      });

      // Handle both string and pre-parsed response shapes (same as extractFromText)
      const rawContent = response.choices[0].message.content;
      type ExtractionResult = {
        icp: { name: string; pains: string; goals: string; demographics: string; implementationBarriers: string } | null;
        offer: { name: string; valueProposition: string; pricing: string; bonuses: string; guarantee: string; urgency: string; duration: string; cta: string } | null;
        mechanism: { name: string; description: string } | null;
        hvco: { title: string; topic: string } | null;
        testimonials: Array<{ name: string; quote: string; title: string }> | null;
        perFieldConfidence: Record<string, "high" | "medium" | "low" | "missing">;
      };

      let extracted: ExtractionResult;
      if (typeof rawContent !== "string") {
        extracted = rawContent as unknown as ExtractionResult;
      } else {
        try {
          extracted = JSON.parse(rawContent);
        } catch {
          throw new Error("Asset extraction returned invalid JSON. Please try again.");
        }
      }
      return extracted;
    }),
});
