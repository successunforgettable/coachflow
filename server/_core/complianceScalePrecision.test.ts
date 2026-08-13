import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { checkComplianceAxis, resolveAnchors, splitSentences } from "./complianceAxis";

/**
 * REGRESSION SUITE — the "scale" vocabulary collision, and the delegation class/span fixes.
 *
 * Every case below was first measured as a live probe against the real landing page 238 content
 * captured before the 2026-08-12 teardown. The probe proved the diagnosis; this file is that
 * probe made permanent, so the two defects cannot come back silently.
 *
 * THE TWO DEFECTS, for whoever reads a failure here:
 *   1. "scale"/"scales" sat in BODY_PROXY_NOUNS as plain list terms. Conjoined with any
 *      DEFICIT_PREDICATE — "cannot" is one — the §1.3 body-proxy rule blocked ordinary business
 *      sentences at tier 1 as assertions about the reader's BODY.
 *   2. Every complianceFilter verdict was reported as `deceptive_urgency` with the field's first
 *      80 characters as the matched span, so the class and the evidence were both wrong.
 */

const hitsFor = (text: string) =>
  checkComplianceAxis([{ location: "t", text, role: "body" }]);

const blockingClasses = (text: string) => hitsFor(text).blocking.map((h) => h.classId);

describe("scale collision — the business sense must not trip the §1.3 body-proxy rule", () => {
  // ── The exact fragment preserved from the failed 2026-08-12 run. ──
  it("does NOT block 'That work cannot be done at scale.'", () => {
    const res = hitsFor("That work cannot be done at scale.");
    expect(res.blocking).toHaveLength(0);
    expect(res.ok).toBe(true);
  });

  it("does NOT block the full dollar-angle sentence that carried both halves", () => {
    const real =
      "The value audit in phase one requires detailed work on your specific client relationships, and that work cannot be done well at scale.";
    expect(blockingClasses(real)).not.toContain("second_person_protected_attribute");
  });

  // ── The probe's isolation controls: each term alone must be inert. ──
  it("stays clean with the proxy term swapped out ('at speed')", () => {
    expect(hitsFor("That work cannot be done at speed.").blocking).toHaveLength(0);
  });

  it("stays clean with the deficit predicate removed ('is done at scale')", () => {
    expect(hitsFor("That work is done at scale.").blocking).toHaveLength(0);
  });

  // ── The anchor is NOT the mechanism. Both directions pinned. ──
  it("is unaffected by a preceding SECOND-person sentence (the anchor carry)", () => {
    const text = "Your specific client relationships are the asset. That work cannot be done at scale.";
    const anchors = resolveAnchors(splitSentences(text));
    expect(anchors[1]).toBe("second"); // the carry really is happening
    expect(hitsFor(text).blocking).toHaveLength(0); // and it is not what fires the rule
  });

  it("is unaffected by a preceding FIRST-person sentence", () => {
    expect(hitsFor("I built my practice this way. That work cannot be done at scale.").blocking).toHaveLength(0);
  });

  // ── Ordinary business vocabulary that pairs "scale" with other deficit predicates. ──
  it.each([
    "Bespoke delivery cannot scale.",
    "This approach is failing at scale.",
    "We could not deliver that at scale.",
    "The scale of the problem cannot be fixed in one quarter.",
    "Scaling this work is not something a single consultant can do.",
  ])("stays clean on ordinary business copy: %s", (text) => {
    expect(blockingClasses(text)).not.toContain("second_person_protected_attribute");
  });
});

describe("scale collision — the REAL body sense must still block", () => {
  // These are the §1.3 cases the exhaustive triage of released texts added the term for. If the
  // fix had simply deleted "scale" from the list, every one of these would silently stop blocking.
  it.each([
    "The scale won't budge.",
    "The scales said no again.",
    "Your scale won't budge either.",
    "That scale said no this morning.",
  ])("still blocks the bathroom-scales sense: %s", (text) => {
    expect(blockingClasses(text)).toContain("second_person_protected_attribute");
  });

  it("still needs BOTH halves — a determiner alone is not a violation", () => {
    // The rule is a conjunction and always was. "The scale is by the door" names the object
    // without characterising anything, and must stay clean — this pins that the fix narrowed
    // WHICH "scale" counts, and did not turn the noun into a standalone trigger.
    expect(hitsFor("The scale is by the door.").blocking).toHaveLength(0);
  });

  it("still blocks the other body proxies untouched by this change", () => {
    for (const text of [
      "The clothes still don't fit.",
      "The mirror is a daily reminder that something hasn't come back.",
      "Your jeans no longer fit.",
      "The waistline is expanding.",
    ]) {
      expect(blockingClasses(text), text).toContain("second_person_protected_attribute");
    }
  });

  it("suppresses the body sense when it is the coach's own first-person account", () => {
    expect(hitsFor("I remember it well. The scale won't budge.").blocking).toHaveLength(0);
  });
});

