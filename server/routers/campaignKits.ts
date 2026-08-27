import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { campaignKits, idealCustomerProfiles, services, offers, nodeStatuses, users } from "../../drizzle/schema";
import type { LandingPageContent } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { deriveOperatorQuestions, deriveAnsweredOperatorFields, applyOperatorAnswer, expandOperatorAnswer } from "../lib/templates/operatorFields";
import { pageTypeForCampaign } from "../_core/orchestration";
import { getCoachBookingUrl } from "../lib/coachBookingUrl";

const MAX_KIT_NAME = 255;

/** Build a kit name from service + ICP, length-guarded to fit varchar(255).
 *  Keeps service name intact, elides ICP at a word boundary when needed. */
function buildKitName(serviceName: string | null | undefined, icpName: string | null | undefined): string {
  const svc = (serviceName ?? "").trim();
  const icp = (icpName ?? "").trim();
  if (!svc && !icp) return "Campaign";
  if (!svc) return icp.length <= MAX_KIT_NAME ? icp : `${icp.slice(0, MAX_KIT_NAME - 1)}…`;

  const suffix = " Campaign";
  const separator = " — ";
  // Service-only fallback when no ICP
  if (!icp) return `${svc}${suffix}`.slice(0, MAX_KIT_NAME);

  const full = `${svc}${separator}${icp}${suffix}`;
  if (full.length <= MAX_KIT_NAME) return full;

  // Truncate ICP portion at a word boundary
  const budget = MAX_KIT_NAME - svc.length - separator.length - suffix.length - 1; // -1 for "…"
  if (budget <= 10) return `${svc}${suffix}`.slice(0, MAX_KIT_NAME);
  const trimmed = icp.slice(0, budget).replace(/\s+\S*$/, "");
  return `${svc}${separator}${trimmed || icp.slice(0, budget)}…${suffix}`;
}

