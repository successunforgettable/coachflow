/**
 * Auto Mode Phase B2 — orchestration handler.
 *
 * Sequential 8-step chain that calls each runX gen-core from B1 in cascade
 * order. Handles:
 *   - status transitions: pending → running → complete/failed (per Phase 0
 *     enum in drizzle/0071_jobs_running_status.sql)
 *   - writeProgress per step with the locked B-2 Zappy script labels
 *   - skip-already-populated: orchestrator inner loop checks kit.selected*Id
 *     before each runX; null slots fire, populated slots skip with the
 *     "Skipping ${step.label} — already done" label per locked spec
 *   - autoSelectBest after each step's success (where applicable per the
 *     per-router pattern): offer/landingPage/email/whatsapp use the returned
 *     single ID directly; mechanism/hvco/headlines/adCopy return setIds, so
 *     orchestrator queries the set's first row and uses its id
 *   - campaignType handling: input.campaignType (optional) is set on the kit
 *     on the FIRST step (offer) so all downstream cascade reads see it
 *
 * Trail Sprint 3 C1: the per-step body is extracted into runOrchestrationStep
 * so the chat-paced Trail loop can run one node per job
 * (autoMode.orchestrateStep). The legacy full-run runOrchestration loops over
 * the same function — single source of truth for step execution.
 *
 * Reaper Option α (per locked decision): stranded `running` jobs after
 * process death require manual cleanup. Reaper at server/_core/index.ts:67
 * filters on status='pending' only — `running` is immune. Defer Option β/γ
 * to Sprint 2.
 *
 * v1 retry-from-top per locked spec: failure at step N marks job 'failed'
 * with which step + deep-link path; partial generations are kept (DB rows
 * stay), user can re-trigger Auto Mode (skip-already-populated logic
 * re-uses what's already populated).
 *
 * Default email sequenceType = "welcome" (matches existing V2 wizard
 * default at V2GeneratorWizard.tsx:2036). Default WA sequenceType =
 * "engagement", tone = "conversational", sequenceLength = 3 (per WA Zod
 * schema defaults).
 */
import { runOfferGeneration } from "../offersGenerator";
import { runHeroMechanismGeneration } from "../heroMechanismsGenerator";
import { runHvcoGeneration } from "../hvcoGenerator";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runLandingPageGeneration } from "../landingPageGenerator";
import { runEmailSequenceGeneration } from "../emailSequenceGenerator";
import { runWhatsappSequenceGeneration } from "../whatsappSequenceGenerator";
import { runAdCreativesGeneration, generateContextualAdHeadlines } from "../adCreativesGenerator";
import { renderQuoteCard } from "./renderQuoteCard";
import { renderNotificationMockup } from "./renderNotificationMockup";
import { renderTestimonialCard } from "./renderTestimonialCard";
import { storagePut } from "../storage";
import { runLandingPagePublish } from "../landingPagePublisher";

// ─── Locked B-2 Zappy script labels ────────────────────────────────────────
// 10 labels: init + 8 steps + finalize. V2AutoModeProgress (Phase B3) reads
// these from progress.label as the orchestrator advances.
export const ORCHESTRATION_STEP_LABELS = {
  init: "Reading your profile and getting Zappy ready…",
  offer: "Crafting your premium offer angles…",
  mechanism: "Naming your unique method…",
  hvco: "Building your free opt-in title…",
  headlines: "Writing 100 headlines across 5 formulas…",
  adCopy: "Drafting your Meta-compliant ad sets…",
  landingPage: "Generating angle {N} of 4 for your landing page…",
  emailSequence: "Composing your email sequence…",
  whatsappSequence: "Adding your WhatsApp follow-up…",
  adCreatives: "Generating 5 ad creative variations…",
  finalize: "Putting it all together for you…",
} as const;

// ─── Step definition ───────────────────────────────────────────────────────
// kitField: the campaignKits.selected*Id column the orchestrator checks
//   for skip-already-populated and updates via autoSelectBest after success.
// runX: the gen-core function from B1. Each receives a typed input shape.
// pickIdFromSet?: when runX returns a setId (mechanism/hvco/headlines/adCopy),
//   this fn queries the set's table and returns the first row's id for
//   autoSelectBest to use as the kit's selected*Id.
type OrchestrationStep = {
  index: number;
  name: keyof typeof ORCHESTRATION_STEP_LABELS;
  kitField: string;
};

