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
import { pickSelectedFromSet } from "./pickSelected";
import { runOfferGeneration } from "../offersGenerator";
import { runHeroMechanismGeneration } from "../heroMechanismsGenerator";
import { runHvcoGeneration } from "../hvcoGenerator";
import { runHeadlinesGeneration } from "../headlinesGenerator";
import { runAdCopyGeneration } from "../adCopyGenerator";
import { runLandingPageGeneration } from "../landingPageGenerator";
import { runEmailSequenceGeneration } from "../emailSequenceGenerator";
import { runWhatsappSequenceGeneration } from "../whatsappSequenceGenerator";
import { runAdCreativesGeneration, runEditorialAdCreativesGeneration, generateContextualAdHeadlines } from "../adCreativesGenerator";
import { TABLOID_FORMULAS, TEMPLATE_CARD_FORMULAS } from "./adVariations";
import { ctaForCampaignType } from "./campaignCta";
import { renderQuoteCard } from "./renderQuoteCard";
import { renderNotificationMockup } from "./renderNotificationMockup";
import { renderTestimonialCard } from "./renderTestimonialCard";
import { renderComparisonCard } from "./renderComparisonCard";
import { generateComparisonPairs, type ComparisonPair } from "./comparisonPairs";
import { storagePut } from "../storage";
import { runLandingPagePublish } from "../landingPagePublisher";
import { styleForPageType } from "../lib/templates/renderRegistry";
import { getCoachBookingUrl } from "../lib/coachBookingUrl";
import { sweepFabricatedLocationsDeep } from "../lib/locationSweep";
import { runBonusGeneration } from "../bonusGenerator";
import { applyBonusesToText } from "../lib/bonusTokens";
import { enqueueBonusPdfJob } from "../bonusPdfGenerator";

// ─── Locked B-2 Zappy script labels ────────────────────────────────────────
// 10 labels: init + 8 steps + finalize. V2AutoModeProgress (Phase B3) reads
// these from progress.label as the orchestrator advances.
// Campaign type → landing page type, and campaign type → landing-page copy framing, both now
// live in `_core/campaignFraming.ts` alongside the free-vs-paid offer-mode resolver, because all
// three are the same fact about a campaign and used to drift apart. Re-exported here so every
// existing importer (`routers/campaignKits.ts`, and this file's own steps) is untouched.
export { CAMPAIGN_TO_PAGE_TYPE, pageTypeForCampaign } from "./campaignFraming";
import { pageTypeForCampaign } from "./campaignFraming";

/**
 * Which WhatsApp sequence shape fits a campaign. Only campaigns that actually HAVE an event
 * may use the event-anchored engagement builder.
 */
const WHATSAPP_SEQUENCE_FOR_CAMPAIGN: Record<string, "engagement" | "nurture"> = {
  webinar: "engagement",
  in_person_event: "engagement",
  challenge: "engagement",
  lead_magnet: "nurture",
  discovery_call: "nurture",
  course_launch: "nurture",
  product_launch: "nurture",
};

// ── Phase 1 (Problem A) — campaign facts feed generation ─────────────────────────────────────────────
/** WhatsApp/email sequence length from event-date proximity: closer → shorter & punchier, further →
 *  longer nurture. Unknown/unparseable date → 3 (the prior hardcoded default; safe). */
/**
 * Normalise a free-text event date to an ISO `YYYY-MM-DD` string, or null if it
 * genuinely cannot be read.
 *
 * Event dates are stored as free text, so `Date.parse` alone silently fails on
 * the two shapes real coaches actually type:
 *   - UK slash order — "27/09/2026" parses as month 27 → NaN
 *   - ordinal words  — "28th august 2026" → NaN
 * Both previously collapsed to the 3-message fallback with no signal.
 *
 * SLASH-DATE POLICY: `d/m/y` is read as DAY-first. ZAP's coaches are UK-centric
 * and the observed prod values are UK order. Where the first field is >12 this
 * is unambiguous; where both are ≤12 ("05/09/2026") day-first is a deliberate
 * choice, not a guess — recorded here so it is not silently flipped later.
 */
export function normalizeEventDateToISO(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const iso = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    // Rejects overflow like 31/02 , which Date would roll into March.
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  };

  // Already ISO-ish: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return iso(+isoMatch[1], +isoMatch[2], +isoMatch[3]);

  // Slash/dot/dash separated, day-first: D/M/YYYY or D/M/YY
  const slash = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (slash) {
    const y = slash[3].length === 2 ? 2000 + +slash[3] : +slash[3];
    return iso(y, +slash[2], +slash[1]);
  }

  // Ordinal words: "28th august 2026", "3rd Sept 2026", "August 28th, 2026"
  const stripped = s.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1").replace(/,/g, " ");
  const t = Date.parse(stripped);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

