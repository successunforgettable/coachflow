/**
 * Anti-fabrication validator — the governing line under test.
 * Add-only: no existing suite is modified.
 *
 * The two things that MUST hold together:
 *   1. predictable category psychology passes clean, even for a coach with nothing
 *   2. invented PROOF blocks, even when it reads plausibly
 */
import { describe, it, expect } from "vitest";
import {
  checkFabrication,
  validateConceptFabricationPatterns,
  validateScriptFabricationPatterns,
  validateAdCopyFabricationPatterns,
  validatePublishContentFabrication,
} from "./_core/fabricationValidator";
import { buildCoachCorpus, buildProofSupplied, readLadderAnswers } from "./_core/groundingCorpus";

/** A brand-new coach: no program, no bonuses, no lead magnet, no clients. */
const BEGINNER_SERVICE = {
  name: "Visible Authority",
  category: "coaching",
  description: "A 6-week programme teaching independent consultants to build a personal brand on LinkedIn.",
  targetCustomer: "Independent consultants and coaches who rely on referrals",
  mainBenefit: "Build a content system that brings in inbound leads",
};

/** A coach with a real, supplied track record. */
const VETERAN_SERVICE = {
  ...BEGINNER_SERVICE,
  coachBackground: "I have 15 years of consulting experience and have coached 200 independent consultants.",
  totalCustomers: 200,
  testimonial1Name: "Dana Whitfield",
  testimonial1Quote: "I went from two clients to a full pipeline in a quarter.",
};

const beginnerCorpus = buildCoachCorpus({ service: BEGINNER_SERVICE });
const beginnerSupplied = buildProofSupplied(BEGINNER_SERVICE);
const veteranCorpus = buildCoachCorpus({ service: VETERAN_SERVICE });
const veteranSupplied = buildProofSupplied(VETERAN_SERVICE);

const check = (text: string, corpus = beginnerCorpus, supplied = beginnerSupplied) =>
  checkFabrication({ fields: { copy: text }, corpus, supplied });

describe("the governing line — predictable psychology flows, invented proof blocks", () => {
  it("passes predictable category psychology for a coach with NOTHING (the beginner must not be dead-ended)", () => {
    const predictable = [
      "You are good at the work. Finding the next client is the part that keeps you up.",
      "Every month starts from zero and the pipeline is one warm introduction deep.",
      "You worry about cash flow, about the quiet weeks, and about what happens if the referrals stop.",
      "Posting feels like shouting into an empty room, so you stop posting.",
      "You know you should be visible. You do not know what to say.",
    ];
    for (const line of predictable) {
      const res = check(line);
      expect(res.ok, `should pass: ${line}\ngot: ${JSON.stringify(res.blocking)}`).toBe(true);
      expect(res.blocking).toHaveLength(0);
    }
  });

  // REGRESSION — these fired as false positives on a REAL beginner ICP and would
  // have dead-ended every launch-stage coach. Ordinary prose that merely
  // capitalises, and percentages used as idiom or hedged perception, are not proof.
  it("does NOT block ordinary capitalised prose or idiomatic percentages", () => {
    const ordinary = [
      "Every Monday morning, I sit down to look at my pipeline and it is the same names.",
      "When I'm honest about it, I have no system at all.",
      "I'm not 100% sure this is even fixable.",
      "About 80% of my week goes on work that never turns into anything.",
      "By Friday afternoon I have written nothing and posted nothing.",
    ];
    for (const line of ordinary) {
      const res = check(line);
      expect(res.ok, `should pass: ${line}\ngot: ${JSON.stringify(res.blocking)}`).toBe(true);
    }
  });

  it("still blocks a percentage offered as evidence", () => {
    expect(check("87% of consultants never post twice.").ok).toBe(false);
    expect(check("Our members see a 40% lift in enquiries.").ok).toBe(false);
  });

  it("blocks an invented client result", () => {
    const res = check("One of my clients went from two clients to a full pipeline in six weeks.");
    expect(res.ok).toBe(false);
    expect(res.blocking.map((h) => h.classId)).toContain("invented_testimonial");
  });

  it("blocks an invented statistic", () => {
    expect(check("87% of consultants never post twice.").blocking.map((h) => h.classId))
      .toContain("invented_statistic");
    expect(check("9 out of 10 doubled their revenue.").blocking.map((h) => h.classId))
      .toContain("invented_statistic");
  });

  it("blocks a promised result in a timeframe", () => {
    const res = check("In 8 weeks you will land three retainer clients.");
    expect(res.ok).toBe(false);
    expect(res.blocking.map((h) => h.classId)).toContain("promised_result");
  });

  it("blocks a guarantee the coach never stated", () => {
    const res = check("It is completely risk-free — full refund if it does not work.");
    expect(res.blocking.map((h) => h.classId)).toContain("invented_guarantee");
  });

  it("blocks a named third party that implies endorsement", () => {
    const res = check("The same system Justin Welsh used to go solo.");
    expect(res.blocking.map((h) => h.classId)).toContain("invented_named_third_party");
  });
});

