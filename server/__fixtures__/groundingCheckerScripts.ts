/**
 * Fixtures for the sprint-2 grounding checker — WHOLE SCRIPTS, not single sentences (addendum §4 caveat).
 *
 * Expected verdicts were written BEFORE the checker was run against a real model, and are not tuned to
 * its output (§15c). They are read by `server/groundingChecker.test.ts` (self-consistency, scorer) and by
 * `server/scripts/grounding-checker-eval.ts` (live runs). Facts come from these fixtures through the real
 * `buildCoachFacts`; nothing here touches a database.
 *
 * An anchor set is a list of alternatives: an expected item is matched when a finding's quote contains ANY
 * of its anchors (after normaliseForMatch). A single quote may satisfy two items (e.g. an age and a family
 * member in one clause) — recall is therefore lenient on clause granularity, and the report says so.
 *
 * §14a: this is a TEST FIXTURE surface. Bad examples are required here; none of this text is a prompt.
 */

import type { BuildCoachFactsInput } from "../_core/coachFacts";
import {
  normaliseForMatch,
  type CheckedAsset,
  type GroundingCheckResult,
  type SpeakerClaimFinding,
} from "../_core/groundingChecker";

export type AnchorSet = string[];

export type GroundingFixtureExpectations = {
  /** Specific biography expected `ungrounded`. */
  flagBiography: AnchorSet[];
  /** Specific biography expected `grounded`. */
  groundBiography: AnchorSet[];
  conflicts: AnchorSet[];
  overstated: AnchorSet[];
  /** Offer-outcome controls expected `grounded` and NOT `overstated`. */
  groundedNotOverstated: AnchorSet[];
  financialFind: AnchorSet[];
  /** Explicit F5 controls: any finding on these lines is a false positive, reported by name. */
  financialNotFind: AnchorSet[];
  /**
   * F5 lines RULED ambiguous by Arfeen (2026-09-22), not by the checker's behaviour: a personal-voice hook
   * that reads as a finance claim to every rule tried against it. Findings on these lines are REPORTED every
   * run, and counted as neither a false positive nor a promotion blocker.
   *
   * §15-PARENT: this exists so the flag stays VISIBLE. Deleting the line from `financialNotFind` instead would
   * have stopped the scorer reporting it while the checker went on flagging it in production — the failure
   * moved out of sight rather than out of the product.
   */
  financialAmbiguous: AnchorSet[];
  /** D-c control: zero flagged specific biography AND at least this many `not_checkable` claims (§15k). */
  dcControl: { minNotCheckable: number } | null;
};

export type GroundingFixture = {
  id: string;
  description: string;
  source: string;
  asset: CheckedAsset;
  facts: BuildCoachFactsInput;
  expect: GroundingFixtureExpectations;
};

const NONE: GroundingFixtureExpectations = {
  flagBiography: [], groundBiography: [], conflicts: [], overstated: [], groundedNotOverstated: [],
  financialFind: [], financialNotFind: [], financialAmbiguous: [], dcControl: null,
};

const script = (id: string, text: string): CheckedAsset => ({ assetType: "script", assetId: id, fields: [{ name: "spoken", text }] });

const U = 9001;
const SVC = 318;

// ── kit 225, script 229 (concept 229, unaware/meme_humor, 60s): SAY lines joined, verbatim ─────────────
const SCRIPT_229 = [
  "Me at forty-four, watching my youngest leave for university, finally ready to launch the consulting business — opening a notes app full of niche ideas I've been 'thinking about' since 2021.",
  "Here's what I kept running into. Every niche exercise I tried was built for someone without experience — not for someone who spent twelve years running procurement for a global firm.",
  "The worksheet asks what you enjoy. It never asks which part of what you already know your former industry will actually pay for. Those are two completely different questions.",
  "So I built a forensic process — Career Layer Excavation — that separates the expertise you have from the professional identity corporate trained you to perform. Then scripts your first three outreach conversations, sentence by sentence.",
  "It's a free masterclass. Click below, grab The First Client Blueprint, and walk out holding the exact process — plus your first three outreach scripts, written. Every quarter without this is another quarter that notes app stays closed.",
].join(" ");