export type SequenceLengthResolution = {
  length: 3 | 5 | 7;
  /** no-date: nothing supplied (3 is correct). parsed: read successfully.
   *  unparseable: a date WAS supplied but could not be read — must surface. */
  status: "no-date" | "parsed" | "unparseable";
  iso?: string;
};

/**
 * Runway-aware sequence length, with the failure mode made visible.
 *
 * The distinction that matters: NO date supplied is a legitimate 3 (a lead
 * magnet has no runway). A date supplied that we cannot read is a DEFECT, and
 * previously it produced the identical 3 with no way to tell the two apart.
 */
export function resolveSequenceLength(dateStr?: string | null): SequenceLengthResolution {
  if (!dateStr || !String(dateStr).trim()) return { length: 3, status: "no-date" };

  const isoDate = normalizeEventDateToISO(dateStr);
  if (!isoDate) return { length: 3, status: "unparseable" };

  const days = (Date.parse(`${isoDate}T00:00:00Z`) - Date.now()) / 86_400_000;
  const length = days <= 7 ? 3 : days <= 21 ? 5 : 7;
  return { length, status: "parsed", iso: isoDate };
}

/** Back-compatible wrapper. Prefer resolveSequenceLength, which distinguishes
 *  "no date" from "unreadable date". */
export function deriveLengthFromDate(dateStr?: string | null): 3 | 5 | 7 {
  return resolveSequenceLength(dateStr).length;
}

/** The (token, value) answers implied by a kit's campaignFacts — fed through applyOperatorAnswer so a
 *  freshly-generated LP's [INSERT_EVENT_*]/[INSERT_PRICE] tokens are DETERMINISTICALLY substituted with the
 *  real facts. Deterministic resolver, NOT a generator prompt change (that's the Atlanta failure mode). */
export function factsToTokenAnswers(
  facts?: { eventSchedule?: { date?: string; time?: string; timezone?: string; venue?: string } | null; price?: { amount?: string } | null } | null,
): { token: string; value: string }[] {
  const es = facts?.eventSchedule ?? {};
  const out: { token: string; value: string }[] = [];
  const push = (token: string, v?: string) => { if (v && String(v).trim()) out.push({ token, value: String(v) }); };
  push("[INSERT_EVENT_DATE]", es.date);
  push("[INSERT_EVENT_TIME]", es.time);
  push("[INSERT_EVENT_TIMEZONE]", es.timezone);
  push("[INSERT_EVENT_VENUE]", es.venue);
  push("[INSERT_PRICE]", facts?.price?.amount);
  return out;
}