describe("unearned authority — the beginner/veteran contrast", () => {
  it("BLOCKS a track record the beginner has not earned", () => {
    for (const claim of [
      "In my 15 years of consulting I have seen this pattern again and again.",
      "I have helped hundreds of consultants build a pipeline.",
      "I have coached 200 founders through this exact shift.",
    ]) {
      const res = check(claim);
      expect(res.ok, `should block: ${claim}`).toBe(false);
      expect(res.blocking.map((h) => h.classId)).toContain("unearned_authority");
    }
  });

  it("PASSES the same claim for a coach whose supplied background establishes it", () => {
    const res = check(
      "In my 15 years of consulting I have seen this pattern again and again.",
      veteranCorpus, veteranSupplied,
    );
    expect(res.blocking.filter((h) => h.classId === "unearned_authority")).toHaveLength(0);
  });

  it("PASSES a client-count claim within the supplied customer count, and blocks one beyond it", () => {
    const within = check("I have coached 200 independent consultants.", veteranCorpus, veteranSupplied);
    expect(within.blocking.filter((h) => h.classId === "unearned_authority")).toHaveLength(0);
    const beyond = check("I have coached 5000 independent consultants.", veteranCorpus, veteranSupplied);
    expect(beyond.blocking.map((h) => h.classId)).toContain("unearned_authority");
  });

  it("PASSES a real client story for a coach who supplied testimonials", () => {
    const res = check("One of my clients went from two clients to a full pipeline.", veteranCorpus, veteranSupplied);
    expect(res.blocking.filter((h) => h.classId === "invented_testimonial")).toHaveLength(0);
  });
});

describe("grounded claims trace to the coach's own words — never to ICP prose", () => {
  it("credits the coach's verbatim ladder answers as ground truth", () => {
    const withLadder = buildCoachCorpus({
      service: BEGINNER_SERVICE,
      groundingMeta: {
        ladderAnswers: { trigger: "Her biggest retainer client ended with two weeks notice." },
      },
    });
    expect(withLadder.words).toBeGreaterThan(beginnerCorpus.words);
    expect(withLadder.ladderAnswered).toEqual(["trigger"]);
    // a claim built from the coach's own answer carries their vocabulary
    const res = checkFabrication({
      fields: { copy: "Your biggest retainer ends with two weeks notice and the pipeline is empty." },
      corpus: withLadder, supplied: beginnerSupplied, checkPersonaTraceability: true,
    });
    expect(res.ok).toBe(true);
    expect(res.hits.filter((h) => h.classId === "untraceable_persona_claim")).toHaveLength(0);
  });

  it("records an untraceable persona claim as tier 2 — labelled, never blocking", () => {
    const res = checkFabrication({
      fields: { copy: "Zzz qqq wobble." },
      corpus: beginnerCorpus, supplied: beginnerSupplied, checkPersonaTraceability: true,
    });
    expect(res.hits.some((h) => h.classId === "untraceable_persona_claim" && h.tier === 2)).toBe(true);
    expect(res.ok).toBe(true);          // tier 2 never blocks
    expect(res.blocking).toHaveLength(0);
  });

  it("reads ladder answers tolerantly and flags the launch-stage coach", () => {
    expect(readLadderAnswers(null)).toEqual({});
    expect(readLadderAnswers({ ladderAnswers: { a: "  ", b: "real" } })).toEqual({ b: "real" });
    expect(beginnerCorpus.isLaunchStage).toBe(true);
    expect(veteranCorpus.isLaunchStage).toBe(false);
  });
});

describe("per-asset adapters cover concept, script, adCopy and the publish boundary", () => {
  it("concepts: psychology passes, invented proof blocks", () => {
    expect(validateConceptFabricationPatterns(
      [{ desire: "Wants a pipeline that does not depend on one old colleague" }],
      beginnerCorpus, beginnerSupplied,
    ).ok).toBe(true);
    expect(validateConceptFabricationPatterns(
      [{ desire: "Wants the 87% conversion lift my clients get" }],
      beginnerCorpus, beginnerSupplied,
    ).ok).toBe(false);
  });

  it("scripts: checks both spoken and on-screen text", () => {
    const clean = validateScriptFabricationPatterns(
      [{ spokenLine: "Every month starts from zero.", onScreenText: "Sound familiar?" }],
      beginnerCorpus, beginnerSupplied,
    );
    expect(clean.ok).toBe(true);
    const dirty = validateScriptFabricationPatterns(
      [{ spokenLine: "Fine.", onScreenText: "9 out of 10 doubled revenue" }],
      beginnerCorpus, beginnerSupplied,
    );
    expect(dirty.ok).toBe(false);
    expect(dirty.blocking[0].location).toContain("onScreenText");
  });

  it("adCopy: checks headline, primaryText and description", () => {
    const res = validateAdCopyFabricationPatterns(
      [{ headline: "Stop chasing referrals", primaryText: "In 8 weeks you will land three clients.", description: null }],
      beginnerCorpus, beginnerSupplied,
    );
    expect(res.ok).toBe(false);
    expect(res.blocking[0].location).toContain("primaryText");
  });

  it("publish boundary: blocks invented proof in resolved content", () => {
    expect(validatePublishContentFabrication(
      { headline: "Stop chasing referrals", body: "Your pipeline is one introduction deep. Here is the shift." },
      beginnerCorpus, beginnerSupplied,
    ).ok).toBe(true);
    expect(validatePublishContentFabrication(
      { headline: "Stop chasing referrals", body: "87% of consultants never post twice." },
      beginnerCorpus, beginnerSupplied,
    ).ok).toBe(false);
  });
});

describe("failContext is positive-framed (§14)", () => {
  it("describes what the copy IS and never lists a failure shape to imitate", () => {
    const res = check("87% of consultants never post twice.");
    const fc = res.failContext;
    expect(fc).toContain("comes from the supplied material");
    expect(fc).toContain("speaks to the reader's situation");
    expect(fc).not.toMatch(/\bDO NOT\b|\bnever write\b|\bWrong:/i);
    expect(fc).toContain("87%"); // the specific hit is named, as evidence, not as a template
  });
});