/** Kit 225's coach-supplied material: ladder answers verbatim, account background, and the intake rewording (refused by the builder). */
const KIT_225_FACTS: BuildCoachFactsInput = {
  userId: U,
  serviceId: SVC,
  user: { id: U, coachBackground: "mind coach" },
  service: {
    id: SVC, userId: U,
    description: "I run a coaching practice helping women who have decided to return to work after leaving their professional careers for their family and now that the children are grown up they want to become entrepreneurs.",
  },
  icps: [{
    id: 1, userId: U, serviceId: SVC,
    groundingMeta: { ladderAnswers: {
      trigger: "They had lost the confidence. They wanted to start they initially thought about going back to a job but then they thought no they have to build legacy wealth for their family. So they didn't have many ideas. All they knew is that they wanted to become entrepreneurs and didn't have the skills but now know that there's artificial intelligence that could help them.",
      priorAttempts: "They done research online, watched YouTube videos, but they tried but it was too complex.",
      hesitation: "They liked the product but they were unsure of themselves so what was going to stop them from saying yes was their own limiting beliefs.",
      successMoment: "They said without the support, without the other people in the mastermind, without the systematic process that I offered them, they would never have done it and it was worth it.",
    } },
  }],
};

// ── coach-voice P1 (docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md) ─
const SCRIPT_P1 = [
  "Nobody's building a pension behind a salary any more.",
  "Twenty-five years of asking why people never start, and there are only ever four patterns. Not four hundred. Four.",
  "None of them is money. Not one is about crypto being complicated.",
  "The most careful people I meet have built the least, and that is pattern one. They aren't careless. They're waiting for a level of certainty that never arrives, and the waiting looks responsible from the outside.",
  "Sunday I take you through all four, and most people know theirs inside ten minutes.",
  "Then my brother Shez shows you how digital assets actually work. From zero, nothing assumed.",
  "Two hours, live, free. Link's below.",
].join(" ");

const EVENT_KIT = (id: number) => ({
  id, userId: U,
  campaignFacts: { eventSchedule: { date: "Sunday", time: "two hours, live online", timezone: "", venue: "live online" } },
});

const factRow = (id: number, slot: string, slotKind: string, factValue: string, sourcedAt: string) => ({
  id, userId: U, serviceId: null, factScope: "account", slot, slotKind, factValue,
  sourceChannel: "coach_typed", sourceRef: `coachFacts:${id}`, sourcedAt, supersededAt: null,
});

const P1_WITH_FACTS: BuildCoachFactsInput = {
  userId: U,
  serviceId: SVC,
  factRows: [
    factRow(1, "years_experience", "biography", "Twenty-five years", "2026-09-10T00:00:00Z"),
    factRow(2, "presenter", "biography", "My brother Shez presents the digital assets part of the session", "2026-09-10T00:00:00Z"),
  ],
  kit: EVENT_KIT(501),
};

const P1_WITHOUT_FACTS: BuildCoachFactsInput = { userId: U, serviceId: SVC, kit: EVENT_KIT(502) };

// ── D-c control: first-person moments with no checkable fact ───────────────────────────────────────
const SCRIPT_DC = [
  "Most people who want to start a business already have the idea. They just never open the laptop.",
  "I remember the morning I finally sent that first message. I wanted to delete it straight away.",
  "That feeling doesn't mean you're not ready. It means you've started.",
  "The method is simple. Name one problem you already solve at work, then write to one person who has it.",
  "On Sunday we do that together. Link's below.",
].join(" ");

const DC_FACTS: BuildCoachFactsInput = {
  userId: U,
  serviceId: SVC,
  icps: [{
    id: 2, userId: U, serviceId: SVC,
    groundingMeta: { ladderAnswers: {
      hesitation: "They were scared that nobody would reply, so they kept rewriting the first message and never sent it.",
      successMoment: "The first time someone replied yes, they realised the idea had been ready for months.",
    } },
  }],
  kit: EVENT_KIT(503),
};

// ── F5 controls in script context ─────────────────────────────────────────────────────────────────
const SCRIPT_F5 = [
  "You're well paid, and most of what you've earned is sitting in a current account.",
  "Your savings haven't moved in three years.",
  "Behind on your credit card again?",
  "You can't afford to get this wrong, so let's slow down.",
  "Plenty of people in their fifties have more money than time.",
  "If you're earning well and want a plan for it, this session is for you.",
  "On Sunday I walk through how digital assets actually work, from zero. Two hours, live, free. Link's below.",
].join(" ");

const F5_FACTS: BuildCoachFactsInput = { userId: U, serviceId: SVC, kit: EVENT_KIT(504) };

// ── conflicts_with_current_fact: copy says 49 countries; the canonical slot says 52 ──────────────────
const SCRIPT_CONFLICT = [
  "Most people think confidence comes first. It doesn't.",
  "I've coached people in forty-nine countries, and the pattern is the same everywhere.",
  "Twenty-five years in, the people who start are rarely the most certain ones.",
  "They pick one small step and take it before they feel ready.",
  "That's what we do together on Sunday. Link's below.",
].join(" ");