// Shared downstream maps — used by both updateSelection (re-crown) and
// markTweakStale (in-place edit) to propagate staleness consistently.
const STALE_FIELD_TO_NODE: Record<string, string> = {
  selectedOfferId: "offer",
  selectedMechanismId: "uniqueMethod",
  selectedHvcoId: "freeOptIn",
  selectedHeadlineId: "headlines",
  selectedAdCopyId: "adCopy",
  selectedLandingPageId: "landingPage",
  selectedEmailSequenceId: "emailSequence",
  selectedWhatsAppSequenceId: "whatsappSequence",
  selectedAdCreativeBatchId: "adCreatives",
};
const STALE_NODE_DOWNSTREAM: Record<string, string[]> = {
  offer: ["uniqueMethod", "freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  uniqueMethod: ["freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  freeOptIn: ["headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  headlines: ["adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  adCopy: ["landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  landingPage: ["emailSequence", "whatsappSequence", "adCreatives"],
  emailSequence: ["whatsappSequence", "adCreatives"],
  whatsappSequence: ["adCreatives"],
};
const STALE_NODE_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(STALE_FIELD_TO_NODE).map(([f, n]) => [n, f]),
);

/**
 * Mark every populated DOWNSTREAM node stale after a kit's selection pointer moved, and clear
 * stale on the node that just changed.
 *
 * ⚠️ THIS EXISTS BECAUSE THE POINTER MOVES THROUGH TWO PATHS AND ONLY ONE OF THEM USED TO SAY SO.
 * `updateSelection` (the UI re-crown) marked staleness; `autoSelectBest` — which every generator
 * and every cascade step calls — wrote the same pointer and marked nothing. Two representations of
 * "the selection changed", one of them silent, which is the drift shape this subsystem has now
 * produced five times. It is EXTRACTED rather than copied for exactly that reason: a second copy
 * would be the sixth.
 *
 * Measured on production before the fix: 3 stale rows in the entire table, every one of them from
 * the UI path, while 50 of 68 kits carried an upstream/downstream pair the generator path would
 * have marked.
 *
 * 🔑 A FRESH CASCADE MARKS NOTHING, and that is what makes this safe to ship rather than a change
 * of behaviour for every run. Each cascade step writes NULL -> id, so `oldValue == null` short-
 * circuits before any write. Only a genuine RE-CROWN over an existing kit marks anything.
 *
 * Never throws: a failure here must not break the pointer write that triggered it.
 *
 * @returns the node types marked stale (empty when this was not a re-crown)
 */
export async function markDownstreamStale(
  dbc: any,
  kitId: number,
  changedField: string,
  oldValue: unknown,
  newValue: unknown,
): Promise<string[]> {
  try {
    const changedNode = STALE_FIELD_TO_NODE[changedField];
    // Not a tracked selection field, or not a re-crown: nothing downstream has gone stale.
    if (!changedNode || oldValue == null || oldValue === newValue) return [];

    const [freshKit] = await dbc.select().from(campaignKits).where(eq(campaignKits.id, kitId)).limit(1);
    if (!freshKit) return [];

    // Only nodes that actually HAVE an asset can be stale. An unpopulated node is not out of date;
    // it does not exist.
    const staleNodes: string[] = [];
    for (const dsNode of STALE_NODE_DOWNSTREAM[changedNode] ?? []) {
      const dsField = STALE_NODE_TO_FIELD[dsNode];
      if (dsField && (freshKit as Record<string, unknown>)[dsField] != null) staleNodes.push(dsNode);
    }
    for (const nodeType of staleNodes) {
      await dbc.insert(nodeStatuses).values({ campaignKitId: kitId, nodeType, status: "stale" })
        .onDuplicateKeyUpdate({ set: { status: "stale", updatedAt: new Date() } });
    }
    // The changed node was just crowned fresh — clear any stale mark it carried.
    await dbc.delete(nodeStatuses).where(
      and(eq(nodeStatuses.campaignKitId, kitId), eq(nodeStatuses.nodeType, changedNode)),
    );
    return staleNodes;
  } catch (staleErr) {
    console.warn("[markDownstreamStale] stale propagation failed:", staleErr instanceof Error ? staleErr.message : staleErr);
    return [];
  }
}

/**
 * Find-or-create the cascade's kit. THE ONLY creation path — autoSelectBest delegates here.
 *
 * 🔴 F2. campaignType was threaded through every generator in memory but never persisted,
 * because the kit is BORN on the first autoSelectBest call and that first call comes from a
 * generator (offersGenerator.ts, step 1) which passes only four arguments. By the time
 * orchestration passed campaignType the kit already existed, so the value was correctly
 * ignored — it only applies on insert. Diagnosed twice before this fix.
 *
 * The remedy is to call this at the TOP of runOrchestration, before any generator runs, so
 * the row is born with the value. Deliberately NOT threaded through the seven generator call
 * sites: that is fragile and is what failed twice.
 *
 * Idempotent. On an existing kit it backfills campaignType only when the row has none, so a
 * kit created before this fix picks the value up rather than staying NULL forever.
 */
export async function ensureCampaignKit(
  userId: number,
  icpId: number,
  campaignType?: string | null,
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db
    .select()
    .from(campaignKits)
    .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icpId)))
    .limit(1);

  // ── CONCEPT SET — triggered here, four nodes ahead of ad copy ───────────────
  // Kit creation is the earliest point at which generating concepts is SAFE:
  // icps.sharpenWithLadder regenerates a profile in place and is documented as
  // sitting "BEFORE the kit exists, so nothing downstream has consumed the ICP
  // yet". Anything earlier would make a sharpen leave a stale concept set behind.
  //
  // Fired on EVERY call, not only on the insert branch, which makes it
  // self-healing: a set that failed to generate gets another attempt on the next
  // auto-select rather than never being retried. ensureConceptsForIcp is idempotent
  // three ways (existing set, deterministic job id, delete-then-insert), so the
  // repeat calls cost one indexed SELECT each and nothing more.
  //
  // Never awaited — the cascade must not wait on concepts, which is the whole
  // reason this generation is asynchronous in the first place.
  // ⚠️ serviceId IS LOAD-BEARING AND MUST BE PASSED. conceptGenerator builds its
  // grounding corpus only when a serviceId arrives (conceptGenerator.ts:226); with
  // none, `grounding` is undefined and the output gate — which runs
  // requireGrounding:true for concepts, by design, because concepts feed live ads —
  // fails closed with `fabrication_check_unavailable` on all three attempts and
  // writes nothing. The first version of this trigger omitted it and generated zero
  // concepts on a live proof run while reporting a clean "enqueued". The gate was
  // right; the caller was wrong.
  void (async () => {
    try {
      const [icpRow] = await db
        .select({ serviceId: idealCustomerProfiles.serviceId })
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, icpId))
        .limit(1);
      const { ensureConceptsForIcp } = await import("../conceptGenerator");
      const outcome = await ensureConceptsForIcp({ userId, icpId, serviceId: icpRow?.serviceId ?? null });
      if (outcome !== "exists") console.log(`[campaignKits] concepts for icp ${icpId}: ${outcome} (serviceId=${icpRow?.serviceId ?? "null"})`);
    } catch (err) {
      console.error(`[campaignKits] concept trigger failed for icp ${icpId}:`, err instanceof Error ? err.message : err);
    }
  })();

  if (existing) {
    if (campaignType && !existing.campaignType) {
      await db.update(campaignKits)
        .set({ campaignType: campaignType as any, updatedAt: new Date() })
        .where(eq(campaignKits.id, existing.id));
    }
    return existing.id;
  }

  const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  let serviceName: string | null = null;
  if (icp?.serviceId) {
    const [svc] = await db.select().from(services).where(eq(services.id, icp.serviceId)).limit(1);
    if (svc) serviceName = svc.name;
  }
  const result: any = await db.insert(campaignKits).values({
    userId,
    icpId,
    name: buildKitName(serviceName, icp?.name),
    campaignType: (campaignType ?? null) as any,
  });
  return result[0].insertId;
}