const ORCHESTRATION_STEPS: OrchestrationStep[] = [
  { index: 1, name: "offer",            kitField: "selectedOfferId" },
  { index: 2, name: "mechanism",        kitField: "selectedMechanismId" },
  { index: 3, name: "hvco",             kitField: "selectedHvcoId" },
  { index: 4, name: "headlines",        kitField: "selectedHeadlineId" },
  { index: 5, name: "adCopy",           kitField: "selectedAdCopyId" },
  { index: 6, name: "landingPage",      kitField: "selectedLandingPageId" },
  { index: 7, name: "emailSequence",    kitField: "selectedEmailSequenceId" },
  { index: 8, name: "whatsappSequence", kitField: "selectedWhatsAppSequenceId" },
  // Phase C C1: ad creative generation as cascade step 9 (inserted at end
  // so 8 text generators complete first; visual finale lands after text
  // is settled). Wall-clock +2-2.5 min sequential per batch; cost ~$0.20.
  // selectedAdCreativeBatchId is varchar(100), unlike the int IDs of
  // steps 1-8 — autoSelectBest signature widened to accept string|number.
  { index: 9, name: "adCreatives",      kitField: "selectedAdCreativeBatchId" },
];

const TOTAL_STEPS = ORCHESTRATION_STEPS.length;

export type OrchestrationInput = {
  jobId: string;
  userId: number;
  serviceId: number;
  icpId: number;
  campaignType?:
    | "webinar" | "challenge" | "course_launch" | "product_launch"
    | "discovery_call" | "lead_magnet" | "in_person_event";
};

// ─── Trail Sprint 3 C1: single-step executor ───────────────────────────────
export type OrchestrationStepName = (typeof ORCHESTRATION_STEPS)[number]["name"];

export const ORCHESTRATION_STEP_NAMES = ORCHESTRATION_STEPS.map(s => s.name) as OrchestrationStepName[];

export type OrchestrationStepRunResult = {
  skipped: boolean;
  generatedId: number | string | null;
  kitField: string;
};

/**
 * Runs ONE cascade node: skip-already-populated guard, the node's runX
 * gen-core, then autoSelectBest. Extracted verbatim from the legacy loop
 * body — runOrchestration loops over this; autoMode.orchestrateStep runs it
 * job-per-node for the chat-paced Trail loop.
 *
 * onProgress receives the human label updates (including the landingPage
 * sub-progress lines). Errors in onProgress are swallowed — progress is
 * never allowed to fail a generation.
 */