const CONFLICT_FACTS: BuildCoachFactsInput = {
  userId: U,
  serviceId: SVC,
  factRows: [
    factRow(11, "countries", "credential", "49", "2025-01-15T00:00:00Z"),
    factRow(12, "countries", "credential", "52", "2026-09-01T00:00:00Z"),
    factRow(13, "years_experience", "biography", "25 years of coaching", "2026-09-01T00:00:00Z"),
  ],
  kit: EVENT_KIT(505),
};

// ── overstated certainty on an offer outcome ──────────────────────────────────────────────────────
const SCRIPT_CERTAINTY = [
  "Most people who want to change careers already know what they're good at.",
  "What they can't see is the pattern that keeps them waiting.",
  "By the end of the session you will know exactly which pattern is yours, guaranteed.",
  "You'll also leave with a written plan for your first week.",
  "It's free, it's live, and it's this Sunday. Link's below.",
].join(" ");

const CERTAINTY_FACTS: BuildCoachFactsInput = {
  userId: U,
  serviceId: SVC,
  icps: [{
    id: 3, userId: U, serviceId: SVC,
    groundingMeta: { ladderAnswers: {
      successMoment: "By the end of the session most people can name the pattern that has been keeping them waiting.",
      priorAttempts: "Clients leave the session with a written plan for their first week.",
    } },
  }],
  kit: EVENT_KIT(506),
};

export const GROUNDING_FIXTURES: GroundingFixture[] = [
  {
    id: "k225-s229",
    description: "Kit 225, script 229 whole. Invented biography; only the ladder answers and 'mind coach' are coach-supplied.",
    source: "scratchpad threadb-grounding/scripts.txt, concept 229 (SAY lines)",
    asset: script("229", SCRIPT_229),
    facts: KIT_225_FACTS,
    expect: {
      ...NONE,
      flagBiography: [["forty-four"], ["youngest", "university"], ["procurement", "global firm", "twelve years"], ["since 2021"]],
    },
  },
  {
    id: "p1-with-facts",
    description: "Coach-voice P1 with the coach's facts supplied: twenty-five years, and the presenter's brother Shez.",
    source: "docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md, P1",
    asset: script("P1-with-facts", SCRIPT_P1),
    facts: P1_WITH_FACTS,
    expect: {
      ...NONE,
      groundBiography: [["twenty-five years"], ["shez"]],
      financialNotFind: [["none of them is money"]],
      financialAmbiguous: [["pension behind a salary"]],
    },
  },
  {
    id: "p1-without-facts",
    description: "The same P1 script with the two biography facts removed. Only the event facts remain.",
    source: "docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md, P1",
    asset: script("P1-without-facts", SCRIPT_P1),
    facts: P1_WITHOUT_FACTS,
    expect: {
      ...NONE,
      flagBiography: [["twenty-five years"], ["shez"]],
      financialNotFind: [["none of them is money"]],
      financialAmbiguous: [["pension behind a salary"]],
    },
  },
  {
    id: "dc-control",
    description: "D-c control: the only first-person moments are unspecific colour.",
    source: "synthetic, written for sprint 2",
    asset: script("dc-control", SCRIPT_DC),
    facts: DC_FACTS,
    expect: { ...NONE, dcControl: { minNotCheckable: 1 } },
  },
  {
    id: "f5-controls",
    description: "F5 in script context: second-person viewer finance (find) beside the idiom, a third-person money line and a conditional (do not find).",
    source: "synthetic, written for sprint 2 (lines adapted from the addendum §4 probe)",
    asset: script("f5-controls", SCRIPT_F5),
    facts: F5_FACTS,
    expect: {
      ...NONE,
      financialFind: [["well paid", "what you've earned", "current account"], ["your savings"], ["credit card"]],
      financialNotFind: [["can't afford"], ["people in their fifties", "more money than time"], ["if you're earning well"]],
    },
  },
  {
    id: "conflict-countries",
    description: "Copy says forty-nine countries; the canonical countries slot is 52 (49 is superseded). Control: twenty-five years matches its canonical slot.",
    source: "synthetic, written for sprint 2",
    asset: script("conflict-countries", SCRIPT_CONFLICT),
    facts: CONFLICT_FACTS,
    expect: { ...NONE, conflicts: [["forty-nine"]], groundBiography: [["twenty-five years"]] },
  },
  {
    id: "certainty",
    description: "An offer outcome stated with 'exactly … guaranteed' where the coach's words carry no such certainty; control: a grounded outcome without a marker.",
    source: "synthetic, written for sprint 2",
    asset: script("certainty", SCRIPT_CERTAINTY),
    facts: CERTAINTY_FACTS,
    expect: { ...NONE, overstated: [["exactly which pattern", "guaranteed"]], groundedNotOverstated: [["written plan"]] },
  },
];