export const ORCHESTRATION_STEP_LABELS = {
  init: "Reading your profile and getting Zappy ready…",
  offer: "Crafting your premium offer angles…",
  mechanism: "Naming your unique method…",
  hvco: "Building your free opt-in title…",
  // No hard count: the cascade runs the headline generator in liteMode
  // (countMultiplier 0.4), so the old "100 headlines" label overstated the real
  // output by roughly 10x. Deck sizes vary by mode, so the label states no number.
  headlines: "Writing your headline options across 5 formulas…",
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
  // TERMINAL-NODE DEGRADATION. A step marked optional may fail without taking
  // the cascade down: the error is recorded and the loop continues.
  //
  // Only safe for steps NOTHING downstream consumes. Steps 1-8 are load-bearing
  // — the cascade context feeds each node from the selected assets of the ones
  // before it, so swallowing an early failure would build the rest of the
  // campaign on a hole. Step 9 (adCreatives) is the last node and no step reads
  // its output, so its failure costs only itself.
  //
  // Why this exists: a beginner run completed steps 1-8 and then died at step 9
  // because the ad-headline validator rejected 1 of 5 headlines for being a
  // single character over its length gate. The throw propagated out of the bare
  // loop below, autoMode.orchestrate marked the whole job failed, and finalize
  // never ran — so the kit was never completed despite eight nodes of real,
  // persisted work. That failure was already on record as having exhausted its
  // retries twice in the wild before this, so it is a live coach-facing path,
  // not a test artifact.
  optional?: boolean;
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
  { index: 9, name: "adCreatives",      kitField: "selectedAdCreativeBatchId", optional: true },
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
  const { users, campaignKits, services, heroMechanisms, hvcoTitles, headlines, adCopy, idealCustomerProfiles, landingPages, offers, nodeStatuses } =
    await import("../../drizzle/schema");
  const { eq, and, asc, sql } = await import("drizzle-orm");
  const { autoSelectBest } = await import("../routers/campaignKits");
  // Phase 1 (Problem A): apply the kit's upfront campaignFacts to a freshly-generated LP (deterministic).
  const { applyOperatorAnswer } = await import("../lib/templates/operatorFields");

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

  // ── Selection: ONE shared decision, ONE call path ───────────────────────
  // Delegates to _core/pickSelected. Each of these used to be
  // `orderBy(asc(id)).limit(1)` — first-inserted — with the SAME shape
  // duplicated again inside every generator, so a fix could land in one layer
  // and miss the other. That is not hypothetical: the first hvco fix did
  // exactly that and only a sweep caught it.
  //
  // NO LONGER A FUTURE ENHANCEMENT (built 2026-07-29). Scored tables (adCopy,
  // headlines) order by selectionScore DESC with id as tie-break; unscored ones
  // (heroMechanisms, hvcoTitles) carry a deliberate tab rule instead of an
  // ordinal. pickSelected.ts documents the rules and the measured waste.
  const pickFirstFromHeroMechanismSet = (setId: string) => pickSelectedFromSet(db, "heroMechanisms", setId);
  const pickFirstFromHvcoSet = (setId: string) => pickSelectedFromSet(db, "hvco", setId);
  const pickFirstFromHeadlineSet = (setId: string) => pickSelectedFromSet(db, "headlines", setId);
  const pickFirstFromAdSet = (setId: string) => pickSelectedFromSet(db, "adCopy", setId);

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
        // The offer node was the ONLY generator in the cascade that never received this. Without
        // it, a free webinar campaign produced a priced, refund-guaranteed offer.
        campaignType: input.campaignType,
      });
      generatedId = offerId;
      // Phase 1 (item 7): apply the kit's UPFRONT campaign facts to the freshly-generated offer, exactly as
      // the landingPage case does — deterministic token substitution via applyOperatorAnswer (NOT a generator
      // prompt change). The offer generator emits [INSERT_PRICE] verbatim when no price is supplied; here we
      // fill it with the coach's real answer (a number, or "free" for a __FREE__ event) so the offer carries
      // the real price/date instead of a placeholder or a first-pass fabrication.
      const offerFactAnswers = factsToTokenAnswers(kit?.campaignFacts);
      if (offerFactAnswers.length > 0) {
        const [offerRow] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
        if (offerRow) {
          const offerAngleCols = ["godfatherAngle", "freeAngle", "dollarAngle"] as const;
          const offerUpdate: Record<string, unknown> = {};
          for (const col of offerAngleCols) {
            let angle = (offerRow as Record<string, any>)[col];
            if (!angle) continue;
            for (const fa of offerFactAnswers) angle = applyOperatorAnswer(angle, fa.token, fa.value).content;
            offerUpdate[col] = angle;
          }
          if (Object.keys(offerUpdate).length > 0) {
            await db.update(offers).set(offerUpdate as any).where(eq(offers.id, offerId));
          }
        }
      }
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

      // Lead-magnet BODY generation — gated to campaigns that actually convert on
      // a downloadable (lead_magnet_download). The other six campaign types
      // convert on registration/call/purchase, so no body is made. Titles are
      // always generated (hard cascade dependency for headlines/adCopy/LP/email/
      // whatsapp) — only the body is gated. Failure never breaks the cascade.
      if (generatedId && pageTypeForCampaign(input.campaignType) === "lead_magnet_download") {
        try {
          const [sel] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, generatedId)).limit(1);
          // Respect an imported asset (user has their own); never overwrite an
          // existing body. Only generate for a freshly-generated selected title.
          if (sel && sel.source === "generated" && sel.assetBody == null) {
            const { generateLeadMagnetContent } = await import("../leadMagnetContentGenerator");
            const body = await generateLeadMagnetContent({
              userId: input.userId,
              serviceId: input.serviceId,
              icpId: input.icpId,
              title: sel.title,
            });
            if (body) {
              {
                // THE CASCADE PATH HAD NO SCREEN. routers/hvco.ts and bonusPdfGenerator.ts both
                // screened their assetBody write and this one — the path every coach actually
                // hits — did not. Same helper, same hardened checkOutput, no second code path.
                // Advisory: it logs and persists regardless, because blanking a coach's
                // deliverable is worse than shipping copy they can edit.
                const { screenLeadMagnetBody } = await import("./persistenceGate");
                await screenLeadMagnetBody("leadMagnetContent", input.serviceId, body);
              }
              await db.update(hvcoTitles).set({ assetBody: body as unknown as object })
                .where(eq(hvcoTitles.id, generatedId));
              // Delivery layer: render + host the deliverable. Non-fatal — content is
              // already persisted and is re-publishable; a publish hiccup never breaks
              // the cascade.
              //
              // Quiz review gate: a coach's FIRST quiz is a diagnostic instrument that
              // carries their name, so it must be reviewed before it goes live. Defer
              // publish (leave magnetHtmlUrl NULL → "review required" on the node)
              // until they approve it. Every quiz AFTER their first approval publishes
              // immediately. State is derived (coachHasApprovedQuiz) — no column.
              try {
                let deferForReview = false;
                if (body.format === "quiz") {
                  const { coachHasApprovedQuiz } = await import("../leadMagnetQuizReview");
                  deferForReview = !(await coachHasApprovedQuiz(input.userId, generatedId));
                }
                if (deferForReview) {
                  console.log(`[orchestration.hvco] quiz hvco ${generatedId} held for coach review (first quiz — not published)`);
                } else {
                  const { publishLeadMagnet } = await import("../leadMagnetPublisher");
                  await publishLeadMagnet({ hvcoId: generatedId });
                }
              } catch (pubErr) {
                console.warn(`[orchestration.hvco] lead-magnet publish skipped: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`);
              }
            }
          }
        } catch (err) {
          console.warn(`[orchestration.hvco] lead-magnet body generation skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
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
      const adCallToAction = ctaForCampaignType(input.campaignType);

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
      // V2GeneratorWizard's landingPage dispatch). Shared module-level map
      // (also used by the hvco step to gate lead-magnet body generation).
      const pageType = pageTypeForCampaign(input.campaignType);

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

      // ── Bonuses (forward-sequence step 2, Layer 1) ──────────────────────────────────────────────────
      // Generate the 3 ICP-derived bonuses and make them the SINGLE SOURCE OF TRUTH every bonus surface draws
      // from: fill the offer's [INSERT_BONUS_N_*] slots (whole-line, so a drifted trailer can't survive) AND
      // overwrite the LP's own invented content.bonuses (which otherwise collides with real bonuses and even
      // advertises the lead magnet as a bonus). Email is fed the same bonuses at its own node. Silent — no
      // wizard node (deferred to Problem B). Runs HERE because offer/method/lead-magnet are all selected by the
      // landingPage step (full distinctness context). NON-FATAL: a bonus hiccup must never break the cascade.
      // value is coach-supplied ONLY; absent → offer line shows no value, LP bonus value omitted (never fabricated).
      try {
        const bonusResult = await runBonusGeneration({
          userId: input.userId,
          serviceId: input.serviceId,
          icpId: input.icpId,
        });
        if (bonusResult) {
          const TYPE_ORDER = ["accelerator", "gap_filler", "objection_crusher"] as const;
          const ordered = TYPE_ORDER
            .map((t) => bonusResult.bonuses.find((b) => b.bonusType === t))
            .filter((b): b is NonNullable<typeof b> => !!b);

          // (a) Offer — whole-line fill of the bonus slots with title + shortLine.
          if (kit?.selectedOfferId) {
            const fills = ordered.map((b, i) => ({ index: i + 1, title: b.title, shortLine: b.shortLine, value: null as string | null }));
            const [offerRow] = await db.select().from(offers).where(eq(offers.id, kit.selectedOfferId)).limit(1);
            if (offerRow) {
              const offerUpdate: Record<string, unknown> = {};
              for (const col of ["godfatherAngle", "freeAngle", "dollarAngle"] as const) {
                const angle = (offerRow as Record<string, any>)[col];
                if (angle && typeof angle.bonuses === "string") {
                  offerUpdate[col] = { ...angle, bonuses: applyBonusesToText(angle.bonuses, fills) };
                }
              }
              if (Object.keys(offerUpdate).length > 0) {
                await db.update(offers).set(offerUpdate as any).where(eq(offers.id, kit.selectedOfferId));
              }
            }
          }

          // (b) LP — overwrite content.bonuses on every angle with the real bonuses (full description; value
          // omitted). Kills the LP's invented swipe-file collision + the lead-magnet-advertised-as-a-bonus.
          const realLpBonuses = ordered.map((b) => ({ title: b.title, description: b.description }));
          const [lpRow2] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
          if (lpRow2 && realLpBonuses.length > 0) {
            const lpBonusUpdate: Record<string, unknown> = {};
            for (const col of ["originalAngle", "godfatherAngle", "freeAngle", "dollarAngle"] as const) {
              const angle = (lpRow2 as Record<string, any>)[col];
              if (angle && Array.isArray(angle.bonuses)) {
                lpBonusUpdate[col] = { ...angle, bonuses: realLpBonuses };
              }
            }
            if (Object.keys(lpBonusUpdate).length > 0) {
              await db.update(landingPages).set(lpBonusUpdate as any).where(eq(landingPages.id, landingPageId));
            }
          }

          // (c) Layer 2 — enqueue a DURABLE bonus-PDF job (jobs table, reaped-if-pending, resumable, self-healed
          // by reconcileBonusPdfs on Kit load). Rides the lead-magnet pipeline; populates
          // bonuses.assetBody/magnetHtmlUrl/magnetPdfUrl. Un-awaited so the wizard advances immediately; a
          // process recycle mid-run no longer orphans bonuses (the earlier fire-and-forget failure mode).
          void enqueueBonusPdfJob(input.userId, bonusResult.bonusSetId)
            .catch((e) => console.warn(`[orchestration] bonus PDF enqueue non-fatal: ${e instanceof Error ? e.message : e}`));
        }
      } catch (bonusErr) {
        console.warn(`[orchestration] bonus generation/fill non-fatal error: ${bonusErr instanceof Error ? bonusErr.message : bonusErr}`);
      }

      // Phase 1 (Problem A): apply the kit's UPFRONT campaign facts to the freshly-generated LP BEFORE the
      // auto-publish below — deterministic token substitution via applyOperatorAnswer (NOT a generator
      // prompt change; that's the Atlanta failure mode). Fills [INSERT_EVENT_*]/[INSERT_PRICE] with the
      // real date/venue/price across all generated angles, so the published page carries no placeholders.
      const lpFactAnswers = factsToTokenAnswers(kit?.campaignFacts);
      // A7 (item 10): event pages get a deterministic location sweep even when there are no facts to apply —
      // the prompt lock is primary, this guarantees no LLM-slipped city survives regardless.
      const isEventPage = pageType === "event_registration";
      const suppliedVenue = ((kit?.campaignFacts as any)?.eventSchedule?.venue ?? null) as string | null;
      if (lpFactAnswers.length > 0 || isEventPage) {
        const [lpRow] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
        if (lpRow) {
          const angleCols = ["originalAngle", "godfatherAngle", "freeAngle", "dollarAngle"] as const;
          const lpUpdate: Record<string, unknown> = {};
          for (const col of angleCols) {
            let angle = (lpRow as Record<string, any>)[col];
            if (!angle) continue;
            // Sweep fabricated cities → [INSERT_EVENT_VENUE] FIRST, then facts substitute the token → real venue.
            if (isEventPage) angle = sweepFabricatedLocationsDeep(angle, suppliedVenue);
            for (const fa of lpFactAnswers) angle = applyOperatorAnswer(angle, fa.token, fa.value).content;
            lpUpdate[col] = angle;
          }
          if (Object.keys(lpUpdate).length > 0) {
            await db.update(landingPages).set(lpUpdate as any).where(eq(landingPages.id, landingPageId));
          }
        }
      }

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
      // Registry-driven style selection. styleForPageType returns the per-reference
      // template for this pageType, or null when none is built yet. A null → stage
      // the LP as a review-draft (do NOT auto-publish): this honors the locked HARD
      // review gate for Auto/Has-Assets AND keeps the rejected "energetic" design
      // un-shipped for page types whose real template hasn't landed. Publishing
      // resumes automatically for a pageType the moment its template is registered.
      // (webinar/event additionally emit [INSERT_EVENT_*] tokens the publish gate
      // rejects — draft is the correct home until those fields are captured.)
      const publishStyle = styleForPageType(pageType);
      let lpPublished = false; // A10: gate node completion on a real publish, not on generatedId
      // Discovery requires a real per-coach booking URL — its CTA is a live calendar link,
      // and we never publish a dead "Book a Call" button. Absent → stage a review-draft
      // (same home as an unbuilt page type); the coach adds their booking URL in review,
      // then re-publishes. (Defense-in-depth: the template also emits [INSERT_BOOKING_URL]
      // when absent, which the publish placeholder hard-gate would reject anyway.)
      const discoveryNeedsBookingUrl =
        publishStyle === "discovery_burchard_performance" &&
        !(await getCoachBookingUrl(input.userId));
      // E2E prod-smoke containment (structural, env-gated, single identity): the designated test account NEVER
      // publishes — so routine post-deploy verification cannot write to the shared Cloudflare KV or create a
      // public /p/ page. FAILS SAFE: `E2E_NOPUBLISH_OPENID` unset → no effect on anyone; only an EXACT openId
      // match is skipped, and it stages the SAME review-draft (needs_publish) state as the other non-publish
      // paths (A10 handles it). Instantly disable-able by unsetting the env var. Cannot affect real coaches.
      let e2eNoPublish = false;
      const e2eNoPublishOpenId = process.env.E2E_NOPUBLISH_OPENID;
      if (e2eNoPublishOpenId) {
        const [e2eUser] = await db.select({ openId: users.openId }).from(users).where(eq(users.id, input.userId)).limit(1);
        e2eNoPublish = !!e2eUser && e2eUser.openId === e2eNoPublishOpenId;
      }
      if (!publishStyle || discoveryNeedsBookingUrl || e2eNoPublish) {
        const reason = e2eNoPublish
          ? "e2e test account (no-publish guard)"
          : !publishStyle
          ? `${pageType} has no per-reference template yet`
          : "discovery needs a coach booking URL";
        console.log(
          `[orchestration] landingPage ${landingPageId} staged as review-draft (${reason}); not auto-published.`,
        );
      } else {
        try {
          await progress(`Publishing your landing page…`);
          const { publicUrl, slug } = await runLandingPagePublish({
            userId: input.userId,
            landingPageId,
            styleMode: publishStyle,
          });
          console.log(`[orchestration] LP published to ${publicUrl} (slug=${slug})`);
          lpPublished = true;

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
      }

      // A10 (item 4): gate LP node completion on a real publish. On any non-publish outcome (review-draft,
      // unbuilt template, discovery-needs-booking, or a swallowed Cloudflare failure) flag the node
      // `needs_publish` — an explicit non-complete state (NOT a thrown error; the cascade must continue).
      // On a real publish, clear any lingering flag. The wizard reads this to avoid a false 11-of-11.
      if (kit?.id) {
        await db.delete(nodeStatuses).where(and(eq(nodeStatuses.campaignKitId, kit.id), eq(nodeStatuses.nodeType, "landingPage")));
        if (!lpPublished) {
          await db.insert(nodeStatuses).values({ campaignKitId: kit.id, nodeType: "landingPage", status: "needs_publish" });
        }
      }

      await progress(`Finalising your landing page…`);
      break;
    }
    case "emailSequence": {
      // Default sequenceType = "welcome" (matches V2 wizard default at
      // V2GeneratorWizard.tsx:2036). Per locked B-2 spec: do not commit
      // to "nurture" — wizard's pre-existing default IS welcome.
      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      // Fill the per-coach booking URL so discovery-call email CTAs resolve instead of
      // falling back to [INSERT_BOOKING_URL] (the pre-existing gap this closes). Null when
      // the coach hasn't supplied one → the builder keeps its token, as before.
      const emailBookingUrl = await getCoachBookingUrl(input.userId);
      // Phase 1 (Problem A): anchor the sequence to the kit's UPFRONT-captured facts (date/venue), not
      // bookingUrl-only — so it stops emitting [INSERT_EVENT_*] the coach has already answered.
      const emailEs = (kit?.campaignFacts?.eventSchedule ?? {}) as Record<string, string | undefined>;
      const { id } = await runEmailSequenceGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        sequenceType: "welcome",
        name: svc?.name ? `${svc.name} — Welcome Sequence` : "Welcome Sequence",
        eventDetails: { bookingUrl: emailBookingUrl ?? undefined, eventDate: emailEs.date, eventTime: emailEs.time, eventTimezone: emailEs.timezone, eventVenue: emailEs.venue },
      });
      generatedId = id;
      break;
    }
    case "whatsappSequence": {
      // Defaults match WA Zod schema: engagement / conversational / 3.
      const [svc] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      const waBookingUrl = await getCoachBookingUrl(input.userId);
      // Phase 1 (Problem A): length DERIVED from event-date proximity (was hardcoded 3); real facts.
      const waEs = (kit?.campaignFacts?.eventSchedule ?? {}) as Record<string, string | undefined>;
      // A supplied-but-unreadable date used to collapse into the same silent 3
      // as no date at all. Surface it: the coach's runway was real, we just
      // could not read it, and that is a defect worth seeing in the logs
      // rather than a shrug that looks like a deliberate short sequence.
      const waLength = resolveSequenceLength(waEs.date);
      if (waLength.status === "unparseable") {
        console.error(
          `[orchestration] WhatsApp sequence length FELL BACK to 3: an event date was supplied ` +
            `but could not be parsed (raw="${String(waEs.date).slice(0, 80)}"). The sequence is ` +
            `NOT runway-aware. Fix the capture path so dates normalise to ISO.`,
        );
      }
      const __waSequenceType = WHATSAPP_SEQUENCE_FOR_CAMPAIGN[input.campaignType ?? ""] ?? "nurture";
      const { id } = await runWhatsappSequenceGeneration({
        userId: input.userId,
        serviceId: input.serviceId,
        // P4: was hardcoded "engagement" for every campaign. That builder is written for
        // "the event the reader is about to attend" and anchors on [INSERT_EVENT_NAME], so a
        // lead-magnet campaign produced "You've already said yes to [INSERT_EVENT_NAME]" when
        // no event exists — a structural coherence break, not a token gap. Event-shaped
        // campaigns keep engagement; the rest nurture the person who just downloaded.
        sequenceType: __waSequenceType,
        // Label follows the SHAPE actually generated. It used to be hardcoded "Engagement"
        // while a lead-magnet campaign correctly produced a nurture sequence, so the kit
        // showed the coach a name that contradicted the content.
        name: (() => {
          const label = __waSequenceType === "engagement" ? "Engagement Sequence" : "Nurture Sequence";
          return svc?.name ? `${svc.name} — ${label}` : label;
        })(),
        tone: "conversational",
        sequenceLength: waLength.length,
        eventDetails: { bookingUrl: waBookingUrl ?? undefined, eventDate: waEs.date, eventTime: waEs.time, eventTimezone: waEs.timezone, eventVenue: waEs.venue },
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

      // Load ICP for audience-signal enrichment of the headlines prompt
      const [icp] = await db.select().from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, input.icpId)).limit(1);

      // Style routing is resolved BEFORE the headline call (hoisted 2026-08-01).
      // The headline micro-call is shared by two decks of different sizes, so it
      // has to be told which one is asking — the template-card deck renders five
      // cards and indexes headlines[i] for i < 5, while the tabloid deck is four.
      // Deriving one shared count from the tabloid deck is what took production
      // down with `headlines_wrong_count`.
      const adImageStyle = (freshKit as Record<string, unknown>)?.adImageStyle as string | null;
      const isTemplate = adImageStyle?.startsWith("quote_card") || adImageStyle?.startsWith("notification") || adImageStyle?.startsWith("testimonial") || adImageStyle?.startsWith("comparison_card");
      const isEditorial = adImageStyle?.startsWith("editorial");

      const headlines = await generateContextualAdHeadlines({
        productName: svc.name,
        mainBenefit: svc.mainBenefit ?? "",
        targetAudience: svc.targetCustomer ?? "",
        uniqueMechanism: mechanismName,
        pressingProblem,
        icpPains: icp?.pains || undefined,
        icpFears: icp?.fears || undefined,
        icpObjections: icp?.objections || undefined,
        icpBuyingTriggers: icp?.buyingTriggers || undefined,
      }, isTemplate ? TEMPLATE_CARD_FORMULAS : TABLOID_FORMULAS);

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

        // Comparison card: generate the ✗/✓ pairs ONCE (parallel, campaign-specific,
        // never parsed from prose), then rotate the lead pair per variation. Persisted
        // per-creative so an on-demand 9:16 re-renders from the SAME pairs.
        const comparisonPairs: ComparisonPair[] = styleKey === "comparison_card"
          ? await generateComparisonPairs({
              niche,
              mechanismName,
              mainBenefit: svc.mainBenefit ?? undefined,
              painPoints: svc.painPoints ?? undefined,
              failedSolutions: svc.failedSolutions ?? undefined,
              icpPains: icp?.pains ?? undefined,
              icpFrustrations: icp?.frustrations ?? undefined,
              icpObjections: icp?.objections ?? undefined,
            })
          : [];

        for (let i = 0; i < 5; i++) {
          let headline: string;
          let pngBuffer: Buffer;
          let variationPairs: ComparisonPair[] | null = null;

          if (styleKey === "comparison_card") {
            // Rotate so each of the 5 variations leads with a different pair.
            const off = comparisonPairs.length ? i % comparisonPairs.length : 0;
            variationPairs = comparisonPairs.slice(off).concat(comparisonPairs.slice(0, off));
            headline = `The old way vs. ${mechanismName}`;
            pngBuffer = await renderComparisonCard({
              method: mechanismName, pairs: variationPairs, palette, width: 1080, height: 1350,
            });
          } else if (styleKey === "testimonial" && i < svcTestimonials.length) {
            // Testimonial card — verbatim quote from the user's real data
            const t = svcTestimonials[i];
            pngBuffer = await renderTestimonialCard({ quote: t.quote, clientName: t.name, clientTitle: t.title || undefined, palette });
            headline = t.quote.slice(0, 250); // store quote snippet in headline column for display
          } else if (styleKey === "testimonial") {
            // Remaining slots after testimonials: headline cards as quote-card style
            headline = headlines[i - svcTestimonials.length].text;
            pngBuffer = await renderQuoteCard({ headline, attribution: svc.name, palette });
          } else if (styleKey === "notification") {
            headline = headlines[i].text;
            pngBuffer = await renderNotificationMockup({ headline, appName: svc.name, palette });
          } else {
            headline = headlines[i].text;
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
            headlineFormula: TEMPLATE_CARD_FORMULAS[i],
            headline,
            imageUrl,
            rawImageUrl: imageUrl,
            imageFormat: styleKey === "comparison_card" ? "1080x1350" : "1080x1080",
            // Comparison cards persist {palette, pairs} so makeVertical re-renders
            // the SAME card (same palette + pairs) at 9:16. NULL for every other style.
            comparisonPairs: variationPairs ? { palette, pairs: variationPairs } : null,
            complianceChecked: true,
            complianceIssues: null,
            batchId,
            variationNumber: i + 1,
          } as any);
        }
        generatedId = batchId;
      } else if (isEditorial) {
        // ── Editorial path: flux-2-pro gold-on-black + zone-aware text ──
        const { batchId } = await runEditorialAdCreativesGeneration({
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
          campaignType: input.campaignType,
        });
        generatedId = batchId;
      } else {
        // ── Tabloid photo-ad path: existing flux-1.1-pro pipeline, UNTOUCHED ──
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
          campaignType: input.campaignType,
        });
        generatedId = batchId;
      }
      break;
    }
  }

  // autoSelectBest: update the kit's selected*Id slot for this step.
  // landingPage already does this internally — skipAutoSelect set above.
  if (generatedId != null && !skipAutoSelect) {
    await autoSelectBest(input.userId, input.icpId, step.kitField, generatedId, input.campaignType ?? null);
  }

  return { skipped: false, generatedId, kitField: step.kitField };
}

export async function runOrchestration(input: OrchestrationInput): Promise<void> {
  // 🔴 F2 — born WITH campaignType, before any generator runs.
  // The kit used to be created by the first autoSelectBest call, which comes from a generator
  // (offersGenerator, step 1) passing only four arguments — so campaignType was never
  // persisted, and by the time orchestration passed it the row already existed and the value
  // was correctly ignored. Diagnosed twice. Creating the row here, first, is the whole fix;
  // it is deliberately NOT threaded through the seven generator call sites.
  try {
    const { ensureCampaignKit } = await import("../routers/campaignKits");
    await ensureCampaignKit(input.userId, input.icpId, input.campaignType ?? null);
  } catch (err) {
    // Never let kit pre-creation kill a cascade — autoSelectBest still creates it downstream.
    console.error("[orchestration] ensureCampaignKit failed:", err instanceof Error ? err.message : String(err));
  }

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
  // Steps that failed but were allowed to (step.optional). Reported on the job
  // result so the Kit can tell the coach which node did not produce, instead of
  // the whole run reading as a failure.
  const failedOptionalSteps: Array<{ step: string; error: string }> = [];

  for (const step of ORCHESTRATION_STEPS) {
    try {
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
    } catch (err: unknown) {
      // Load-bearing step — everything after it would build on a hole. Rethrow
      // and let the job fail, exactly as before this change.
      if (!step.optional) throw err;

      const message = err instanceof Error ? err.message : String(err);
      failedOptionalSteps.push({ step: step.name, error: message.slice(0, 500) });
      console.error(
        `[orchestration] Optional step "${step.name}" (${step.index}/${TOTAL_STEPS}) FAILED — ` +
          `continuing so the coach keeps the ${step.index - 1} completed nodes. Error: ${message}`,
      );
      // Progress is best-effort; never let a progress write fail the cascade.
      try {
        await writeProgress(step.index, `Couldn't finish ${ORCHESTRATION_STEP_LABELS[step.name]} — carrying on with the rest of your campaign`);
      } catch { /* non-fatal */ }
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
      // failedSteps is additive and omitted when empty, so existing readers of
      // { kitId } are unaffected.
      result: JSON.stringify({
        kitId: finalKit?.id ?? null,
        ...(failedOptionalSteps.length > 0 ? { failedSteps: failedOptionalSteps } : {}),
      }),
    })
    .where(eq(jobs.id, input.jobId));
}
