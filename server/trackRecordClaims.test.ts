/**
 * Authored from OUTPUTS, not from the detector.
 *
 * 🔴 WHY THIS FILE EXISTS SEPARATELY. `fabricationValidator.test.ts` was 23/23 green while
 * the live publish gate returned ok=true on a named testimonial, an invented client count,
 * an invented statistic and an unstated guarantee. It asserted the exact strings its regexes
 * were written against, so it measured the fixtures rather than the behaviour. The same
 * failure mode is already documented at complianceAxis.ts:31-34 — "passed every unit test …
 * caught by the end-to-end run, not by the suite."
 *
 * The rule for this file: **every string here was harvested from real generated output or is
 * a mechanical mutation of one. Nothing here may be written by reading the regexes.**
 *
 * Layers implemented here:
 *   (ii) held-out adversarial corpus, scored on RECALL with a floor
 *   (iii) paraphrase / mutation testing — the layer that would have caught the "of my"
 *         exemption the day it landed
 * Layer (i) fixtures live in fabricationValidator.test.ts; layer (iv) the scheduled
 * end-to-end assertion is not a unit test and is tracked separately.
 */

import { describe, it, expect } from "vitest";
import { ungroundedClaims } from "./_core/trackRecordClaims";
import { buildCoachCorpus, buildProofSupplied } from "./_core/groundingCorpus";

/** The beginner from the 2026-07-28 prod cascade. Zero clients, by her own description. */
const BEGINNER = {
  name: "Sleep Reset for New Parents",
  category: "coaching",
  description:
    "I just finished my paediatric sleep consultant certification three months ago. I help exhausted new parents get their baby sleeping through the night without leaving them to cry it out. I don't have any paying clients yet - I've only done a few free sessions for friends.",
  targetCustomer: "First-time parents with babies between 4 and 12 months old",
  mainBenefit: "Their baby sleeps through the night within three weeks",
};

/** Same coach, having SUPPLIED her results. Supplied is true — no categories, no proof asked. */
const SUPPLIED = {
  ...BEGINNER,
  totalCustomers: 200,
  coachBackground: "I have worked with over 200 families since qualifying.",
  testimonial1Name: "Sarah",
  testimonial1Quote: "Sarah got her baby sleeping 12 hours in 4 days",
  socialProofStat: "94% of my clients see a full night by week two",
};

const bc = buildCoachCorpus({ service: BEGINNER });
const bs = buildProofSupplied(BEGINNER);
const sc = buildCoachCorpus({ service: SUPPLIED });
const ss = buildProofSupplied(SUPPLIED);

const blocked = (t: string, c = bc, s = bs) => ungroundedClaims(t, c, s).length > 0;

/**
 * HELD-OUT CORPUS — every line lifted verbatim from the 2026-07-28 prod cascade or from the
 * planted set that the live gate waved through. Append every real miss found in production;
 * this list only ever grows.
 */
const HARVESTED_TRACK_RECORD = [
  "94% of my clients see a full night by week two.",
  "Sarah got her baby sleeping 12 hours in 4 days.",
  "Guaranteed results or your money back.",
  "Developed after working with over two hundred families stuck in exactly this loop.",
  "After working with over 200 families, 94% of my clients see a full night by week two.",
  "A first-time parent, baby around seven months, had been feeding to sleep since birth. By night four, the transfer was holding.",
  "A mum who'd been feeding to sleep since month two worked through the Settling Sequence Reset and her baby reached a five-to-six-hour unbroken stretch.",
  "87% of consultants never post twice.",
  "9 out of 10 doubled their revenue.",
];

/**
 * METHOD claims — what the coach's method is DESIGNED to produce. Rule 1 allows every one of
 * these at zero clients. Several are real copy from the same run, including the two the
 * product owner explicitly called ALLOW.
 */
const HARVESTED_METHOD = [
  "Most families reach a consistent five-to-six-hour first stretch by night fourteen.",
  "By night three, most babies produce their first unbroken 5-hour stretch.",
  "Your baby sleeps through the night within three weeks, using a gentle method that never leaves her to cry.",
  "The Settling Sequence Reset changes the order of those associations so the cot is the cue, not the interruption.",
  "This guide shows you where in your current sequence the feed-to-sleep association is being reinforced.",
  "I remember standing at the cot at 11pm, running the same sequence again — feed, rock, lower, watch the eyes open, start over.",
  "I sat in the car park four minutes every Monday just to delay going in.",
  // False positives that the July sweep already paid for once. They must never come back.
  "I spend about 80% of my week on admin.",
  "I'm not 100% sure this is the right time.",
  "Every Monday I run the same wind-down sequence.",
  // Harvested from a LIVE generation on 2026-07-28: the narrative detector's window was wide
  // enough to read this present-tense scenario as a case study, because a past-tense word sat
  // 46 chars away inside quoted speech. A false positive here dead-ends a launch-stage coach.
  "It is 3am and a parent checks the time and thinks — I knew this was going to happen again.",
  "A parent who wants a predictable evening will find the sequence does the work.",
];

