/**
 * coachFacts — F1: the facts the COACH supplied, each with its provenance and time.
 *
 * WHY THIS EXISTS BESIDE `buildCoachCorpus`. The corpus is one flattened string in which model-written
 * text cannot be told apart from what the coach typed (kit 225: 3,832 chars, 1,077 typed by the coach),
 * and in which any figure present anywhere still grounds, however old. This builder returns facts, not
 * a string, and admits coach channels only:
 *
 *   ✅ `coachFacts` rows that are not superseded (migration 0111)
 *   ✅ `users.coachBackground`                      — account profile (read from USERS; the corpus reads
 *                                                     it from the services row, which has no such column)
 *   ✅ ICP ladder answers, verbatim                  — idealCustomerProfiles.groundingMeta.ladderAnswers
 *   ✅ the coach's typed answer to the method walkthrough's differentiator question
 *                                                     — coachMethods.rawMaterial, coach_stated tier only
 *   ✅ `services.pressFeatures`, `services.socialProofStat` — written only by the service form
 *   ✅ testimonial library rows with source = coach_supplied, placed as partitionProof places them
 *   ✅ A2 operator/campaign facts                    — campaignKits.campaignFacts, placeholderValues
 *
 *   🔴 never: expandProfile output, ICP prose, offers, mechanisms, concepts, scripts, the model's
 *      `coachMethods.differentiator` distillation, and the extractFromText rewording
 *      (description / targetCustomer / mainBenefit), because no coach confirmation of it is persisted.
 *
 * D-a (owner decision): a coach-CONFIRMED rewording is evidence for PRACTICE facts only, never biography.
 * Only a `coachFacts` row with sourceChannel `coach_confirmed_rewording` can carry one, and only for
 * slotKind `practice`.
 *
 * Single-valued slots: the latest coach-supplied value is canonical; older values are superseded, not
 * supplementary. Superseded values are returned separately (F2's "conflicts with the current fact").
 *
 * PURE: takes loaded rows and returns facts. No DB access, so it runs whether or not 0111 is applied.
 * §15d: NO production caller until sprint 2 (F2). `buildCoachCorpus` and the existing gate are untouched
 * (§15j).
 */

import { readLadderAnswers } from "./groundingCorpus";
import { ICP_LADDER_KEYS } from "./icpPrompts";
import { METHOD_WALKTHROUGH } from "./mechanismStandard";

export const COACH_FACT_KINDS = ["practice", "biography", "credential", "offer"] as const;
export type CoachFactKind = (typeof COACH_FACT_KINDS)[number];

/** Coach channels only. There is deliberately no member for generated text. Mirrors 0111's ENUM. */
export const COACH_FACT_SOURCES = [
  "coach_typed", "coach_confirmed_rewording", "ladder_answer", "operator_capture", "account_profile",
] as const;
export type CoachFactSource = (typeof COACH_FACT_SOURCES)[number];

export const COACH_FACT_SCOPES = ["account", "service"] as const;

/** One value at a time. The newest coach-supplied value wins; the rest are superseded. */
export const SINGLE_VALUED_SLOTS = [
  "people_trained", "countries", "years_experience", "clients_served", "headline_credential",
] as const;
export type SingleValuedSlot = (typeof SINGLE_VALUED_SLOTS)[number];

/** D-a: the only kinds a coach-confirmed rewording may evidence. Biography is never among them. */
export const REWORDING_ACCEPTED_KINDS: ReadonlySet<CoachFactKind> = new Set<CoachFactKind>(["practice"]);

/**
 * services columns written by a model (expandProfile / AutoPop). Excluded EVEN WHEN buyerIntelSource
 * tags a field coach_stated: that tag is set by a diff, and a one-character edit tags a whole field whose
 * remaining text is still generated.
 */
export const GENERATED_SERVICE_FIELDS = [
  "painPoints", "whyProblemExists", "failedSolutions", "falseBeliefsVsRealReasons", "hiddenReasons",
  "avatarName", "avatarTitle", "riskReversal", "uniqueMechanismSuggestion", "hvcoTopic",
  "applicationMethod", "mechanismDescriptor",
] as const;