// ── Scoring (shared by the unit test and the live harness) ─────────────────────────────────────────

export const matchesAnchor = (quote: string, set: AnchorSet) => {
  const q = normaliseForMatch(quote);
  return set.some((a) => q.includes(normaliseForMatch(a)));
};

export type ItemScore = { expected: number; found: number; missed: string[] };

export type FixtureRunScore = {
  status: GroundingCheckResult["status"];
  /** Specific biography flagged ungrounded / conflicts, against flagBiography. */
  bio: ItemScore & { flagged: number; falsePositives: string[] };
  grounding: ItemScore;
  conflicts: ItemScore & { falsePositives: string[] };
  overstated: ItemScore & { falsePositives: string[] };
  groundedNotOverstated: ItemScore;
  f5: ItemScore & { findings: number; falsePositives: string[]; controlHits: string[]; ambiguousHits: string[] };
  notCheckable: number;
  dcPass: boolean | null;
};

const isFlaggedBio = (c: SpeakerClaimFinding) =>
  c.biography && c.specificity === "specific" && (c.verdict === "ungrounded" || c.verdict === "conflicts_with_current_fact");

function items(sets: AnchorSet[], hit: (set: AnchorSet) => boolean, usable: boolean): ItemScore {
  const missed = sets.filter((s) => !usable || !hit(s)).map((s) => s[0]);
  return { expected: sets.length, found: sets.length - missed.length, missed };
}

/**
 * A run that did not finish `checked` scores every expected item as MISSED and contributes no false
 * positives: an extraction failure is never read as a clean negative (§15-PARENT).
 */
export function scoreFixtureRun(fx: GroundingFixture, r: GroundingCheckResult): FixtureRunScore {
  const usable = r.status === "checked";
  const claims = usable ? r.speakerClaims : [];
  const fins = usable ? r.viewerFinancialFindings : [];
  const e = fx.expect;
  const flagged = claims.filter(isFlaggedBio);
  const bioAnchors = [...e.flagBiography, ...e.conflicts];
  const conflictClaims = claims.filter((c) => c.verdict === "conflicts_with_current_fact");
  const overClaims = claims.filter((c) => c.verdict === "overstated");
  const notCheckable = claims.filter((c) => c.verdict === "not_checkable").length;
  return {
    status: r.status,
    bio: {
      ...items(e.flagBiography, (s) => flagged.some((c) => c.verdict === "ungrounded" && matchesAnchor(c.quote, s)), usable),
      flagged: flagged.length,
      falsePositives: flagged.filter((c) => !bioAnchors.some((s) => matchesAnchor(c.quote, s))).map((c) => c.quote),
    },
    grounding: items(e.groundBiography, (s) => claims.some((c) => c.verdict === "grounded" && matchesAnchor(c.quote, s)), usable),
    conflicts: {
      ...items(e.conflicts, (s) => conflictClaims.some((c) => matchesAnchor(c.quote, s)), usable),
      falsePositives: conflictClaims.filter((c) => !e.conflicts.some((s) => matchesAnchor(c.quote, s))).map((c) => c.quote),
    },
    overstated: {
      ...items(e.overstated, (s) => overClaims.some((c) => matchesAnchor(c.quote, s)), usable),
      falsePositives: overClaims.filter((c) => !e.overstated.some((s) => matchesAnchor(c.quote, s))).map((c) => c.quote),
    },
    groundedNotOverstated: items(e.groundedNotOverstated, (s) => claims.some((c) => c.verdict === "grounded" && matchesAnchor(c.quote, s)), usable),
    f5: {
      ...items(e.financialFind, (s) => fins.some((f) => matchesAnchor(f.quote, s)), usable),
      findings: fins.length,
      // An ambiguous line is neither a hit nor a miss: excluded from falsePositives, and reported on its own below.
      falsePositives: fins
        .filter((f) => !e.financialFind.some((s) => matchesAnchor(f.quote, s)))
        .filter((f) => !e.financialAmbiguous.some((s) => matchesAnchor(f.quote, s)))
        .map((f) => f.quote),
      controlHits: fins.filter((f) => e.financialNotFind.some((s) => matchesAnchor(f.quote, s))).map((f) => f.quote),
      ambiguousHits: fins.filter((f) => e.financialAmbiguous.some((s) => matchesAnchor(f.quote, s))).map((f) => f.quote),
    },
    notCheckable,
    dcPass: e.dcControl ? usable && flagged.length === 0 && notCheckable >= e.dcControl.minNotCheckable : null,
  };
}
