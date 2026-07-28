/**
 * groundingCorpus — the coach's OWN words, and nothing else.
 *
 * 🔴 THE CORRECTNESS POINT OF THIS WHOLE MODULE: the ICP prose is NOT ground truth.
 * It is model output. Even an ICP section that `groundingMeta` labels "stated" is
 * model output that happens to reuse the coach's vocabulary. Crediting it as
 * evidence would launder fabrication exactly one level down — a claim would be
 * "grounded" because it matched an invented ICP sentence. So the corpus is built
 * ONLY from what the coach actually supplied:
 *
 *   - services fields (typed by the coach, or extracted from their own document)
 *   - groundingMeta.ladderAnswers (their verbatim answers about real clients)
 *   - imported assets (has-assets path — these land in the service/offer rows)
 *   - supplied scalars (price, guarantee, testimonial names, customer counts…)
 *
 * groundingMeta's honest role here is twofold: it STORES the ladder answers (so
 * they survive a regenerate), and its ladderAnswered/corpusWords act as a
 * strictness signal — a coach who answered nothing has a thin corpus, so persona
 * claims are weakly traceable BY CONSTRUCTION. The right response to that is to
 * treat those claims as inferred (Class 2, label), never to pretend they are
 * grounded and never to block the coach over it.
 *
 * ── Beginner is a target user ────────────────────────────────────────────────
 * A brand-new coach has no program, no bonuses, no lead magnet and no clients.
 * They must be able to build a full campaign. Predictable CATEGORY PSYCHOLOGY
 * ("business owners worry about cash flow") is legitimate inference that every
 * marketer makes — it is NOT fabrication and is never blocked. What is blocked is
 * invented PROOF: testimonials, statistics, named third parties, unstated
 * guarantees, promised results, and a track record the coach has not earned.
 */

import { bonusSignificantWords } from "./validator";

/** Everything the coach actually supplied, as free text plus checkable scalars. */
export type CoachCorpus = {
  /** Concatenated coach-supplied prose — the only text a claim may be traced to. */
  text: string;
  /** Significant-word count. Low = thin input, so expect weak traceability. */
  words: number;
  /** Which laddered follow-ups the coach answered (from groundingMeta). */
  ladderAnswered: string[];
  /** True when the coach has supplied no proof of any kind (the beginner case). */
  isLaunchStage: boolean;
};

export type CoachCorpusInput = {
  service?: {
    name?: string | null;
    category?: string | null;
    description?: string | null;
    targetCustomer?: string | null;
    mainBenefit?: string | null;
    painPoints?: string | null;
    whyProblemExists?: string | null;
    uniqueMechanismSuggestion?: string | null;
    coachBackground?: string | null;
    pressFeatures?: string | null;
    socialProofStat?: string | null;
    totalCustomers?: number | null;
    totalReviews?: number | null;
    averageRating?: string | null;
    testimonial1Name?: string | null;
    testimonial2Name?: string | null;
    testimonial3Name?: string | null;
    testimonial1Quote?: string | null;
    testimonial2Quote?: string | null;
    testimonial3Quote?: string | null;
    price?: string | number | null;
    guaranteeType?: string | null;
    guaranteeDuration?: string | null;
    riskReversal?: string | null;
  } | null;
  /** The ICP row's groundingMeta — ONLY ladderAnswers is read from it. */
  groundingMeta?: unknown;
  /** Extra coach-supplied text (imported offer/method/lead-magnet copy). */
  importedText?: (string | null | undefined)[];
};

/** Pull the coach's verbatim ladder answers out of groundingMeta. Tolerant of legacy/NULL rows. */
export function readLadderAnswers(groundingMeta: unknown): Record<string, string> {
  if (!groundingMeta || typeof groundingMeta !== "object") return {};
  let obj = groundingMeta as Record<string, unknown>;
  if (typeof groundingMeta === "string") {
    try { obj = JSON.parse(groundingMeta); } catch { return {}; }
  }
  const raw = obj.ladderAnswers;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export function buildCoachCorpus(input: CoachCorpusInput): CoachCorpus {
  const s = input.service ?? {};
  const ladder = readLadderAnswers(input.groundingMeta);

  const parts: (string | null | undefined)[] = [
    s.name, s.category, s.description, s.targetCustomer, s.mainBenefit,
    s.painPoints, s.whyProblemExists, s.uniqueMechanismSuggestion,
    s.coachBackground, s.pressFeatures, s.socialProofStat,
    s.testimonial1Name, s.testimonial2Name, s.testimonial3Name,
    s.testimonial1Quote, s.testimonial2Quote, s.testimonial3Quote,
    ...Object.values(ladder),
    ...(input.importedText ?? []),
  ];

  const text = parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join(" \n");

  const hasProof =
    (s.totalCustomers ?? 0) > 0 ||
    (s.totalReviews ?? 0) > 0 ||
    parseFloat(s.averageRating ?? "0") > 0 ||
    !!(s.pressFeatures && s.pressFeatures.trim()) ||
    !!(s.socialProofStat && s.socialProofStat.trim()) ||
    !!(s.testimonial1Name || s.testimonial2Name || s.testimonial3Name) ||
    !!(s.coachBackground && s.coachBackground.trim());

  return {
    text,
    words: bonusSignificantWords(text).size,
    ladderAnswered: Object.keys(ladder),
    isLaunchStage: !hasProof,
  };
}

/**
 * The checkable scalars a proof claim is measured against. Mirrors the
 * SuppliedData contract the email/offer/bonus validators already use.
 */
export type ProofSupplied = {
  totalCustomers: number | null;
  totalReviews: number | null;
  averageRating: string | null;
  pressFeatures: string | null;
  socialProofStat: string | null;
  coachBackground: string | null;
  testimonialNames: (string | null | undefined)[];
  price: string | number | null;
  guaranteeType: string | null;
  guaranteeDuration: string | null;
};

export function buildProofSupplied(service: CoachCorpusInput["service"]): ProofSupplied {
  const s = service ?? {};
  return {
    totalCustomers: s.totalCustomers ?? null,
    totalReviews: s.totalReviews ?? null,
    averageRating: s.averageRating ?? null,
    pressFeatures: s.pressFeatures ?? null,
    socialProofStat: s.socialProofStat ?? null,
    coachBackground: s.coachBackground ?? null,
    testimonialNames: [s.testimonial1Name, s.testimonial2Name, s.testimonial3Name],
    // These were hardcoded to null, so a coach who HAD supplied a guarantee still had every
    // guarantee mention treated as invented. `services` carries all three columns; read them.
    price: s.price ?? null,
    guaranteeType: s.guaranteeType ?? s.riskReversal ?? null,
    guaranteeDuration: s.guaranteeDuration ?? null,
  };
}