describe("the dead body-proxy branch is gone, and the live half beside it is not", () => {
  it("no longer contains the unreachable second body-proxy push", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    // The §1.3 proxy verdict must be pushed from exactly ONE site.
    const proxyPushes = src.match(/This describes the reader's body, or something standing in for it/g) ?? [];
    expect(proxyPushes.length, `body-proxy push sites (must be 1): ${proxyPushes.length}`).toBe(1);
  });

  it("still labels a non-enumerated possession noun at tier 2, never blocking", () => {
    // "record" is in NON_ENUMERATED_POSSESSION_NOUNS — a work record is not a Meta attribute.
    const res = hitsFor("You are stuck with a record that keeps losing you the pitch.");
    expect(res.blocking).toHaveLength(0);
    expect(res.advisories.map((h) => h.classId)).toContain("register_diagnostic_address");
  });

  it("routes both call sites through one body-proxy matcher", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    expect(src).toMatch(/function bodyProxyMatch\(/);
    // BODY_PROXY_NOUNS must not be consulted directly by the rule bodies any more.
    const direct = src.match(/containsAny\([a-z]+, BODY_PROXY_NOUNS\)/g) ?? [];
    expect(direct.length, `direct BODY_PROXY_NOUNS reads outside the matcher: ${direct.length}`).toBe(0);
  });
});

describe("delegated verdicts carry the real class and an honest span", () => {
  it("reports a guarantee claim as promised_result, NOT deceptive_urgency", () => {
    const res = hitsFor("Every participant is guaranteed a written output from the session.");
    const hit = res.blocking.find((h) => h.classId === "promised_result");
    expect(hit, "expected a promised_result hit").toBeDefined();
    expect(res.blocking.map((h) => h.classId)).not.toContain("deceptive_urgency");
  });

  it("attaches the phrase that matched, not the field's opening 80 characters", () => {
    const long =
      "The Session Produces A Written Output Or We Run It Again. The free strategy session has a specific deliverable and a named set of outputs. The session is free and the output is guaranteed.";
    const hit = hitsFor(long).blocking.find((h) => h.classId === "promised_result");
    expect(hit).toBeDefined();
    expect(hit!.matched).toBe("guaranteed");
    // The old behaviour: the first 80 chars of the field, an opening no rule objected to.
    expect(hit!.matched).not.toContain("The Session Produces");
    expect(hit!.matched.length).toBeLessThan(40);
  });

  it("still reports genuine urgency devices as deceptive_urgency", () => {
    expect(blockingClasses("This offer expires today, and the doors close forever.")).toContain("deceptive_urgency");
  });

  it("reports a cure claim as clinical_outcome_claim rather than urgency", () => {
    expect(blockingClasses("We cure your migraines in the first session.")).toContain("clinical_outcome_claim");
  });
});

describe("the real landing-page-238 sentences, end to end", () => {
  // The three complianceFilter triggers measured on the live page, plus the sentence CHECKPOINT
  // graded a defect against. Two of the three were DENIALS of a guarantee.
  it("does not block 'There is no waitlist with a guaranteed place.'", () => {
    expect(hitsFor("There is no waitlist with a guaranteed place.").blocking).toHaveLength(0);
  });

  it("does not block 'with no guaranteed timeline.'", () => {
    const real =
      "When those are filled, the next availability opens before the following cohort, with no guaranteed timeline.";
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("still blocks the one real guarantee claim on that page", () => {
    expect(blockingClasses("The session is free and the output is guaranteed.")).toContain("promised_result");
  });

  it("leaves the sentence the classifier never objected to completely clean", () => {
    const res = hitsFor("The Session Produces A Written Output Or We Run It Again");
    expect(res.hits).toHaveLength(0);
    expect(res.ok).toBe(true);
  });

  it("leaves the honest cohort-cap scarcity headings clean", () => {
    for (const text of [
      "This Cohort Is Limited To Eight Consultants",
      "Each cohort is capped at eight operations consultants. Not as a marketing device — as a structural requirement of the programme.",
    ]) {
      expect(hitsFor(text).blocking, text).toHaveLength(0);
    }
  });
});
