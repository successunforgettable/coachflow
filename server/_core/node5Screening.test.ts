import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { copyFieldsOf, copyFieldsOfJson } from "./persistenceGate";
import { checkOutput, checkComplianceAxis } from "./complianceAxis";

/**
 * NODE 5 (lead magnet + bonuses) SCREENING COVERAGE.
 *
 * Three findings this suite pins, all measured before anything was written:
 *
 *  1. THE CASCADE WRITE PATH WAS UNSCREENED. `hvcoTitles.assetBody` has three writers —
 *     routers/hvco.ts (quiz regenerate), bonusPdfGenerator.ts (bonus body), and
 *     _core/orchestration.ts (the cascade). The first two screened; the cascade, which is
 *     the path every coach actually hits, did not. One field, three writers, one unguarded —
 *     the drift shape this repo keeps producing.
 *
 *  2. THE EXTRACTOR'S DEPTH CAP HID A QUIZ BAND'S CTA. copyFieldsOfJson stopped at depth 4.
 *     A quiz band's cta sits at depth 5, so `scoring.bands[i].cta.body` was invisible EVEN ON
 *     THE PATHS THAT WERE SCREENED. Measured: a flagrant promised-result claim planted there
 *     produced 8 extracted fields and ZERO blocking hits.
 *
 *  3. `derivedFromObstacle` IS INTERNAL. Verified never reader-facing: absent from client/,
 *     excluded by routers/bonuses.ts's explicit column list, unread by emailSequenceGenerator's
 *     bare select, and untouched by every publisher and renderer. It is an ICP obstacle
 *     restated — i.e. a description of the reader's problem — so screening it as coach-facing
 *     copy gates our own working notes.
 *
 * ⚠️ Node 5 screening is ADVISORY BY DESIGN — screen, log, persist anyway. Blanking a coach's
 * deliverable is worse than shipping copy they can edit. Do not convert these to hard gates.
 */

const BAD_PROMISE = "In twelve weeks you will land three retainer clients, guaranteed.";

const quizBody = {
  format: "quiz",
  title: "The Retainer Readiness Scorecard",
  promise: "Find out in four minutes whether your practice is ready for retainers.",
  questions: [{
    question: "How do you currently price project work for clients?",
    options: [{ label: "By the hour, every single time", weight: 0 }],
  }],
  scoring: {
    bands: [{
      name: "Not ready yet", minPercent: 0, maxPercent: 40,
      teaser: "You are earlier in this than you think, and that is fine.",
      meaning: "Your answers put you in the earliest band of readiness for retainer work.",
      cta: { heading: "Start with the positioning work", body: BAD_PROMISE, ctaLabel: "Book the call" },
    }],
  },
  nextStep: { heading: "What happens next", body: "The programme covers positioning and pricing.", ctaLabel: "Book" },
};

describe("the extractor reaches a quiz band's CTA", () => {
  it("extracts scoring.bands[].cta.body, which the depth-4 cap hid", () => {
    const paths = copyFieldsOfJson(quizBody, "assetBody").map((f) => f.location);
    expect(paths).toContain("assetBody.scoring.bands[0].cta.body");
    expect(paths).toContain("assetBody.scoring.bands[0].cta.heading");
  });

  it("catches a promised result planted in that CTA", () => {
    const fields = copyFieldsOfJson(quizBody, "assetBody").map((f) => ({ ...f, role: "body" as const }));
    const blocking = checkOutput(fields).blocking;
    expect(blocking.map((h) => h.classId)).toContain("promised_result");
    expect(blocking.some((h) => h.location.includes("bands[0].cta.body"))).toBe(true);
  });

  it("still terminates on a deeply nested structure rather than walking forever", () => {
    let deep: any = "a claim buried far below any real asset shape, well past the cap";
    for (let i = 0; i < 12; i++) deep = { nested: deep };
    expect(copyFieldsOfJson(deep, "x").length).toBe(0);
  });
});

