import { describe, it, expect } from "vitest";
import { checkComplianceAxis } from "./complianceAxis";

/**
 * REGRESSION SUITE — PROMISED_RESULT_RE precision (the FIFTH false-positive family).
 *
 * Every case below was first measured as a live in-memory probe, the way `11a920a` measured the
 * "scale" collision. This file is that probe made permanent.
 *
 * THE DEFECT, for whoever reads a failure here:
 *   The rule's first alternation fired on a DURATION PHRASE within 60 characters of a bare "you".
 *   The suffix in `you(?:'ll| will)?` was OPTIONAL and no outcome verb was required anywhere, so
 *   ordinary delivery windows and refund windows blocked at tier 1 as promised results:
 *
 *     "…within 90 days, you get a full refund."        → BLOCK on `"within 90 days, you"`
 *     "In eight weeks you receive the scope map…"      → BLOCK on `"In eight weeks you"`
 *
 *   A refund window is not a promised result. A delivery window is not a promised result.
 *
 * THE FIX: the duration alternation now requires an actual OUTCOME element — second person plus an
 * achievement verb, or an explicit result noun — rather than a bare pronoun.
 *
 * ⚠️ READ THIS BEFORE LOOSENING ANYTHING HERE. The fix must not open a hole. The `still blocks`
 * describe-block below is the floor, and `real-faq6-live` is the live line from landing page 238
 * that the whole 4c re-run is gated on. CHECKPOINT §0-FAQ is explicit that the classifier fix must
 * NOT fix that sentence away — it is a genuine outcome promise, and the generator's CLAIMS RULE
 * (step 2) is what stops it being written, not this rule.
 */

const hitsFor = (text: string) =>
  checkComplianceAxis([{ location: "t", text, role: "body" }]);

const blockingClasses = (text: string) => hitsFor(text).blocking.map((h) => h.classId);

describe("delivery and refund windows are not promised results", () => {
  it("does NOT block a refund window naming its period", () => {
    const real = "Our 90-day money-back guarantee: if you are not satisfied within 90 days, you get a full refund.";
    expect(blockingClasses(real)).not.toContain("promised_result");
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block a plain refund window beside an unrelated second person", () => {
    const real = "There is a full refund within 90 days, and you keep every worksheet you have downloaded.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block a delivery window for a workbook", () => {
    const real = "You get the full workbook within thirty days, and we review it with you on a call.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block deliverables named against a timeframe", () => {
    const real = "In eight weeks you receive the scope map, the pricing model and the outreach sequence.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block a deliverables list with no second person at all", () => {
    const real = "Within six weeks we deliver the audit, the positioning note and the outreach sequence.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block an onboarding window", () => {
    const real = "In two weeks you meet the delivery team and we walk you through the whole process.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });
});

describe("still blocks — the fix must not open a hole", () => {
  // ⚠️ THE LIVE BLOCKER. landing page 238, original angle, faq[6].answer. It gates the 4c re-run
  // and it must STILL BLOCK after this fix — an unconditional "until it does" is an outcome
  // promise, and removing it here would be fixing away the finding rather than the false positive.
  it("blocks the live faq[6] line — an open-ended remedy until the outcome arrives", () => {
    const live =
      "If the structure has not produced a retainer conversation within twelve weeks, I will work with you one-to-one at no additional cost until it does.";
    expect(blockingClasses(live)).toContain("promised_result");
  });

  it("blocks a result reached in a stated time (second person plus achievement verb)", () => {
    expect(blockingClasses("In twelve weeks you achieve complete financial independence.")).toContain("promised_result");
  });

  it("blocks a named client outcome in a stated time", () => {
    expect(blockingClasses("In 8 weeks you will land three retainer clients.")).toContain("promised_result");
  });

  it("blocks a revenue figure in a stated time", () => {
    expect(blockingClasses("Within 90 days you will add ten thousand pounds in monthly revenue.")).toContain("promised_result");
  });

  it("blocks a lead-flow promise in a stated time", () => {
    expect(blockingClasses("In thirty days you will have a predictable flow of qualified leads.")).toContain("promised_result");
  });

  it("blocks a career outcome in a stated time", () => {
    expect(blockingClasses("In six months you will get the promotion you have been passed over for.")).toContain("promised_result");
  });

  it("blocks a typicality claim across every client", () => {
    expect(blockingClasses("Every single client lands a retainer inside the first quarter.")).toContain("promised_result");
  });

  it("blocks an absolute promise to fix", () => {
    expect(blockingClasses("This will permanently fix the problem.")).toContain("promised_result");
  });

  it("blocks a bare guarantee of the output", () => {
    expect(blockingClasses("The session is free and the output is guaranteed.")).toContain("promised_result");
  });

  it("blocks an offer to keep working free of charge until the result arrives", () => {
    expect(blockingClasses("We will keep coaching you free of charge until you get results.")).toContain("promised_result");
  });
});

describe("the open-ended remedy rule is conjunctive, not a bare 'until'", () => {
  it("leaves an ordinary support commitment alone", () => {
    expect(hitsFor("We will work with you until you are confident with the material.").blocking).toHaveLength(0);
  });

  it("leaves a scheduling 'until' alone", () => {
    expect(hitsFor("I will work with you one-to-one at no additional cost until the cohort closes.").blocking).toHaveLength(0);
  });
});

/**
 * THE PAGE-238 BLOCKING BASELINE.
 *
 * ⚠️ The landing page 238 row was deleted at the 2026-08-12 teardown, so the full 89-field content
 * no longer exists anywhere. What is preserved is this sentence corpus, carried forward from the
 * capture `11a920a` probed against. Pinning the count here is what stops a future precision change
 * moving the baseline unnoticed — the failure mode CHECKPOINT §0-FAQ warns about by name.
 */
describe("page-238 preserved corpus — the blocking baseline is 1 of 8", () => {
  const CORPUS: Array<[string, "PASS" | "BLOCK"]> = [
    ["That work cannot be done at scale.", "PASS"],
    ["The value audit in phase one requires detailed work on your specific client relationships, and that work cannot be done well at scale.", "PASS"],
    ["There is no waitlist with a guaranteed place.", "PASS"],
    ["When those are filled, the next availability opens before the following cohort, with no guaranteed timeline.", "PASS"],
    ["The Session Produces A Written Output Or We Run It Again", "PASS"],
    ["This Cohort Is Limited To Eight Consultants", "PASS"],
    ["Each cohort is capped at eight operations consultants. Not as a marketing device — as a structural requirement of the programme.", "PASS"],
    ["The session is free and the output is guaranteed.", "BLOCK"],
  ];

  for (const [text, want] of CORPUS) {
    it(`${want}: ${text.slice(0, 60)}`, () => {
      const n = hitsFor(text).blocking.length;
      want === "PASS" ? expect(n, text).toBe(0) : expect(n, text).toBeGreaterThan(0);
    });
  }

  it("holds the corpus-wide blocking count at exactly 1", () => {
    const blocking = CORPUS.filter(([text]) => hitsFor(text).blocking.length > 0);
    expect(blocking.map(([t]) => t)).toEqual(["The session is free and the output is guaranteed."]);
  });
});
