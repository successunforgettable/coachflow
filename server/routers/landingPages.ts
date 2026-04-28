import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { getQuotaLimit } from "../quotaLimits";
import { getDb } from "../db";
import { landingPages, services, users, campaigns, idealCustomerProfiles, sourceOfTruth, jobs, campaignKits, offers, heroMechanisms, hvcoTitles, coachAssets, complianceRewrites } from "../../drizzle/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { generateAllAngles } from "../landingPageGenerator";
import { getCascadeContext } from "../_core/cascadeContext";
import { invokeLLM } from "../_core/llm";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { checkCompliance } from "../lib/complianceChecker";
import { scoreItem } from "../lib/selectionScorer";
import { autoSelectBest } from "./campaignKits";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

// 12 simple-string sections that Phase 3 compliance rewrites cover.
// Phase 3 MVP — out of scope: nested-array sections (testimonials,
// consultation, FAQ, quiz). These render through different React
// components with different shape contracts; layering rewrites onto them
// is its own design problem and lands in a follow-up phase.
const LP_STRING_SECTIONS = new Set([
  "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
  "problemAgitation", "solutionIntro", "whyOldFail", "uniqueMechanism",
  "insiderAdvantages", "scarcityUrgency", "shockingStat", "timeSavingBenefit",
]);

const LP_FREE_TIER_SECTIONS = new Set(["mainHeadline", "primaryCta"]);

// Map a landing-page section to the rewrite engine's contentType, which
// drives word-count rules and the hybrid model routing in the Phase 3
// precompute path. Mirrors lpSectionToContentType in
// server/routers/complianceRewrites.ts — the duplication keeps both files
// runnable in isolation.
function lpSectionToContentType(sectionKey: string): "headline" | "body" | "link" {
  if (sectionKey === "eyebrowHeadline" || sectionKey === "mainHeadline" || sectionKey === "subheadline") return "headline";
  if (sectionKey === "primaryCta") return "link";
  return "body";
}

const LP_ANGLE_COL_MAP = {
  original: "originalAngle",
  godfather: "godfatherAngle",
  free: "freeAngle",
  dollar: "dollarAngle",
} as const;

type LpAngleKey = keyof typeof LP_ANGLE_COL_MAP;

/**
 * Concurrency-limited map. Mirror of processInChunks in adCopy.ts —
 * inlined here so the landing-page precompute path doesn't take a hard
 * dependency on the adCopy router for a 10-line utility.
 */
async function processInChunks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item, offset) => fn(item, i + offset)));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * W5 Phase 3 — pre-compute compliance rewrites for one landing-page
 * row. Behind ENABLE_COMPLIANCE_REWRITES; when off, this is a no-op so
 * production sees no change until Railway flips the flag.
 *
 * Scope:
 *   - 12 simple-string sections of the active angle (LP_STRING_SECTIONS).
 *   - Trial-tier users: narrowed to mainHeadline + primaryCta only.
 *     The other 10 sections show an inline "Pro feature" upgrade message
 *     in the panel; that gating lives client-side in the panel against
 *     the rewrites cache, not server-side here.
 *   - Body sections route to Opus 4.7; headline/link inherit Sonnet 4.6.
 *   - isLandingPageContext=true so the rewrite engine unconditionally
 *     applies the SAC reminder regardless of contentType.
 *
 * COUNT-guard:
 *   - When `targetAngle` is undefined (post-generate path), skip if any
 *     rewrites already exist for this LP — same row through the retry
 *     path automatically becomes a no-op.
 *   - When `targetAngle` is set (angle-switch path), skip if any rewrites
 *     already exist for that specific angle. Other angles' rewrites do
 *     not gate this angle's precompute.
 *
 * Concurrency: processInChunks(sections, 5, …) — 5 model calls in flight
 * at peak, matching the cap in precomputeAdCopyComplianceRewrites.
 *
 * Best-effort: per-section failures are caught and logged. We never let
 * a precompute failure surface to the user-facing generate path.
 */