describe("derivedFromObstacle is internal and exempt", () => {
  it("is not extracted as coach-facing copy", () => {
    const row = {
      title: "The 48-Hour Invoice Chase Checklist",
      description: "A step-by-step checklist to recover overdue invoices in your first two days.",
      shortLine: "Recover overdue invoices without another awkward phone call.",
      derivedFromObstacle: "You are exhausted from chasing unpaid invoices every single month.",
    };
    const keys = copyFieldsOf(row).map((f) => f.location);
    expect(keys).toContain("title");
    expect(keys).toContain("description");
    expect(keys).toContain("shortLine");
    expect(keys, "derivedFromObstacle is an internal ICP note, not coach-facing copy").not.toContain("derivedFromObstacle");
  });
});

/**
 * ⚠️ NO SPECIAL ROLE FOR A QUIZ BAND — measured, not assumed. A readiness diagnostic addressed
 * to the reader already passes under the ordinary "body" role, because the tier-1 rule requires
 * an ENUMERATED attribute and "you are still pricing by the hour" names none. Diagnostic address
 * about a non-enumerated topic is tier 2 (`register_diagnostic_address`) and never blocks.
 * A role that suppressed attribute checks would suppress the financial-vulnerability and burnout
 * cases below — on the one surface most tempted to over-claim. These tests are what keeps that
 * decision honest: if a future change makes a band block, fix the change, not the role.
 */
describe("a readiness diagnostic passes under the ordinary body role", () => {
  const bands = [
    "Your answers put you in the earliest band of readiness. You are still pricing by the hour and you have not written down what a retainer would include.",
    "You are further along than most. You have named your offer and you are charging by the project, but you rebuild the scope for every client.",
    "You are stuck. You keep rewriting the same proposal and you have been avoiding the pricing conversation for months.",
    "You are reading intuitively but you have not built a repeatable session structure, so every booking feels like starting over.",
  ];
  for (const [i, text] of bands.entries()) {
    it(`band ${i + 1} does not block`, () => {
      expect(checkComplianceAxis([{ location: "b", text, role: "body" }]).blocking).toHaveLength(0);
    });
  }
});

describe("a band still blocks what it should", () => {
  const blocking = (text: string) =>
    checkComplianceAxis([{ location: "b", text, role: "body" }]).blocking.map((h) => h.classId);

  it("blocks vulnerable financial status", () => {
    expect(blocking("Your answers show you are struggling financially and cannot afford to keep working this way."))
      .toContain("second_person_protected_attribute");
  });

  it("blocks a health claim", () => {
    expect(blocking("Your answers show your burnout is the real reason the pipeline stalled."))
      .toContain("second_person_protected_attribute");
  });

  it("blocks a promised result", () => {
    expect(blocking("Your answers put you in the earliest band. In twelve weeks you will land three retainer clients."))
      .toContain("promised_result");
  });
});

/**
 * REGRESSION LOCK — the quiz promise line is a DURATION beside SECOND PERSON, the exact family
 * the promised_result precision fix released. It must keep passing.
 */
describe("the quiz promise line stays writable", () => {
  for (const text of [
    "Find out in four minutes whether your practice is ready for retainers.",
    "In four minutes you will know exactly which band you are in.",
    "In eight weeks you receive the scope map, the pricing model and the outreach sequence.",
  ]) {
    it(`passes: ${text.slice(0, 52)}`, () => {
      expect(checkComplianceAxis([{ location: "p", text, role: "body" }]).blocking).toHaveLength(0);
    });
  }
});

describe("one screening helper, so a fourth writer cannot go unguarded", () => {
  it("exposes a single lead-magnet body screen", () => {
    const src = readFileSync("server/_core/persistenceGate.ts", "utf8");
    expect(src).toMatch(/export async function screenLeadMagnetBody\(/);
  });

  it("routes all three assetBody writers through it", () => {
    for (const f of ["server/routers/hvco.ts", "server/bonusPdfGenerator.ts", "server/_core/orchestration.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must screen through the shared helper`).toMatch(/screenLeadMagnetBody\(/);
      expect(src, `${f} must not hand-roll the extraction`).not.toMatch(/screenOnPersist\([^)]*copyFieldsOfJson/);
    }
  });
});