export async function autoSelectBest(
  userId: number,
  icpId: number,
  field: string,
  // Phase C C1: widened to number|string. 8 text-asset selectedXxxId fields
  // are numeric row IDs; selectedAdCreativeBatchId is a varchar(100) batchId
  // pointing to the adCreatives.batchId grouping. Both shapes go through
  // the same auto-select-on-cascade-completion path; Drizzle's set() accepts
  // either because the column types differ per field.
  itemId: number | string,
  // Auto Mode cascade fix: the cascade's kit is born HERE (this is the only
  // creation path runOrchestrationStep touches), and the insert below used to
  // write {userId, icpId, name} only — so campaignType was threaded correctly
  // through every generator in memory but never persisted on the kit row.
  // The explicit `create` mutation further down this file always set it; the
  // cascade never calls that path. Optional + ignored when the kit already
  // exists, so every existing caller keeps today's behaviour exactly.
  campaignType?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const kitId = await ensureCampaignKit(userId, icpId, campaignType);
  if (kitId == null) return;

  // The pointer's value BEFORE the write — the only thing that distinguishes a first crown from a
  // re-crown, and it is unreadable after the update.
  const [priorKit] = await db.select().from(campaignKits).where(eq(campaignKits.id, kitId)).limit(1);
  const priorValue = priorKit ? (priorKit as Record<string, unknown>)[field] : null;

  // Update the specific selection field
  await db
    .update(campaignKits)
    .set({ [field]: itemId, updatedAt: new Date() } as any)
    .where(eq(campaignKits.id, kitId));

  // Downstream nodes built against the OLD selection are now out of date, and until this call the
  // generator path said nothing. A first crown (priorValue == null) marks nothing, so every fresh
  // cascade behaves exactly as it did.
  await markDownstreamStale(db, kitId, field, priorValue, itemId);

  // Check completeness
  const [updated] = await db
    .select()
    .from(campaignKits)
    .where(eq(campaignKits.id, kitId))
    .limit(1);

  if (updated) {
    const isComplete =
      updated.selectedOfferId != null &&
      updated.selectedMechanismId != null &&
      updated.selectedHvcoId != null &&
      updated.selectedHeadlineId != null &&
      updated.selectedAdCopyId != null &&
      updated.selectedLandingPageId != null &&
      updated.selectedEmailSequenceId != null &&
      updated.selectedWhatsAppSequenceId != null &&
      // Phase C C1: ad creative batch required for new-cascade completeness.
      // Legacy kits (id ≤ 15) that completed before C1 already have
      // status='complete' set — this check only flips draft→complete, so
      // they're not retroactively re-evaluated. New Auto Mode runs after
      // C1 wait for adCreatives step 9 before flipping.
      updated.selectedAdCreativeBatchId != null;

    if (isComplete && updated.status === "draft") {
      const completionUpdate: Record<string, unknown> = { status: "complete", updatedAt: new Date() };

      // Names are now rich from creation. No completion rename needed —
      // the buildKitName pattern is the final name.

      await db.update(campaignKits).set(completionUpdate as any).where(eq(campaignKits.id, kitId));
    }
  }
}