async function precomputeLandingPageComplianceRewrites(
  user: { id: number; subscriptionTier: string | null; role: string | null },
  landingPageId: number,
  serviceNiche: string | null,
  targetAngle?: LpAngleKey,
): Promise<void> {
  if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") return;

  try {
    const db = await getDb();
    if (!db) return;
    const { rewriteForCompliance } = await import("../_core/complianceRewrite");
    const { enforceFreeTierRewriteCap } = await import("./complianceRewrites");

    // Ownership + row read.
    const [lp] = await db
      .select()
      .from(landingPages)
      .where(and(eq(landingPages.id, landingPageId), eq(landingPages.userId, user.id)))
      .limit(1);
    if (!lp) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} not found for user=${user.id} — skipping`);
      return;
    }

    const angleKey: LpAngleKey = targetAngle ?? ((lp.activeAngle as LpAngleKey | null) ?? "original");
    if (!(angleKey in LP_ANGLE_COL_MAP)) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} unknown angle=${angleKey} — skipping`);
      return;
    }
    const angleCol = LP_ANGLE_COL_MAP[angleKey];

    // COUNT-guard. Use a LIKE filter on sourceSubKey when scoped to a
    // specific angle (angle-switch path); otherwise count any LP-keyed
    // rewrites for the row (post-generate path).
    const guardFilters = [
      eq(complianceRewrites.userId, user.id),
      eq(complianceRewrites.sourceTable, "landingPages"),
      eq(complianceRewrites.sourceId, landingPageId),
    ];
    if (targetAngle) {
      guardFilters.push(like(complianceRewrites.sourceSubKey, `${targetAngle}:%`));
    }
    const existing = await db
      .select({ id: complianceRewrites.id })
      .from(complianceRewrites)
      .where(and(...guardFilters))
      .limit(1);
    if (existing.length > 0) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} already has rewrites — skipping`);
      return;
    }

    // Free-tier cap (skip-on-fail mirrors adCopy). Service-scoped, same
    // 3-rewrite-per-service ceiling as Phases 1/2.
    const serviceId = lp.serviceId ?? null;
    if (serviceId != null) {
      try { await enforceFreeTierRewriteCap(db, user, serviceId); }
      catch {
        console.log(`[W5.precompute] landingPage id=${landingPageId} free-tier cap hit for user ${user.id} — skipping`);
        return;
      }
    } else {
      console.log(`[W5.precompute] landingPage id=${landingPageId} has null serviceId — skipping (no service to attribute rewrites to)`);
      return;
    }

    // Free-tier section narrowing. Trial users get rewrites only on the
    // two highest-leverage sections; the rest of the in-scope set is
    // gated to Pro/agency.
    const isFreeTier = user.role !== "superuser" && (!user.subscriptionTier || user.subscriptionTier === "trial");
    const inScope = isFreeTier
      ? Array.from(LP_STRING_SECTIONS).filter(s => LP_FREE_TIER_SECTIONS.has(s))
      : Array.from(LP_STRING_SECTIONS);

    const rawAngle = (lp as Record<string, unknown>)[angleCol];
    const angleData: Record<string, unknown> = typeof rawAngle === "string"
      ? JSON.parse(rawAngle)
      : ((rawAngle as Record<string, unknown>) ?? {});

    const rowsToInsert: Array<typeof complianceRewrites.$inferInsert> = [];
    console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} sectionsInScope=${inScope.length} freeTier=${isFreeTier}`);

    await processInChunks(inScope, 5, async (sectionKey) => {
      const text = angleData[sectionKey];
      if (typeof text !== "string" || !text.trim()) return;

      try {
        const c = await checkCompliance(text);
        // Threshold for landing pages is 100 — anything short of perfect
        // gets a rewrite suggestion. (Phases 1/2 use 70; landing pages
        // are higher-stakes copy with more surface area for issues.)
        if (c.score >= 100 || c.issues.length === 0) return;

        const contentType = lpSectionToContentType(sectionKey);
        const modelOverride = contentType === "body" ? "claude-opus-4-7" : undefined;

        const r = await rewriteForCompliance(
          text,
          c.issues,
          contentType,
          { niche: serviceNiche, mechanism: null, mainBenefit: null },
          modelOverride,
          /* isLandingPageContext */ true,
        );

        rowsToInsert.push({
          userId: user.id,
          serviceId,
          contentType,
          sourceTable: "landingPages",
          sourceId: landingPageId,
          sourceSubKey: `${angleKey}:${sectionKey}`,
          originalText: text,
          rewrittenText: r.rewrite,
          violationReasons: c.issues.map(i => i.reason),
          complianceScore: r.score,
          modelUsed: r.modelUsed,
        });
      } catch (err) {
        console.warn(
          `[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} section=${sectionKey} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    });

    if (rowsToInsert.length > 0) {
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} inserted ${rowsToInsert.length} rewrite(s)`);
    } else {
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} produced no rewrites (all sections passed or skipped)`);
    }
  } catch (err) {
    console.error(
      `[W5.precompute] landingPage id=${landingPageId} unexpected failure:`,
      err instanceof Error ? err.message : err,
    );
  }
}

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

      await enforceQuota(ctx.user.id, "landingPages");

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
        cascadeContext || null,
        sotContext || null,
        avatarDescription || null,
        campaignTypeContext || null,
        icpContext || null,
      ].filter(Boolean).join('\n\n');

      // ── Cascade context from Campaign Kit ──
      let cascadeContext = "";
      try {
        const [relIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        if (relIcp) {
          const [kit] = await db.select().from(campaignKits).where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, relIcp.id))).limit(1);
          if (kit) {
            const parts: string[] = [];
            if (kit.selectedMechanismId) {
              const [mech] = await db.select().from(heroMechanisms).where(eq(heroMechanisms.id, kit.selectedMechanismId)).limit(1);
              if (mech) parts.push(`The hero mechanism name is: ${mech.mechanismName} — use this in the Unique Mechanism Introduction section`);
            }
            if (kit.selectedOfferId) {
              const [offer] = await db.select().from(offers).where(eq(offers.id, kit.selectedOfferId)).limit(1);
              if (offer) parts.push(`Offer angle: ${offer.activeAngle || "godfather"}`);
            }
            if (kit.selectedHvcoId) {
              const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, kit.selectedHvcoId)).limit(1);
              if (hvco) parts.push(`Lead magnet: ${hvco.title} — reference this in the problem and quiz sections`);
            }
            if (parts.length > 0) {
              cascadeContext = `UPSTREAM CONTEXT — SELECTED ASSETS:\n${parts.join(". ")}.\n\n`;
            }
          }
        }
      } catch (e) { console.warn("[cascade] landingPages context fetch failed:", e); }

      // Build service-aware testimonial fallbacks
      const fallbackTestimonials = [
        {
          headline: `Finally Achieving ${service.mainBenefit ?? 'Real Results'}`,
          quote: `I was skeptical at first, but the results speak for themselves. If you are ${service.targetCustomer ?? 'looking for a change'}, this is exactly what you need.`,
          name: service.avatarName ?? 'A Client',
          location: service.avatarTitle ?? 'Satisfied Client'
        },
        {
          headline: 'This Changed Everything For Me',
          quote: `The approach is unlike anything else I have tried. Within weeks I could see real progress toward ${service.mainBenefit ?? 'my goals'}.`,
          name: 'A Recent Client',
          location: service.targetCustomer ?? 'Worldwide'
        }
      ];

      // Generate all 4 angles in parallel with social proof (Issue 2 fix).
      // Sync `generate` is deferred — cascade defaults to "" via param default
      // so this path remains uncascaded until the follow-up cleanup commit.
      // Note: the previous 7th arg (fallbackTestimonials) was silently dropped
      // by generateAllAngles (signature only accepted 6 params); removed here
      // to avoid type-mismatch with the new cascadeContext 7th param.
      const allAnglesRaw = await generateAllAngles(
        service.name,
        service.description || "",
        avatarName,
        enrichedAvatarDescription,
        socialProof,
      );

      // Phase 3: regex pre-clean removed. Raw model output flows
      // straight into the JSON column; the compliance rewrite engine
      // handles flagged sections reactively via the precompute hook
      // below, so any regex layer here would just be re-doing work the
      // panel already shows the user.
      const allAngles = {
        original: allAnglesRaw.original as Record<string, unknown>,
        godfather: allAnglesRaw.godfather as Record<string, unknown>,
        free: allAnglesRaw.free as Record<string, unknown>,
        dollar: allAnglesRaw.dollar as Record<string, unknown>,
      };

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

      await incrementQuotaCount(ctx.user.id, "landingPages");

      // Fetch the created landing page
      const [newPage] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, insertResult[0].insertId))
        .limit(1);

      // Auto-score and auto-select into campaign kit (non-blocking)
      try {
        const originalContent = JSON.stringify(allAngles.original);
        const s = await scoreItem({ content: originalContent, nodeType: "landingPages", formulaType: "original" });
        await db.update(landingPages).set({ selectionScore: String(s) } as any).where(eq(landingPages.id, insertResult[0].insertId));
        const [relatedIcp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
        if (relatedIcp) await autoSelectBest(ctx.user.id, relatedIcp.id, "selectedLandingPageId", insertResult[0].insertId);
      } catch (e) { console.warn("[auto-select] landingPages failed:", e); }

      // W5 Phase 3 — fire-and-forget compliance rewrite precompute on
      // the active angle. setImmediate lets the user-facing return land
      // immediately; the panel fetches rewrites on its own mount and
      // sees them populate within ~60-90s. No-op when the flag is off.
      const newPageId = insertResult[0].insertId;
      setImmediate(() => {
        precomputeLandingPageComplianceRewrites(
          { id: ctx.user.id, subscriptionTier: user.subscriptionTier ?? null, role: user.role ?? null },
          newPageId,
          service.category ?? null,
        ).catch(err => console.warn(`[W5.precompute] landingPage id=${newPageId} sync-generate hook failed:`, err instanceof Error ? err.message : err));
      });

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
      await enforceQuota(ctx.user.id, "landingPages");
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

      // Cascade context — fetched during request, captured for setImmediate.
      // Per user spec: generateAsync only (sync deferred). Threaded through
      // generateAllAngles → generateLandingPageAngle as a function parameter.
      const capturedCascadeContext = await getCascadeContext(ctx.user.id, capturedIcp?.id, "landingPage");

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      // ── Pre-compute socialProof outside try so retry block can access it ──
      const bgSocialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, hasPress: !!capturedService.pressFeatures && capturedService.pressFeatures.trim().length > 0, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0, testimonials: [capturedService.testimonial1Name ? { name: capturedService.testimonial1Name, title: capturedService.testimonial1Title || '', quote: capturedService.testimonial1Quote || '' } : null, capturedService.testimonial2Name ? { name: capturedService.testimonial2Name, title: capturedService.testimonial2Title || '', quote: capturedService.testimonial2Quote || '' } : null, capturedService.testimonial3Name ? { name: capturedService.testimonial3Name, title: capturedService.testimonial3Title || '', quote: capturedService.testimonial3Quote || '' } : null].filter(Boolean), press: capturedService.pressFeatures || '' };

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const sotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '', capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '', capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '', capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : ''}\n${capturedIcp.successMetrics ? `How they measure success: ${capturedIcp.successMetrics}` : ''}`.trim() : '';

          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. Copy must give a compelling reason to attend live.\nCTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. Daily wins build momentum.\nCTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey.\nCTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access and founding member status.\nCTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];

          const socialProof = bgSocialProof;

          let avatarName = capturedInput.avatarName || `${capturedService.targetCustomer}`;
          let avatarDescription = capturedInput.avatarDescription || capturedService.description || "Target Customer";
          if (avatarName.includes(',')) {
            const parts = avatarName.split(',').map((p: string) => p.trim());
            if (parts.length >= 3) { avatarName = `${parts[0]} the ${parts[2]}`; avatarDescription = parts.length >= 4 ? parts[3] : parts[2]; }
            else if (parts.length === 2) { avatarName = `${parts[0]} the ${parts[1]}`; avatarDescription = parts[1]; }
          }
          const enrichedAvatarDescription = [sotContext || null, avatarDescription || null, campaignTypeContext || null, icpContext || null].filter(Boolean).join('\n\n');

          // ── Helper: write real angle-progress to job record ──────────────────
          const writeProgress = async (completed: number, total: number) => {
            const label = completed < total
              ? `Generating angle ${completed + 1} of ${total}…`
              : `Finalising your landing page…`;
            try {
              await bgDb.update(jobs)
                .set({ progress: JSON.stringify({ step: completed, total, label }) })
                .where(eq(jobs.id, jobId));
            } catch { /* non-fatal */ }
          };

          const asyncFallbackTestimonials = [
            {
              headline: `Finally Achieving ${capturedService.mainBenefit ?? 'Real Results'}`,
              quote: `I was skeptical at first, but the results speak for themselves. If you are ${capturedService.targetCustomer ?? 'looking for a change'}, this is exactly what you need.`,
              name: capturedService.avatarName ?? 'A Client',
              location: capturedService.avatarTitle ?? 'Satisfied Client'
            },
            {
              headline: 'This Changed Everything For Me',
              quote: `The approach is unlike anything else I have tried. Within weeks I could see real progress toward ${capturedService.mainBenefit ?? 'my goals'}.`,
              name: 'A Recent Client',
              location: capturedService.targetCustomer ?? 'Worldwide'
            }
          ];
          const allAnglesRaw2 = await generateAllAngles(capturedService.name, capturedService.description || "", avatarName, enrichedAvatarDescription, socialProof, writeProgress, capturedCascadeContext);
          // Phase 3: regex pre-clean removed (see sync `generate` for
          // rationale). Rewrite engine reactively replaces this layer.
          const allAngles = {
            original: allAnglesRaw2.original as Record<string, unknown>,
            godfather: allAnglesRaw2.godfather as Record<string, unknown>,
            free: allAnglesRaw2.free as Record<string, unknown>,
            dollar: allAnglesRaw2.dollar as Record<string, unknown>,
          };

          const insertResult: any = await bgDb.insert(landingPages).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, productName: capturedService.name, productDescription: capturedService.description || "", avatarName, avatarDescription, originalAngle: allAngles.original, godfatherAngle: allAngles.godfather, freeAngle: allAngles.free, dollarAngle: allAngles.dollar, activeAngle: "original", rating: 0 });
          await bgDb.update(users).set({ landingPageGeneratedCount: capturedUser.landingPageGeneratedCount + 1 }).where(eq(users.id, capturedUserId));
          await incrementQuotaCount(capturedUserId, "landingPages");
          const [newPage] = await bgDb.select().from(landingPages).where(eq(landingPages.id, insertResult[0].insertId)).limit(1);

          // Auto-score and auto-select into campaign kit (non-blocking)
          try {
            const originalContent = JSON.stringify(allAngles.original);
            const s = await scoreItem({ content: originalContent, nodeType: "landingPages", formulaType: "original" });
            await bgDb.update(landingPages).set({ selectionScore: String(s) } as any).where(eq(landingPages.id, insertResult[0].insertId));
            const [relatedIcp] = await bgDb.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, capturedInput.serviceId)).limit(1);
            if (relatedIcp) await autoSelectBest(capturedUserId, relatedIcp.id, "selectedLandingPageId", insertResult[0].insertId);
          } catch (e) { console.warn("[auto-select] landingPages async failed:", e); }

          // W5 Phase 3 — fire-and-forget compliance precompute on the
          // active angle. Mirror of the sync-generate hook above; runs
          // before the job is marked complete so the panel sees rewrites
          // shortly after the page resolves. No-op when flag is off.
          const asyncPageId = insertResult[0].insertId;
          setImmediate(() => {
            precomputeLandingPageComplianceRewrites(
              { id: capturedUserId, subscriptionTier: capturedUser.subscriptionTier ?? null, role: capturedUser.role ?? null },
              asyncPageId,
              capturedService.category ?? null,
            ).catch(err => console.warn(`[W5.precompute] landingPage id=${asyncPageId} async-generate hook failed:`, err instanceof Error ? err.message : err));
          });

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newPage?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[landingPages.generateAsync] Job ${jobId} completed, landingPageId: ${newPage?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // ── Network-error auto-retry (once, 30-second delay) ─────────────────
          // Only retry on transient network failures — never on Zod/validation errors.
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('AbortError') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network timeout');
          if (isNetworkError) {
            try {
              const checkDb = await getDb();
              const [currentJob] = checkDb ? await checkDb.select().from(jobs).where(eq(jobs.id, jobId)).limit(1) : [];
              const retryCount = (currentJob as any)?.retryCount ?? 0;
              if (retryCount < 1) {
                console.warn(`[landingPages.generateAsync] Job ${jobId} network error (attempt ${retryCount + 1}), retrying in 30s:`, errorMessage);
                if (checkDb) await checkDb.update(jobs).set({ retryCount: retryCount + 1, progress: JSON.stringify({ step: 0, total: 4, label: 'Network hiccup — retrying in 30s…' }) }).where(eq(jobs.id, jobId));
                await new Promise(resolve => setTimeout(resolve, 30_000));
                setImmediate(async () => {
                  try {
                    const retryDb = await getDb();
                    if (!retryDb) throw new Error('Database not available on retry');
                    const writeProgressRetry = async (completed: number, total: number) => {
                      const label = completed < total ? `Generating angle ${completed + 1} of ${total}…` : `Finalising your landing page…`;
                      try { await retryDb.update(jobs).set({ progress: JSON.stringify({ step: completed, total, label }) }).where(eq(jobs.id, jobId)); } catch { /* non-fatal */ }
                    };
                    const retryAvatarName = capturedInput.avatarName || `${capturedService.targetCustomer}`;
                    const retryAvatarDescription = capturedInput.avatarDescription || capturedService.description || 'Target Customer';
                    const retryAngles = await generateAllAngles(capturedService.name, capturedService.description || '', retryAvatarName, retryAvatarDescription, bgSocialProof, writeProgressRetry, capturedCascadeContext);
                    const retryInsert: any = await retryDb.insert(landingPages).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, productName: capturedService.name, productDescription: capturedService.description || '', avatarName: retryAvatarName, avatarDescription: retryAvatarDescription, originalAngle: retryAngles.original, godfatherAngle: retryAngles.godfather, freeAngle: retryAngles.free, dollarAngle: retryAngles.dollar, activeAngle: 'original', rating: 0 });
                    await retryDb.update(users).set({ landingPageGeneratedCount: capturedUser.landingPageGeneratedCount + 1 }).where(eq(users.id, capturedUserId));
                    const [retryPage] = await retryDb.select().from(landingPages).where(eq(landingPages.id, retryInsert[0].insertId)).limit(1);
                    await retryDb.update(jobs).set({ status: 'complete', result: JSON.stringify({ id: retryPage?.id }) }).where(eq(jobs.id, jobId));
                    console.log(`[landingPages.generateAsync] Job ${jobId} retry succeeded, landingPageId: ${retryPage?.id}`);
                  } catch (retryErr: unknown) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    console.error(`[landingPages.generateAsync] Job ${jobId} retry also failed:`, retryMsg);
                    try { const fd = await getDb(); if (fd) await fd.update(jobs).set({ status: 'failed', error: retryMsg.slice(0, 1024) }).where(eq(jobs.id, jobId)); } catch { /* ignore */ }
                  }
                });
                return; // Don't mark as failed yet — retry is in flight
              }
            } catch { /* if retry setup fails, fall through to permanent failure */ }
          }
          console.error(`[landingPages.generateAsync] Job ${jobId} failed (permanent):`, errorMessage);
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

  // Regenerate a single section within a landing page angle via AI
  regenerateSection: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      angle: z.enum(["original", "godfather", "free", "dollar"]),
      sectionKey: z.string(),
      userPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await enforceQuota(ctx.user.id, "landingPages");

      const [row] = await db
        .select()
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });
      }

      const angleColMap = { original: "originalAngle", godfather: "godfatherAngle", free: "freeAngle", dollar: "dollarAngle" } as const;
      const angleCol = angleColMap[input.angle];
      const rawAngle = row[angleCol];
      const angleData: Record<string, unknown> = typeof rawAngle === "string" ? JSON.parse(rawAngle) : (rawAngle as Record<string, unknown>) ?? {};

      const currentValue = angleData[input.sectionKey];
      const serialized = typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue);

      const isStringSection = LP_STRING_SECTIONS.has(input.sectionKey);
      const userInstruction = input.userPrompt?.trim() ? ` User instruction: ${input.userPrompt.trim()}.` : "";
      const formatInstruction = isStringSection
        ? "Return ONLY the rewritten text. No JSON, no markdown, no explanation."
        : "Return ONLY valid JSON — no markdown, no explanation, no wrapping text.";

      const prompt = `Rewrite the ${input.sectionKey} section for this landing page. Current value: ${serialized}.${userInstruction} ${formatInstruction}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct-response copywriter for high-ticket coaching offers." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const cleaned = stripMarkdownJson(content);

      let newValue: unknown;
      if (isStringSection) {
        // Phase 3: regex pre-clean removed. The compliance rewrite hook
        // below picks up flagged single-section regenerations and
        // surfaces a rewrite alternative through the panel.
        newValue = cleaned;
      } else {
        try {
          newValue = JSON.parse(cleaned);
        } catch {
          newValue = cleaned; // graceful fallback — store raw string
        }
      }

      angleData[input.sectionKey] = newValue;

      await db
        .update(landingPages)
        .set({ [angleCol]: JSON.stringify(angleData), updatedAt: new Date() })
        .where(eq(landingPages.id, input.landingPageId));

      // W5 Phase 3 — precompute hook for single-section regenerate. Only
      // fires for in-scope simple-string sections; nested-array
      // regenerations skip this entirely. Re-scopes the existing helper
      // by treating the regenerated angle as `targetAngle`. Inserts only
      // happen if the COUNT-guard finds zero rewrites for that angle —
      // which means a regenerate on an angle that already has rewrites
      // in the cache will be a no-op here. That is intentional: a
      // single-section regen does not fan out to refresh other sections'
      // rewrites; the user can clear and re-fire if they want a full
      // refresh.
      if (LP_STRING_SECTIONS.has(input.sectionKey)) {
        const regenAngle: LpAngleKey = input.angle;
        const regenLpId = input.landingPageId;
        // Pull the user's tier + role for the precompute helper. Cheap
        // single-row read — kept inline rather than threaded down from
        // ctx because the helper signature mirrors Phase 1/2.
        const [regenUser] = await db
          .select({ subscriptionTier: users.subscriptionTier, role: users.role })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        // Service niche for context — best-effort.
        let regenServiceNiche: string | null = null;
        if (row.serviceId) {
          const [svc] = await db
            .select({ category: services.category })
            .from(services)
            .where(eq(services.id, row.serviceId))
            .limit(1);
          regenServiceNiche = svc?.category ?? null;
        }
        setImmediate(() => {
          precomputeLandingPageComplianceRewrites(
            {
              id: ctx.user.id,
              subscriptionTier: regenUser?.subscriptionTier ?? null,
              role: regenUser?.role ?? null,
            },
            regenLpId,
            regenServiceNiche,
            regenAngle,
          ).catch(err => console.warn(`[W5.precompute] landingPage id=${regenLpId} regenerateSection hook failed:`, err instanceof Error ? err.message : err));
        });
      }

      return angleData;
    }),

  // W5 Phase 3 — lazy precompute on first switch to an inactive angle.
  // The panel calls this when the user clicks an angle they have not
  // viewed before. The helper's COUNT-guard makes repeated calls
  // idempotent, so a debounce on the client is "nice to have" not
  // "must have" — the server-side guard catches the rapid-switch case.
  // Returns immediately; the panel polls listForLandingPage to discover
  // when rewrites land.
  precomputeOnAngleSwitch: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      targetAngle: z.enum(["original", "godfather", "free", "dollar"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") {
        return { fired: false, reason: "flag-off" as const };
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Ownership check.
      const [lp] = await db
        .select({ id: landingPages.id, serviceId: landingPages.serviceId })
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);
      if (!lp) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      // Tier read for the helper's free-tier section narrowing.
      const [me] = await db
        .select({ subscriptionTier: users.subscriptionTier, role: users.role })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      // Service niche, best-effort.
      let serviceNiche: string | null = null;
      if (lp.serviceId) {
        const [svc] = await db
          .select({ category: services.category })
          .from(services)
          .where(eq(services.id, lp.serviceId))
          .limit(1);
        serviceNiche = svc?.category ?? null;
      }

      // Fire-and-forget. setImmediate so the tRPC response returns
      // immediately and the panel can show its "Scanning…" indicator.
      const lpId = input.landingPageId;
      const targetAngle: LpAngleKey = input.targetAngle;
      setImmediate(() => {
        precomputeLandingPageComplianceRewrites(
          {
            id: ctx.user.id,
            subscriptionTier: me?.subscriptionTier ?? null,
            role: me?.role ?? null,
          },
          lpId,
          serviceNiche,
          targetAngle,
        ).catch(err => console.warn(`[W5.precompute] landingPage id=${lpId} angle-switch hook (target=${targetAngle}) failed:`, err instanceof Error ? err.message : err));
      });

      return { fired: true as const, targetAngle };
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

  // D4: Publish landing page to Cloudflare Workers KV
  publishToCloudflare: protectedProcedure
    .input(z.object({ landingPageId: z.number(), styleMode: z.enum(["text", "visual"]).default("text") }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [lp] = await db
        .select()
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);
      if (!lp) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      let serviceName = "Campaign";
      if (lp.serviceId) {
        const [svc] = await db
          .select({ name: services.name })
          .from(services)
          .where(eq(services.id, lp.serviceId))
          .limit(1);
        if (svc) serviceName = svc.name;
      }

      // Pick active angle content
      const angleKey = lp.activeAngle || "original";
      const content =
        angleKey === "godfather" ? lp.godfatherAngle
        : angleKey === "free" ? lp.freeAngle
        : angleKey === "dollar" ? lp.dollarAngle
        : lp.originalAngle;
      if (!content) throw new TRPCError({ code: "BAD_REQUEST", message: "No content for selected angle — please generate a landing page first." });

      // Fetch coach profile (name + bio) from users table
      const [coachProfileRow] = await db
        .select({ coachName: users.coachName, coachBackground: users.coachBackground })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      const coachName = coachProfileRow?.coachName ?? null;
      const coachBackground = coachProfileRow?.coachBackground ?? null;

      // Fetch coach assets (headshot, logo, social_proof) from coachAssets table
      const assetRows = await db
        .select({ assetType: coachAssets.assetType, url: coachAssets.url })
        .from(coachAssets)
        .where(eq(coachAssets.userId, ctx.user.id));
      const headshotUrl = assetRows.find(a => a.assetType === "headshot")?.url ?? null;
      const logoUrl = assetRows.find(a => a.assetType === "logo")?.url ?? null;
      const socialProofUrls = assetRows.filter(a => a.assetType === "social_proof").map(a => a.url);

      // Re-use existing slug or generate a stable one
      const slug =
        lp.publicSlug ||
        `${serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${lp.id}`;

      const { buildTextStyleHtml, buildVisualStyleHtml } = await import("../lib/landingPageHtml");
      const { ensureKvNamespace, writeKvPage, deployWorker } = await import("../lib/cloudflare");

      const html = input.styleMode === "visual"
        ? buildVisualStyleHtml(content, serviceName, { headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground })
        : buildTextStyleHtml(content, serviceName);
      const namespaceId = await ensureKvNamespace();
      await writeKvPage(namespaceId, slug, html);
      await deployWorker(namespaceId);

      const publicUrl = `https://zapcampaigns.com/p/${slug}`;
      await db
        .update(landingPages)
        .set({ publicSlug: slug, publicUrl, publishedStyle: input.styleMode })
        .where(eq(landingPages.id, lp.id));

      return { success: true, publicUrl, slug };
    }),
});