export async function runOrchestrationStep(
  input: {
    userId: number;
    serviceId: number;
    icpId: number;
    campaignType?: OrchestrationInput["campaignType"];
  },
  stepName: OrchestrationStepName,
  onProgress?: (label: string) => Promise<void> | void,
): Promise<OrchestrationStepRunResult> {
  const { getDb } = await import("../db");
  const { users, campaignKits, services, heroMechanisms, hvcoTitles, headlines, adCopy } =
    await import("../../drizzle/schema");
  const { eq, and, asc } = await import("drizzle-orm");
  const { autoSelectBest } = await import("../routers/campaignKits");

  const db = await getDb();
  if (!db) throw new Error("Database not available in orchestration step");

  const step = ORCHESTRATION_STEPS.find(s => s.name === stepName);
  if (!step) throw new Error(`Unknown orchestration step: ${stepName}`);

  const progress = async (label: string) => {
    try { await onProgress?.(label); } catch { /* non-fatal */ }
  };

  // ── Helper: read kit's current selected*Id state for skip-already-populated ──
  const getKit = async () => {
    const [kit] = await db.select().from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, input.icpId)))
      .limit(1);
    return kit;
  };

  // ── Helper: pick first item from a set for autoSelectBest ───────────────
  // The 4 set-returning gen-cores (mechanism/hvco/headlines/adCopy) need
  // the orchestrator to pick a specific item from the set to populate the
  // kit's selected*Id. Strategy: pick the lowest-id row in the set (first
  // inserted; deterministic across re-runs). Future enhancement: pick by
  // selectionScore DESC where the table tracks it (adCopy has selectionScore;
  // others may not).
  const pickFirstFromHeroMechanismSet = async (setId: string): Promise<number | null> => {
    const [row] = await db.select({ id: heroMechanisms.id }).from(heroMechanisms)
      .where(eq(heroMechanisms.mechanismSetId, setId)).orderBy(asc(heroMechanisms.id)).limit(1);
    return row?.id ?? null;
  };
  const pickFirstFromHvcoSet = async (setId: string): Promise<number | null> => {
    const [row] = await db.select({ id: hvcoTitles.id }).from(hvcoTitles)
      .where(eq(hvcoTitles.hvcoSetId, setId)).orderBy(asc(hvcoTitles.id)).limit(1);
    return row?.id ?? null;
  };
  const pickFirstFromHeadlineSet = async (setId: string): Promise<number | null> => {
    const [row] = await db.select({ id: headlines.id }).from(headlines)
      .where(eq(headlines.headlineSetId, setId)).orderBy(asc(headlines.id)).limit(1);
    return row?.id ?? null;
  };
  const pickFirstFromAdSet = async (setId: string): Promise<number | null> => {
    const [row] = await db.select({ id: adCopy.id }).from(adCopy)
      .where(eq(adCopy.adSetId, setId)).orderBy(asc(adCopy.id)).limit(1);
    return row?.id ?? null;
  };

  // ── Resolve user tier/role for compliance precompute caps (headlines/adCopy) ──
  // runHeadlinesGeneration + runAdCopyGeneration accept optional userSubscriptionTier
  // and userRole that flow into precompute helpers' free-tier rewrite caps.
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new Error("User not found in orchestration");
  const userTier = user.subscriptionTier ?? null;
  const userRole = user.role ?? null;

  // ── Skip-already-populated guard ─────────────────────────────────────────
  const kit = await getKit();
  const currentValue = kit ? (kit as Record<string, unknown>)[step.kitField] : null;
  if (currentValue != null) {
    return { skipped: true, generatedId: null, kitField: step.kitField };
  }

  await progress(ORCHESTRATION_STEP_LABELS[step.name]);

  // Widened to string|number: 8 text steps return numeric IDs; Phase C C1's
  // adCreatives step returns a varchar batchId. autoSelectBest signature
  // widened in parallel (campaignKits.ts) to accept either shape.
  let generatedId: number | string | null = null;
  // landingPage runs autoSelectBest internally — skip the step-level call.
  let skipAutoSelect = false;
  switch (step.name) {
    case "offer": {
      const { offerId } = await runOfferGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        offerType: "premium", // matches V2 wizard ADVANCED default at L168
      });
      generatedId = offerId;
      break;
    }
    case "mechanism": {
      // heroMechanism inputs are derived from service record; pass empty
      // strings for the form-overridable fields so runX falls back to
      // service-record values via the resolved* fallback chain.
      const { mechanismSetId } = await runHeroMechanismGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        targetMarket: "",
        pressingProblem: "",
        whyProblem: "",
        whatTried: "",
        whyExistingNotWork: "",
        desiredOutcome: "",
        credibility: "",
        socialProof: "",
      });
      generatedId = await pickFirstFromHeroMechanismSet(mechanismSetId);
      break;
    }
    case "hvco": {
      const { hvcoSetId } = await runHvcoGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        targetMarket: "",
        hvcoTopic: "",
        liteMode: true,
      });
      generatedId = await pickFirstFromHvcoSet(hvcoSetId);
      break;
    }
    case "headlines": {
      const { headlineSetId } = await runHeadlinesGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        targetMarket: "",
        pressingProblem: "",
        desiredOutcome: "",
        uniqueMechanism: "",
        userSubscriptionTier: userTier,
        userRole: userRole,
        liteMode: true,
      });
      generatedId = await pickFirstFromHeadlineSet(headlineSetId);
      break;
    }
    case "adCopy": {
      // CTA defaults to "Book a Free Call" (matches V2 wizard pre-7.2
      // hardcode) when campaignType is not set; cascade map at
      // V2GeneratorWizard.tsx is wizard-side, runX itself uses input.
      // Auto Mode uses the campaignType-aware mapping inline here so the
      // generated ad copy aligns with the user's locked Q-C table.
      const CAMPAIGN_TO_CTA: Record<string, string> = {
        discovery_call: "Book a Free Call",
        webinar: "Save My Seat",
        challenge: "Join the Challenge",
        lead_magnet: "Download Now",
        course_launch: "Enroll Now",
        product_launch: "Get Instant Access",
        in_person_event: "Reserve My Spot",
      };
      const adCallToAction = input.campaignType
        ? (CAMPAIGN_TO_CTA[input.campaignType] ?? "Book a Free Call")
        : "Book a Free Call";

      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      const { adSetId } = await runAdCopyGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        adType: "lead_gen",
        adStyle: "conversational",
        adCallToAction,
        targetMarket: svc?.targetCustomer ?? "",
        productCategory: svc?.category ?? "coaching",
        specificProductName: svc?.name ?? "",
        pressingProblem: svc?.painPoints ?? "",
        desiredOutcome: svc?.mainBenefit ?? "",
        userSubscriptionTier: userTier,
        userRole: userRole,
        liteMode: true,
      });
      generatedId = await pickFirstFromAdSet(adSetId);
      break;
    }
    case "landingPage": {
      // Cascade pageType from kit.campaignType per Q-D table (mirrors
      // V2GeneratorWizard's landingPage dispatch). runX itself doesn't
      // do this mapping — the wizard does. For Auto Mode, orchestrator
      // does it inline before calling runX.
      const CAMPAIGN_TO_PAGE_TYPE: Record<string, "sales_page" | "webinar_registration" | "discovery_call_booking" | "lead_magnet_download" | "event_registration"> = {
        webinar: "webinar_registration",
        discovery_call: "discovery_call_booking",
        lead_magnet: "lead_magnet_download",
        in_person_event: "event_registration",
        course_launch: "sales_page",
        product_launch: "sales_page",
        challenge: "sales_page",
      };
      const pageType = input.campaignType
        ? (CAMPAIGN_TO_PAGE_TYPE[input.campaignType] ?? "sales_page")
        : "sales_page";

      const { landingPageId } = await runLandingPageGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        pageType,
        // onProgress: surfaces per-angle "Generating angle X of 4…" labels
        // up to the orchestration job's progress field. Replaces the
        // {N} token in the locked B-2 landingPage label.
        onProgress: async (completed, total) => {
          const label = completed < total
            ? `Generating angle ${completed + 1} of ${total} for your landing page…`
            : "Finalising your landing page…";
          await progress(label);
        },
      });
      generatedId = landingPageId;
      // runLandingPageGeneration calls autoSelectBest internally already.
      // Skip the step-level call below (idempotent but redundant).
      skipAutoSelect = true;

      // Phase C C2: auto-publish the landing page to Cloudflare Workers KV
      // so the user has a live public URL the moment the cascade completes.
      // Visual style mode by default — Auto Mode runs are paid-tier per
      // Phase C C0 gate; branded full-fidelity is the right default.
      // Original angle by default — matches the LP generator's default
      // output and publishToCloudflare's fallback when activeAngle=NULL.
      //
      // Non-fatal: try/catch wrapper. If Cloudflare KV write or worker
      // deploy hiccups, log warning + continue cascade. LP content is
      // already in DB; user can re-publish via the wizard. Better than
      // failing the entire cascade on a transient Cloudflare API issue.
      try {
        await progress(`Publishing your landing page…`);
        const { publicUrl, slug } = await runLandingPagePublish({
          userId: input.userId,
          landingPageId,
          styleMode: "visual",
        });
        console.log(`[orchestration] LP published to ${publicUrl} (slug=${slug})`);

        // Set kit.selectedLandingPageAngle so the kit page renders the
        // angle that was just published. Default 'original' matches what
        // runLandingPagePublish picked (activeAngle was NULL, fell back).
        const [postPublishKit] = await db
          .select()
          .from(campaignKits)
          .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, input.icpId)))
          .limit(1);
        if (postPublishKit) {
          await db
            .update(campaignKits)
            .set({ selectedLandingPageAngle: "original", updatedAt: new Date() })
            .where(eq(campaignKits.id, postPublishKit.id));
        }
      } catch (publishErr) {
        const errorMessage = publishErr instanceof Error ? publishErr.message : String(publishErr);
        console.warn(
          `[orchestration] LP publish to Cloudflare failed for landingPageId=${landingPageId}: ${errorMessage}. ` +
            `Cascade continues; user can re-publish via wizard.`,
        );
      }

      await progress(`Finalising your landing page…`);
      break;
    }
    case "emailSequence": {
      // Default sequenceType = "welcome" (matches V2 wizard default at
      // V2GeneratorWizard.tsx:2036). Per locked B-2 spec: do not commit
      // to "nurture" — wizard's pre-existing default IS welcome.
      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      const { id } = await runEmailSequenceGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        sequenceType: "welcome",
        name: svc?.name ? `${svc.name} — Welcome Sequence` : "Welcome Sequence",
      });
      generatedId = id;
      break;
    }
    case "whatsappSequence": {
      // Defaults match WA Zod schema: engagement / conversational / 3.
      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      const { id } = await runWhatsappSequenceGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        sequenceType: "engagement",
        name: svc?.name ? `${svc.name} — Engagement Sequence` : "Engagement Sequence",
        tone: "conversational",
        sequenceLength: 3,
      });
      generatedId = id;
      break;
    }
    case "adCreatives": {
      // Re-read kit to pick up adImageStyle saved by the client just before this call
      const freshKit = await getKit();
      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      if (!svc) throw new Error("Service not found for adCreatives step");

      let mechanismName = "System";
      if (freshKit?.selectedMechanismId) {
        const [m] = await db.select({ name: heroMechanisms.mechanismName })
          .from(heroMechanisms)
          .where(eq(heroMechanisms.id, freshKit.selectedMechanismId))
          .limit(1);
        if (m?.name) mechanismName = m.name;
      }

      const niche = (svc.targetCustomer ?? svc.category ?? "coaching").slice(0, 200);
      const pressingProblem = svc.painPoints ?? svc.description ?? "";

      // Generate contextual headlines (shared by both styles)
      const headlines = await generateContextualAdHeadlines({
        productName: svc.name,
        mainBenefit: svc.mainBenefit ?? "",
        targetAudience: svc.targetCustomer ?? "",
        uniqueMechanism: mechanismName,
        pressingProblem,
      });

      // Style routing: read adImageStyle from the freshly-read kit
      const adImageStyle = (freshKit as Record<string, unknown>)?.adImageStyle as string | null;
      const isTemplate = adImageStyle?.startsWith("quote_card") || adImageStyle?.startsWith("notification") || adImageStyle?.startsWith("testimonial");

      if (isTemplate) {
        // ── Template path: pure typography/layout, no Flux, $0/image, <5s ──
        const { adCreatives: adCreativesTable } = await import("../../drizzle/schema");
        const { randomBytes: rb } = await import("crypto");
        const styleKey = adImageStyle!.split(":")[0]; // "quote_card" or "notification"
        const palette = adImageStyle!.split(":")[1] || "charcoal";
        const batchId = `batch-${Date.now()}-${rb(4).toString("hex")}`;

        // Build testimonials array for testimonial style (verbatim from services columns)
        const svcTestimonials = styleKey === "testimonial" ? [
          svc.testimonial1Name ? { name: svc.testimonial1Name, title: svc.testimonial1Title || "", quote: svc.testimonial1Quote || "" } : null,
          svc.testimonial2Name ? { name: svc.testimonial2Name, title: svc.testimonial2Title || "", quote: svc.testimonial2Quote || "" } : null,
          svc.testimonial3Name ? { name: svc.testimonial3Name, title: svc.testimonial3Title || "", quote: svc.testimonial3Quote || "" } : null,
        ].filter(Boolean) as { name: string; title: string; quote: string }[] : [];

        for (let i = 0; i < 5; i++) {
          let headline: string;
          let pngBuffer: Buffer;

          if (styleKey === "testimonial" && i < svcTestimonials.length) {
            // Testimonial card — verbatim quote from the user's real data
            const t = svcTestimonials[i];
            pngBuffer = await renderTestimonialCard({ quote: t.quote, clientName: t.name, clientTitle: t.title || undefined, palette });
            headline = t.quote.slice(0, 250); // store quote snippet in headline column for display
          } else if (styleKey === "testimonial") {
            // Remaining slots after testimonials: headline cards as quote-card style
            headline = headlines[i - svcTestimonials.length];
            pngBuffer = await renderQuoteCard({ headline, attribution: svc.name, palette });
          } else if (styleKey === "notification") {
            headline = headlines[i];
            pngBuffer = await renderNotificationMockup({ headline, appName: svc.name, palette });
          } else {
            headline = headlines[i];
            pngBuffer = await renderQuoteCard({ headline, attribution: svc.name, palette });
          }
          const fileKey = `ad-creatives/${input.userId}/${batchId}/${styleKey}-${i + 1}.png`;
          const { url: imageUrl } = await storagePut(fileKey, pngBuffer, "image/png");

          await db.insert(adCreativesTable).values({
            userId: input.userId,
            serviceId: input.serviceId,
            niche,
            productName: svc.name,
            uniqueMechanism: mechanismName,
            targetAudience: svc.targetCustomer ?? "",
            mainBenefit: svc.mainBenefit ?? "",
            pressingProblem,
            adType: "lead_gen",
            styleType: "tabloid",
            designStyle: "person_shocked",
            headlineFormula: (["benefit", "social_proof", "curiosity", "contrast", "challenge"] as const)[i],
            headline,
            imageUrl,
            rawImageUrl: imageUrl,
            imageFormat: "1080x1080",
            complianceChecked: true,
            complianceIssues: null,
            batchId,
            variationNumber: i + 1,
          } as any);
        }
        generatedId = batchId;
      } else {
        // ── Photo-ad path: existing Flux pipeline, UNTOUCHED ──
        const { batchId } = await runAdCreativesGeneration({
          userId: input.userId,
          serviceId: input.serviceId,
          niche,
          productName: svc.name,
          uniqueMechanism: mechanismName,
          targetAudience: svc.targetCustomer ?? "",
          mainBenefit: svc.mainBenefit ?? "",
          pressingProblem,
          adType: "lead_gen",
          headlines,
        });
        generatedId = batchId;
      }
      break;
    }
  }

  // autoSelectBest: update the kit's selected*Id slot for this step.
  // landingPage already does this internally — skipAutoSelect set above.
  if (generatedId != null && !skipAutoSelect) {
    await autoSelectBest(input.userId, input.icpId, step.kitField, generatedId);
  }

  return { skipped: false, generatedId, kitField: step.kitField };
}