export const campaignKitsRouter = router({
  /**
   * getOrCreate — finds or creates a campaign kit for a given ICP.
   * Auto-generates the name as "{serviceName} — {icpName} Campaign".
   */
  getOrCreate: protectedProcedure
    .input(z.object({
      icpId: z.number(),
      // Workstream commit 2.5b — optional funnel-type field. Sets the kit's
      // campaignType at creation time. Existing callsites that omit it leave
      // the column NULL (downstream generators default to course_launch).
      // The 7 enum values match campaignKits.campaignType (migration 0067).
      campaignType: z.enum([
        "webinar", "challenge", "course_launch", "product_launch",
        "discovery_call", "lead_magnet", "in_person_event",
      ]).optional(),
      // Trail Sprint 2 — optional entry path (migration 0076 column). When
      // omitted, behaviour is unchanged and the column stays NULL.
      path: z.enum(["auto", "manual", "has_assets"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check for existing kit
      const [existing] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, input.icpId)))
        .limit(1);

      if (existing) {
        // Trail Sprint 2: record/refresh the entry path when supplied
        // (path is mutable by design — users can switch mid-campaign).
        if (input.path && existing.path !== input.path) {
          await db
            .update(campaignKits)
            .set({ path: input.path, updatedAt: new Date() } as any)
            .where(eq(campaignKits.id, existing.id));
          return { ...existing, path: input.path };
        }
        return existing;
      }

      // Fetch ICP and service for name generation
      const [icp] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(and(eq(idealCustomerProfiles.id, input.icpId), eq(idealCustomerProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!icp) throw new TRPCError({ code: "NOT_FOUND", message: "ICP not found" });

      let serviceName: string | null = null;
      if (icp.serviceId) {
        const [svc] = await db
          .select()
          .from(services)
          .where(eq(services.id, icp.serviceId))
          .limit(1);
        if (svc) serviceName = svc.name;
      }

      const name = buildKitName(serviceName, icp.name);

      const result: any = await db.insert(campaignKits).values({
        userId: ctx.user.id,
        icpId: input.icpId,
        name,
        // Workstream commit 2.5b — write campaignType when supplied; null
        // otherwise. Generators default to course_launch when null.
        campaignType: input.campaignType ?? null,
        // Trail Sprint 2 — entry path when supplied; NULL otherwise.
        path: input.path ?? null,
      });

      const [newKit] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, result[0].insertId))
        .limit(1);

      return newKit;
    }),

  // ── Campaign facts (Phase 1 / Problem A) — capture operator facts UPFRONT, before any generation node ──
  // Kit-level twins of getPublishReadiness / answerOperatorField: the SAME intake resolver
  // (deriveOperatorQuestions / applyOperatorAnswer), sourced from campaignKits.campaignFacts
  // (eventSchedule + price) + the coach booking column, keyed off the kit's campaignType. Booking stays
  // coach-level (users column). Read later by orchestration's email/whatsapp/LP steps so they generate
  // with REAL facts (no hardcoded sequenceLength:3, no [INSERT_*] placeholders). Wizard path only.
  getCampaignFactsReadiness: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });
      const pageType = pageTypeForCampaign(kit.campaignType);
      const facts = (kit.campaignFacts ?? {}) as LandingPageContent;
      const bookingUrl = await getCoachBookingUrl(kit.userId);
      const questions = deriveOperatorQuestions(pageType, facts, { bookingUrl });
      const answered = deriveAnsweredOperatorFields(pageType, facts, { bookingUrl });

      // ── THE FREE NEXT STEP'S THREE FACTS — asked for a LEAD-MAGNET campaign, and OPTIONAL ──
      //
      // A lead-magnet campaign now also produces a free-event page for the magnet to bridge to,
      // and that page is `webinar_registration`, which cannot publish without date, time and
      // timezone. But `PAGETYPE_REQUIRED_TOKENS.lead_magnet_download` is `[]` — the magnet's own
      // opt-in page needs none of them — so nothing was asking.
      //
      // 🔴 OPTIONAL, NEVER REQUIRED, AND NEVER GENERATED. They are returned as their own list, not
      // merged into `questions`, so `ready` is unaffected and a coach who skips them is not
      // blocked. In Auto Mode nobody is there to answer, and a field that demands a value with
      // nothing true to put in it is exactly how the generator came to invent a seat cap in five
      // rows out of five. Skip them and the free-event page is not generated at all; the magnet
      // keeps the honest text card, which already ships and is already live.
      const freeStepTokens = ["[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]"];
      const freeStepQuestions = kit.campaignType === "lead_magnet"
        ? deriveOperatorQuestions("webinar_registration", facts, { bookingUrl })
            .filter((q: { token: string }) => freeStepTokens.includes(q.token))
        : [];
      const freeStepReady = kit.campaignType === "lead_magnet" && freeStepQuestions.length === 0;

      return {
        kitId: kit.id, campaignType: kit.campaignType, pageType,
        ready: questions.length === 0, remaining: questions.length, questions, answered,
        // Optional extras — the caller renders them as a skippable ask, never as a gate.
        freeStepQuestions, freeStepReady,
      };
    }),

  answerCampaignFact: protectedProcedure
    .input(z.object({ kitId: z.number(), token: z.string().max(60), answer: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });
      const pageType = pageTypeForCampaign(kit.campaignType);
      let facts = (kit.campaignFacts ?? {}) as LandingPageContent;
      let coachColumn: { column: string; value: string } | undefined;
      if (input.answer !== "__SKIP__") {
        // Front-load: a full datetime on the date question fills date+time+tz. applyOperatorAnswer sets the
        // structured field on the facts object (facts carry no copy → the copy-substitution is a no-op);
        // a coach-scoped answer (booking) comes back as coachColumn → users row.
        for (const w of expandOperatorAnswer(input.token, input.answer)) {
          const applied = applyOperatorAnswer(facts, w.token, w.value);
          facts = applied.content;
          if (applied.coachColumn) coachColumn = applied.coachColumn;
        }
        await db.update(campaignKits).set({ campaignFacts: facts as any }).where(eq(campaignKits.id, kit.id));
        if (coachColumn) {
          await db.update(users).set({ [coachColumn.column]: coachColumn.value } as any).where(eq(users.id, kit.userId));
        }
      }
      const bookingUrl = coachColumn?.column === "bookingUrl" ? coachColumn.value : await getCoachBookingUrl(kit.userId);
      const questions = deriveOperatorQuestions(pageType, facts, { bookingUrl });
      const answered = deriveAnsweredOperatorFields(pageType, facts, { bookingUrl });
      // Same free-next-step extras as getCampaignFactsReadiness — this mutation returns the UPDATED
      // readiness, so the two shapes must agree or the caller's state goes stale on the field that
      // decides whether the free-event page can be generated at all.
      const freeStepTokens = ["[INSERT_EVENT_DATE]", "[INSERT_EVENT_TIME]", "[INSERT_EVENT_TIMEZONE]"];
      const freeStepQuestions = kit.campaignType === "lead_magnet"
        ? deriveOperatorQuestions("webinar_registration", facts, { bookingUrl })
            .filter((q: { token: string }) => freeStepTokens.includes(q.token))
        : [];
      const freeStepReady = kit.campaignType === "lead_magnet" && freeStepQuestions.length === 0;
      return {
        kitId: kit.id, campaignType: kit.campaignType, pageType,
        ready: questions.length === 0, remaining: questions.length, questions, answered,
        freeStepQuestions, freeStepReady,
      };
    }),

  /**
   * updateSelection — updates any subset of the 9 selected*Id fields.
   * After updating, checks if all 9 are filled and sets status to "complete" if so.
   */
  updateSelection: protectedProcedure
    .input(z.object({
      kitId: z.number(),
      selectedOfferId: z.number().nullable().optional(),
      selectedMechanismId: z.number().nullable().optional(),
      selectedHvcoId: z.number().nullable().optional(),
      selectedHeadlineId: z.number().nullable().optional(),
      selectedAdCopyId: z.number().nullable().optional(),
      selectedLandingPageId: z.number().nullable().optional(),
      selectedLandingPageAngle: z.string().nullable().optional(),
      selectedEmailSequenceId: z.number().nullable().optional(),
      selectedWhatsAppSequenceId: z.number().nullable().optional(),
      selectedAdCreativeBatchId: z.string().nullable().optional(),
      adImageStyle: z.string().nullable().optional(),
      // Sprint 4 C3: mid-campaign path switching. Mutable by design (spec §4
      // line 134). Existing callers that omit it leave the column unchanged.
      path: z.enum(["auto", "manual", "has_assets"]).optional(),
      // Workstream commit 2.5b — optional funnel-type update. Lets the kit
      // owner change campaignType post-creation (used by commit 7's UI).
      // Nullable so callers can clear the field; existing callsites that
      // omit it leave the column unchanged (the loop below skips undefined).
      campaignType: z.enum([
        "webinar", "challenge", "course_launch", "product_launch",
        "discovery_call", "lead_magnet", "in_person_event",
      ]).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify ownership
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      // Build update object with only provided fields
      const { kitId, ...fields } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db
        .update(campaignKits)
        .set(updateData as any)
        .where(eq(campaignKits.id, input.kitId));

      // Track node_completed event (non-blocking)
      try {
        const { trackEvent } = await import("../lib/productEvents");
        const nodeField = Object.keys(fields).find(k => k.startsWith("selected") && (fields as any)[k] != null);
        if (nodeField) await trackEvent(ctx.user.id, "node_completed", { node: nodeField, kitId: input.kitId });
      } catch (_) { /* ignore */ }

      // ── Sprint 4 C2: server-side stale propagation ──────────────────────
      // On a RE-CROWN (a selected*Id field changes from one non-null value to
      // another), every DOWNSTREAM step that currently has a non-null
      // selected*Id gets marked stale in nodeStatuses. This fires for BOTH
      // the Trail and the wizard — one truth, both surfaces.
      // Stale propagation — the SAME helper the generator path calls. Behaviour is unchanged for
      // this caller; what changed is that it is no longer the only caller that does it.
      {
        const changedField = Object.keys(fields).find(k =>
          k.startsWith("selected") && (fields as any)[k] != null && k !== "selectedLandingPageAngle" && k !== "campaignType",
        );
        if (changedField) {
          await markDownstreamStale(
            db, input.kitId, changedField,
            (kit as Record<string, unknown>)[changedField], (fields as any)[changedField],
          );
        }
      }

      // Fetch updated row and check completeness
      const [updated] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, input.kitId))
        .limit(1);

      const isComplete =
        updated.selectedOfferId != null &&
        updated.selectedMechanismId != null &&
        updated.selectedHvcoId != null &&
        updated.selectedHeadlineId != null &&
        updated.selectedAdCopyId != null &&
        updated.selectedLandingPageId != null &&
        updated.selectedEmailSequenceId != null &&
        updated.selectedWhatsAppSequenceId != null;

      // Auto-update status if all slots are filled
      if (isComplete && updated.status === "draft") {
        await db
          .update(campaignKits)
          .set({ status: "complete", updatedAt: new Date() } as any)
          .where(eq(campaignKits.id, input.kitId));
        // Fire campaign_completed event
        try {
          const { trackEvent: te } = await import("../lib/productEvents");
          await te(ctx.user.id, "campaign_completed", { kitId: input.kitId });
        } catch (_) {}
      } else if (!isComplete && updated.status === "complete") {
        // If a selection is removed, revert to draft
        await db
          .update(campaignKits)
          .set({ status: "draft", updatedAt: new Date() } as any)
          .where(eq(campaignKits.id, input.kitId));
      }

      // Return final state
      const [final] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, input.kitId))
        .limit(1);

      return final;
    }),

  /**
   * markTweakStale — after an in-place tweak (content edit without ID change),
   * propagate staleness to all downstream nodes. Same logic as re-crown but
   * triggered explicitly by the client after a successful tweak.
   */
  markTweakStale: protectedProcedure
    .input(z.object({ kitId: z.number(), tweakedNode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify ownership
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND" });

      const downstream = STALE_NODE_DOWNSTREAM[input.tweakedNode] ?? [];
      const staleNodes: string[] = [];
      for (const dsNode of downstream) {
        const dsField = STALE_NODE_TO_FIELD[dsNode];
        if (dsField && (kit as Record<string, unknown>)[dsField] != null) {
          staleNodes.push(dsNode);
        }
      }
      for (const nodeType of staleNodes) {
        await db.insert(nodeStatuses).values({
          campaignKitId: input.kitId,
          nodeType,
          status: "stale",
        }).onDuplicateKeyUpdate({ set: { status: "stale", updatedAt: new Date() } });
      }
      return { staleCount: staleNodes.length };
    }),

  /**
   * getById — returns a single campaign kit by ID.
   */
  getById: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .query(async ({ ctx, input }) => {
      console.log(`[campaignKits.getById] kitId=${input.kitId} userId=${ctx.user.id}`);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      return kit;
    }),

  /**
   * getByUser — returns all campaign kits for the current user with ICP name joined.
   */
  getByUser: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const kits = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.userId, ctx.user.id));

      // Join ICP names
      const icpIds = [...new Set(kits.map(k => k.icpId))];
      const icpMap: Record<number, string> = {};
      if (icpIds.length > 0) {
        for (const icpId of icpIds) {
          const [icp] = await db
            .select({ id: idealCustomerProfiles.id, name: idealCustomerProfiles.name })
            .from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, icpId))
            .limit(1);
          if (icp) icpMap[icp.id] = icp.name;
        }
      }

      return kits.map(kit => ({
        ...kit,
        icpName: icpMap[kit.icpId] || "Unknown ICP",
      }));
    }),

  hasCompletedCampaign: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return false;
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.status, "complete")))
        .limit(1);
      return !!kit;
    }),

  /**
   * updateName — rename a campaign kit. Owner-scoped: only the kit owner
   * can rename it. Persists the user's custom title so it survives
   * regeneration (autoSelectBest never overwrites a non-default name).
   */
  updateName: protectedProcedure
    .input(z.object({
      kitId: z.number(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });
      }

      await db
        .update(campaignKits)
        .set({ name: input.name, updatedAt: new Date() } as any)
        .where(eq(campaignKits.id, input.kitId));

      return { success: true };
    }),

  // ── Wizard event tracking (client → product_events) ──
  trackWizardEvent: protectedProcedure
    .input(
      z.object({
        eventType: z.string(),
        // zod v4 requires explicit key schema — z.record(z.unknown()) parses
        // with an undefined value schema and 400s every call ("_zod" TypeError).
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { trackEvent } = await import("../lib/productEvents");
      await trackEvent(ctx.user.id, input.eventType, input.metadata);
      return { ok: true };
    }),
});