/** extractFromText's rewording of the coach's text. No confirmation is persisted, so: not confirmed. */
export const UNCONFIRMED_REWORDING_SERVICE_FIELDS = ["description", "targetCustomer", "mainBenefit"] as const;

/**
 * services columns whose author the row cannot tell us. `name` comes out of the extraction ladder;
 * `buyerNegatives` is written by the extractor or typed, indistinguishably; testimonial1-3 are copied
 * from library rows of ANY source by testimonials.activateForService; the offer/count columns have no
 * verified coach-only writer.
 */
export const UNRECORDED_PROVENANCE_SERVICE_FIELDS = [
  "name", "buyerNegatives",
  "testimonial1Name", "testimonial1Quote", "testimonial2Name", "testimonial2Quote",
  "testimonial3Name", "testimonial3Quote",
  "price", "totalCustomers", "averageRating", "totalReviews", "bonuses",
  "guaranteeType", "guaranteeDuration", "deliveryFormat", "deliveryDuration", "paymentPlan", "earlyBirdPrice",
] as const;

/** Operator tokens that describe the coach's standing rather than the offer. */
const CREDENTIAL_TOKENS = new Set(["[INSERT_COACH_CREDENTIAL]", "[INSERT_AUTHORITY_TITLE]", "[INSERT_FEATURED_IN]"]);

export type CoachFact = {
  slot: string;
  kind: CoachFactKind;
  value: string;
  source: CoachFactSource;
  /** Where the value came from, e.g. "users:7.coach_background". Never empty. */
  sourceRef: string;
  /** When the coach supplied it. NULL = the storage records no per-fact time (row-level updatedAt is not one). */
  sourcedAt: Date | null;
};

export type CoachFactExclusionReason =
  | "generated"
  | "unconfirmed_rewording"
  | "rewording_not_evidence_for_kind"
  | "provenance_unrecorded"
  | "not_coach_supplied"
  | "wrong_table"
  | "wrong_owner"
  | "out_of_scope"
  | "orphaned_scope"
  | "superseded"
  | "invalid_row";

export type CoachFactExclusion = { sourceRef: string; reason: CoachFactExclusionReason };

/** A `coachFacts` row (0111). Enum columns are typed loosely and validated here, at runtime. */
export type CoachFactRowInput = {
  id: number;
  userId: number;
  serviceId: number | null;
  factScope: string;
  slot: string;
  slotKind: string;
  factValue: string | null;
  sourceChannel: string;
  sourceRef: string | null;
  sourcedAt: Date | string | null;
  supersededAt: Date | string | null;
};

type Row = { [field: string]: unknown };

export type BuildCoachFactsInput = {
  userId: number;
  /** The service the copy is for. Service-scoped facts for any other service are out of scope. */
  serviceId?: number | null;
  factRows?: CoachFactRowInput[] | null;
  user?: ({ id: number; coachBackground?: string | null } & Row) | null;
  service?: ({ id: number; userId: number } & Row) | null;
  icps?: Array<{ id: number; userId: number; serviceId?: number | null; groundingMeta?: unknown } & Row> | null;
  coachMethod?: ({
    id: number; userId: number; serviceId?: number | null; sourceTier?: string | null;
    rawMaterial?: unknown; differentiator?: string | null; updatedAt?: Date | string | null;
  } & Row) | null;
  testimonials?: Array<{
    id: number; userId: number; serviceId: number | null; quote: string | null;
    scope?: string | null; source?: string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null;
  }> | null;
  kit?: { id: number; userId: number; campaignFacts?: unknown } | null;
  placeholderValues?: Array<{
    id: number; userId: number; serviceId: number | null; token: string; value: string | null;
    updatedAt?: Date | string | null;
  }> | null;
};

export type CoachFactsResult = {
  /** Groundable: coach-supplied, current, in scope. */
  facts: CoachFact[];
  /** The current value of each single-valued slot that has one. */
  canonical: Partial<Record<SingleValuedSlot, CoachFact>>;
  /** Older values of single-valued slots, and rows marked supersededAt. NOT groundable. */
  superseded: CoachFact[];
  /** What was seen and refused, with why. */
  excluded: CoachFactExclusion[];
};

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
}