describe("held-out corpus — recall on real generated output", () => {
  it("blocks every harvested track-record claim for a zero-client coach", () => {
    const missed = HARVESTED_TRACK_RECORD.filter((t) => !blocked(t));
    expect(missed, `missed: ${JSON.stringify(missed, null, 1)}`).toEqual([]);
  });

  it("scores recall against an explicit floor, not an all-or-nothing pass", () => {
    const caught = HARVESTED_TRACK_RECORD.filter((t) => blocked(t)).length;
    expect(caught / HARVESTED_TRACK_RECORD.length).toBeGreaterThanOrEqual(0.9);
  });

  it("allows every harvested method claim — a beginner is never dead-ended", () => {
    const wrong = HARVESTED_METHOD.filter((t) => blocked(t));
    expect(wrong, `false positives: ${JSON.stringify(wrong, null, 1)}`).toEqual([]);
  });
});

describe("supplied is true — the same strings pass once the coach has told us", () => {
  // The guarantee line is deliberately excluded: this coach supplied CLIENTS, not a
  // guarantee, so it must still block. Supplied-ness is per-claim, not a blanket pass.
  const CLIENT_CLAIMS = HARVESTED_TRACK_RECORD.filter((t) => !/money back/i.test(t)).slice(0, 5);
  it.each(CLIENT_CLAIMS)("passes when supplied: %s", (t) => {
    expect(blocked(t, sc, ss)).toBe(false);
  });

  it("treats a supplied guarantee as the coach's own to state", () => {
    const g = { ...BEGINNER, guaranteeType: "Full refund", guaranteeDuration: "30 days" };
    expect(blocked("Guaranteed results or your money back.",
      buildCoachCorpus({ service: g }), buildProofSupplied(g))).toBe(false);
  });
});

/**
 * MUTATION TESTING — the layer that would have caught the "of my" exemption immediately.
 * Each mutation preserves the CLASS of the claim while changing its surface. If a detector
 * is tuned to one phrasing rather than to the claim, exactly one of these will escape.
 */
describe("compliance owns the forward promise — the two layers disagree by design", () => {
  it("passes fabrication (method claim) and blocks in compliance (results-claim risk)", async () => {
    const { checkComplianceAxis } = await import("./_core/complianceAxis");
    const t = "In 8 weeks you will land three retainer clients.";
    expect(blocked(t)).toBe(false);
    const c = checkComplianceAxis([{ location: "body", text: t, role: "body" }]);
    expect(c.ok).toBe(false);
    expect(c.blocking.map((h) => h.classId)).toContain("promised_result");
  });
});

describe("paraphrase / mutation — a class must survive a change of surface", () => {
  const NOUNS = ["clients", "families", "parents", "students", "customers", "members"];

  it("blocks a possessive population regardless of which person-noun is used", () => {
    const escaped = NOUNS.filter((n) => !blocked(`94% of my ${n} see a full night by week two.`));
    expect(escaped, `escaped: ${escaped}`).toEqual([]);
  });

  it("blocks a people count regardless of noun or number form", () => {
    const forms = ["over 200", "over two hundred", "more than 200", "hundreds of"];
    const escaped: string[] = [];
    for (const f of forms) for (const n of NOUNS) {
      const t = `Developed after working with ${f} ${n} stuck in exactly this loop.`;
      if (!blocked(t)) escaped.push(t);
    }
    expect(escaped, `escaped: ${JSON.stringify(escaped, null, 1)}`).toEqual([]);
  });

  it("blocks a named client result regardless of which first name is used", () => {
    const names = ["Sarah", "Priya", "Emma", "Aisha", "Chloe"];
    const escaped = names.filter((n) => !blocked(`${n} got her baby sleeping 12 hours in 4 days.`));
    expect(escaped, `escaped: ${escaped}`).toEqual([]);
  });

  it("keeps the non-person possessive legal across nouns — the original false positive", () => {
    const legal = ["week", "time", "day", "energy", "evening"];
    const wrong = legal.filter((n) => blocked(`I spend about 80% of my ${n} on admin.`));
    expect(wrong, `false positives: ${wrong}`).toEqual([]);
  });

  it("blocks a guarantee across its common phrasings", () => {
    const forms = [
      "Guaranteed results or your money back.",
      "This is risk-free.",
      "You get a full refund.",
      "I guarantee it.",
    ];
    const escaped = forms.filter((t) => !blocked(t));
    expect(escaped, `escaped: ${escaped}`).toEqual([]);
  });
});