export async function runOrchestration(input: OrchestrationInput): Promise<void> {
  const { getDb } = await import("../db");
  const { jobs, campaignKits } = await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("Database not available in orchestration");

  // ── Status transition: pending → running ────────────────────────────────
  // CRITICAL: must happen BEFORE the first LLM call so the reaper (which
  // sweeps pending older than 5 min) doesn't kill the orchestration job
  // mid-flight. `running` is immune per Phase 0 enum.
  await db.update(jobs)
    .set({ status: "running", progress: JSON.stringify({ step: 0, total: TOTAL_STEPS, label: ORCHESTRATION_STEP_LABELS.init }) })
    .where(eq(jobs.id, input.jobId));

  // ── campaignType seeding ────────────────────────────────────────────────
  // If caller supplied campaignType, write it to the kit BEFORE the first
  // runX so downstream generators see it via the cascade. The kit may not
  // exist yet (autoSelectBest creates it on first call) — write only if it
  // already exists; otherwise rely on autoSelectBest's first call to create
  // it (the campaignType update happens at the next step).
  if (input.campaignType) {
    await db.update(campaignKits)
      .set({ campaignType: input.campaignType })
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, input.icpId)));
  }

  // ── Helper: write progress to job record ────────────────────────────────
  const writeProgress = async (stepIdx: number, label: string) => {
    try {
      await db.update(jobs)
        .set({ progress: JSON.stringify({ step: stepIdx, total: TOTAL_STEPS, label }) })
        .where(eq(jobs.id, input.jobId));
    } catch { /* non-fatal */ }
  };

  // ── Step loop — delegates to the extracted single-step executor ─────────
  for (const step of ORCHESTRATION_STEPS) {
    const result = await runOrchestrationStep(
      {
        userId: input.userId,
        serviceId: input.serviceId,
        icpId: input.icpId,
        campaignType: input.campaignType,
      },
      step.name,
      (label) => writeProgress(step.index, label),
    );
    if (result.skipped) {
      await writeProgress(step.index, `Skipping ${ORCHESTRATION_STEP_LABELS[step.name]} — already done`);
    }
  }

  // ── Finalize ────────────────────────────────────────────────────────────
  await writeProgress(TOTAL_STEPS, ORCHESTRATION_STEP_LABELS.finalize);
  // Resolve final kit for result payload.
  const [finalKit] = await db.select().from(campaignKits)
    .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, input.icpId)))
    .limit(1);
  await db.update(jobs)
    .set({
      status: "complete",
      result: JSON.stringify({ kitId: finalKit?.id ?? null }),
    })
    .where(eq(jobs.id, input.jobId));
}