const isKind = (v: unknown): v is CoachFactKind => (COACH_FACT_KINDS as readonly unknown[]).includes(v);
const isSource = (v: unknown): v is CoachFactSource => (COACH_FACT_SOURCES as readonly unknown[]).includes(v);

export function buildCoachFacts(input: BuildCoachFactsInput): CoachFactsResult {
  const facts: CoachFact[] = [];
  const superseded: CoachFact[] = [];
  const excluded: CoachFactExclusion[] = [];
  const serviceId = input.serviceId ?? null;
  /** Insert order of table rows, for a deterministic tie-break when two sourcedAt values are equal. */
  const rowOrder = new Map<CoachFact, number>();

  const add = (f: CoachFact) => {
    const value = f.value.trim();
    if (value) facts.push({ ...f, value });
  };

  // ── 1. coachFacts rows ────────────────────────────────────────────────────────────────────────
  for (const r of input.factRows ?? []) {
    const ref = nonEmpty(r?.sourceRef) ? r.sourceRef.trim() : `coachFacts:${r?.id}`;
    if (!r || r.userId !== input.userId) { excluded.push({ sourceRef: ref, reason: "wrong_owner" }); continue; }
    const sourcedAt = toDate(r.sourcedAt);
    if (
      !isKind(r.slotKind) || !isSource(r.sourceChannel) ||
      !(COACH_FACT_SCOPES as readonly unknown[]).includes(r.factScope) ||
      !nonEmpty(r.slot) || !nonEmpty(r.factValue) || !nonEmpty(r.sourceRef) || !sourcedAt
    ) {
      excluded.push({ sourceRef: ref, reason: "invalid_row" });
      continue;
    }
    if (r.factScope === "service") {
      if (r.serviceId == null) { excluded.push({ sourceRef: ref, reason: "orphaned_scope" }); continue; }
      if (serviceId == null || r.serviceId !== serviceId) { excluded.push({ sourceRef: ref, reason: "out_of_scope" }); continue; }
    }
    if (r.sourceChannel === "coach_confirmed_rewording" && !REWORDING_ACCEPTED_KINDS.has(r.slotKind)) {
      excluded.push({ sourceRef: ref, reason: "rewording_not_evidence_for_kind" });
      continue;
    }
    const fact: CoachFact = {
      slot: r.slot.trim(), kind: r.slotKind, value: r.factValue.trim(),
      source: r.sourceChannel, sourceRef: ref, sourcedAt,
    };
    if (r.supersededAt != null) {
      superseded.push(fact);
      excluded.push({ sourceRef: ref, reason: "superseded" });
      continue;
    }
    rowOrder.set(fact, r.id);
    facts.push(fact);
  }

  // ── 2. users.coachBackground (the account profile) ───────────────────────────────────────────
  if (input.user) {
    const ref = `users:${input.user.id}.coach_background`;
    if (input.user.id !== input.userId) excluded.push({ sourceRef: ref, reason: "wrong_owner" });
    else if (nonEmpty(input.user.coachBackground)) {
      add({ slot: "coach_background", kind: "biography", value: input.user.coachBackground,
        source: "account_profile", sourceRef: ref, sourcedAt: null });
    }
  }

  // ── 3. services: two coach-typed proof fields; everything else is refused, with a reason ─────
  const svc = input.service;
  if (svc) {
    const base = `services:${svc.id}`;
    if (svc.userId !== input.userId) excluded.push({ sourceRef: base, reason: "wrong_owner" });
    else if (serviceId != null && svc.id !== serviceId) excluded.push({ sourceRef: base, reason: "out_of_scope" });
    else {
      if (nonEmpty(svc.pressFeatures)) {
        add({ slot: "press_features", kind: "credential", value: svc.pressFeatures,
          source: "coach_typed", sourceRef: `${base}.pressFeatures`, sourcedAt: null });
      }
      if (nonEmpty(svc.socialProofStat)) {
        add({ slot: "social_proof_stat", kind: "credential", value: svc.socialProofStat,
          source: "coach_typed", sourceRef: `${base}.socialProofStat`, sourcedAt: null });
      }
      const refuse = (fields: readonly string[], reason: CoachFactExclusionReason) => {
        for (const k of fields) {
          const v = svc[k];
          if (nonEmpty(v) || typeof v === "number") excluded.push({ sourceRef: `${base}.${k}`, reason });
        }
      };
      refuse(GENERATED_SERVICE_FIELDS, "generated");
      refuse(UNCONFIRMED_REWORDING_SERVICE_FIELDS, "unconfirmed_rewording");
      refuse(UNRECORDED_PROVENANCE_SERVICE_FIELDS, "provenance_unrecorded");
      // The corpus reads coachBackground from here. services has no such column; a value on this object
      // is not the coach's profile and never grounds.
      refuse(["coachBackground"], "wrong_table");
    }
  }

  // ── 4. ICP ladder answers, verbatim. ICP prose is never read. ────────────────────────────────
  for (const icp of input.icps ?? []) {
    const base = `idealCustomerProfiles:${icp.id}`;
    if (icp.userId !== input.userId) { excluded.push({ sourceRef: base, reason: "wrong_owner" }); continue; }
    if (serviceId != null && icp.serviceId != null && icp.serviceId !== serviceId) {
      excluded.push({ sourceRef: base, reason: "out_of_scope" });
      continue;
    }
    // readLadderAnswers returns {} for a string (its string branch sits after an object-only guard), so
    // a JSON string is parsed here first. groundingCorpus.ts is deliberately left untouched (§15j).
    const answers = readLadderAnswers(parseJson(icp.groundingMeta));
    for (const key of ICP_LADDER_KEYS) {
      if (nonEmpty(answers[key])) {
        add({ slot: `ladder_${key}`, kind: "practice", value: answers[key], source: "ladder_answer",
          sourceRef: `${base}.groundingMeta.ladderAnswers.${key}`, sourcedAt: null });
      }
    }
  }

  // ── 5. Method walkthrough: the coach's own typed answer to the differentiator question ───────
  const m = input.coachMethod;
  if (m) {
    const base = `coachMethods:${m.id}`;
    if (m.userId !== input.userId) excluded.push({ sourceRef: base, reason: "wrong_owner" });
    else if (m.serviceId != null && serviceId != null && m.serviceId !== serviceId) {
      excluded.push({ sourceRef: base, reason: "out_of_scope" });
    } else {
      // The stored `differentiator` is a fresh model distillation made at save time, and the reflect-back
      // the coach confirms shows only the steps. It was never shown to the coach.
      if (nonEmpty(m.differentiator)) excluded.push({ sourceRef: `${base}.differentiator`, reason: "generated" });
      if (m.sourceTier !== "coach_stated") {
        excluded.push({ sourceRef: `${base}.rawMaterial`, reason: "not_coach_supplied" });
      } else {
        const raw = parseJson(m.rawMaterial);
        const turns = Array.isArray(raw) ? raw : [];
        const question = METHOD_WALKTHROUGH.differentiator.trim();
        for (let i = 0; i + 1 < turns.length; i++) {
          const q = turns[i] as { label?: unknown; text?: unknown } | null;
          const a = turns[i + 1] as { label?: unknown; text?: unknown } | null;
          if (q?.label === "zappy asked" && typeof q.text === "string" && q.text.trim() === question
            && a?.label === "coach" && nonEmpty(a.text)) {
            add({ slot: "method_differentiator", kind: "practice", value: a.text, source: "coach_typed",
              sourceRef: `${base}.rawMaterial[${i + 1}]`, sourcedAt: toDate(m.updatedAt) });
          }
        }
      }
    }
  }

  // ── 6. Testimonial library: coach_supplied only, placed exactly as partitionProof places it ──
  for (const t of input.testimonials ?? []) {
    const ref = `testimonials:${t.id}`;
    if (t.userId !== input.userId) { excluded.push({ sourceRef: ref, reason: "wrong_owner" }); continue; }
    if (t.source !== "coach_supplied") { excluded.push({ sourceRef: ref, reason: "not_coach_supplied" }); continue; }
    const placed =
      (t.scope === "service_specific" && serviceId != null && t.serviceId === serviceId) || t.scope === "coach_portable";
    if (!placed) {
      excluded.push({ sourceRef: ref, reason: t.scope == null ? "provenance_unrecorded" : "out_of_scope" });
      continue;
    }
    if (nonEmpty(t.quote)) {
      add({ slot: "testimonial", kind: "credential", value: t.quote, source: "coach_typed", sourceRef: ref,
        sourcedAt: toDate(t.updatedAt) ?? toDate(t.createdAt) });
    }
  }

  // ── 7. A2: operator-captured campaign facts ──────────────────────────────────────────────────
  const kit = input.kit;
  if (kit) {
    const base = `campaignKits:${kit.id}.campaignFacts`;
    if (kit.userId !== input.userId) excluded.push({ sourceRef: base, reason: "wrong_owner" });
    else {
      const cf = parseJson(kit.campaignFacts) as { eventSchedule?: Row | null; price?: Row | null } | null;
      const es = cf && typeof cf === "object" ? cf.eventSchedule : null;
      for (const k of ["date", "time", "timezone", "venue"] as const) {
        const v = es && typeof es === "object" ? es[k] : null;
        if (nonEmpty(v)) {
          add({ slot: `event_${k}`, kind: "offer", value: v, source: "operator_capture",
            sourceRef: `${base}.eventSchedule.${k}`, sourcedAt: null });
        }
      }
      const amount = cf && typeof cf === "object" && cf.price && typeof cf.price === "object" ? cf.price.amount : null;
      if (nonEmpty(amount) || typeof amount === "number") {
        add({ slot: "offer_price", kind: "offer", value: String(amount), source: "operator_capture",
          sourceRef: `${base}.price.amount`, sourcedAt: null });
      }
    }
  }

  // Operator tokens: the campaign row for this service wins over the account default for the same token.
  const pvs = (input.placeholderValues ?? []).filter((p) => {
    if (p.userId !== input.userId) { excluded.push({ sourceRef: `placeholderValues:${p.id}`, reason: "wrong_owner" }); return false; }
    if (p.serviceId != null && p.serviceId !== serviceId) {
      excluded.push({ sourceRef: `placeholderValues:${p.id}`, reason: "out_of_scope" });
      return false;
    }
    return true;
  });
  const byToken = new Map<string, (typeof pvs)[number]>();
  for (const p of pvs) {
    const prior = byToken.get(p.token);
    if (!prior || (prior.serviceId == null && p.serviceId != null)) byToken.set(p.token, p);
  }
  for (const p of Array.from(byToken.values())) {
    if (!nonEmpty(p.value) || p.value.trim() === "__SKIP__") continue;
    const inner = p.token.replace(/^\[INSERT_/, "").replace(/\]$/, "").toLowerCase();
    add({ slot: `operator_token:${inner}`, kind: CREDENTIAL_TOKENS.has(p.token) ? "credential" : "offer",
      value: p.value, source: "operator_capture", sourceRef: `placeholderValues:${p.id}`,
      sourcedAt: toDate(p.updatedAt) });
  }

  // ── 8. Single-valued slots: newest sourcedAt is canonical; the rest are superseded ───────────
  const canonical: Partial<Record<SingleValuedSlot, CoachFact>> = {};
  const time = (f: CoachFact) => (f.sourcedAt ? f.sourcedAt.getTime() : Number.NEGATIVE_INFINITY);
  for (const slot of SINGLE_VALUED_SLOTS) {
    const candidates = facts.filter((f) => f.slot === slot);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => time(b) - time(a) || (rowOrder.get(b) ?? -1) - (rowOrder.get(a) ?? -1));
    canonical[slot] = candidates[0];
    for (const older of candidates.slice(1)) {
      facts.splice(facts.indexOf(older), 1);
      superseded.push(older);
      excluded.push({ sourceRef: older.sourceRef, reason: "superseded" });
    }
  }
  return { facts, canonical, superseded, excluded };
}
