import { describe, it, expect } from "vitest";
import {
  checkComplianceAxis,
  checkAdToPageMatch,
  classifyPerson,
  resolveAnchors,
  splitSentences,
} from "./complianceAxis";

const F = (text: string, role: "short" | "body" | "cta" = "body") => [{ location: "test", text, role }];
const classes = (r: ReturnType<typeof checkComplianceAxis>) => r.hits.map((h) => h.classId);

/**
 * The grammar engine is the load-bearing part. A regex keyed on "you're" was measured
 * live (2026-07-27) doing BOTH things wrong on the same pair of sentences — missing an
 * implied-address violation and falsely flagging a legitimate first-person account.
 * These lock both directions using the exact observed strings.
 */
describe("sentence-level person anchoring", () => {
  it("treats a sentence carrying both persons as the coach's own account", () => {
    expect(classifyPerson("I know how it feels because you never say it out loud")).toBe("first");
  });

  it("inherits backwards — an unpronouned sentence belongs to the second person governing it", () => {
    const s = splitSentences("You avoid the camera. You smile anyway. But the mirror is a daily reminder that something hasn't come back yet.");
    expect(resolveAnchors(s)).toEqual(["second", "second", "second"]);
  });

  it("inherits forwards — leading unpronouned sentences belong to the first person that follows", () => {
    const s = splitSentences("The clothes still hang there. The ones from before. I kept them too.");
    expect(resolveAnchors(s)).toEqual(["first", "first", "first"]);
  });
});

describe("check 1 — assertions about the reader", () => {
  it("CATCHES the implied-address case the literal-pronoun scan missed", () => {
    const r = checkComplianceAxis(F("You avoid the camera. You smile anyway. But the mirror is a daily reminder that something hasn't come back yet."));
    expect(r.ok).toBe(false);
    expect(classes(r)).toContain("second_person_protected_attribute");
  });

  it("PASSES the first-person account the literal-pronoun scan falsely flagged", () => {
    const r = checkComplianceAxis(F("The clothes still hang there. The ones from before. I kept them too, thinking I just needed a plan that worked around a broken night's sleep."));
    expect(r.blocking).toHaveLength(0);
  });

  it("passes the reference's own permitted rewrites (§3.1)", () => {
    for (const ok of [
      "I sat in the car park four minutes every Monday just to delay going in.",
      "The outreach routine I used to land my first 10 high-ticket clients.",
      "A routine for clearer-looking skin.",
      "Financial planning services for long-term growth.",
      "Support for people who want calmer days.",
    ]) {
      expect(checkComplianceAxis(F(ok)).blocking, ok).toHaveLength(0);
    }
  });

  it("catches the reference's own prohibited forms (§3.1), including pronoun-free ones", () => {
    for (const bad of [
      "You're sitting in the car park to delay going in.",
      "Are you struggling to land high-ticket clients?",
      "Tired of your acne?",
      "Struggling with debt?",              // carries NO pronoun for anchoring to resolve
      "Living with anxiety? This helps.",
    ]) {
      expect(checkComplianceAxis(F(bad)).blocking.length, bad).toBeGreaterThan(0);
    }
  });

  it("never fires on second person aimed at the offer — Meta's own stated remedy", () => {
    for (const ok of [
      "You'll get the full framework and a worked example in week one.",
      "Claim your seat before the cohort closes.",
      "You learn the sequence, then you run it on your own pipeline.",
    ]) {
      expect(checkComplianceAxis(F(ok)).blocking, ok).toHaveLength(0);
    }
  });

  it("exempts CTA fields by construction", () => {
    expect(checkComplianceAxis(F("Book your call", "cta")).blocking).toHaveLength(0);
  });
});

describe("check 1 — audience descriptor (the short-field form)", () => {
  it("CATCHES the live postpartum eyebrow, which carries no second-person pronoun at all", () => {
    const r = checkComplianceAxis(F("FOR WOMEN WHO JUST HAD A BABY AND FEEL LIKE THEIR BODY NO LONGER BELONGS TO THEM", "short"));
    expect(r.ok).toBe(false);
    expect(classes(r)).toContain("audience_attribute_descriptor");
  });

  it("leaves an ordinary occupational descriptor alone", () => {
    const r = checkComplianceAxis(F("FOR FREELANCE DESIGNERS QUOTING THEIR OWN PROJECTS", "short"));
    expect(r.blocking).toHaveLength(0);
  });
});

describe("check 2 — negative self-perception (§1.3)", () => {
  it("catches appearance comparison even in the coach's own voice", () => {
    const r = checkComplianceAxis(F("I wanted my pre-pregnancy body back, and here is the before and after."));
    expect(classes(r)).toContain("negative_self_perception");
  });

  it("passes capability framing, which is the permitted subject", () => {
    const r = checkComplianceAxis(F("Picking up the car seat gets easier. Climbing the stairs gets easier. That is what the method is built to do."));
    expect(r.blocking).toHaveLength(0);
  });
});

describe("check 4 — crypto (§1.8)", () => {
  it("passes education, which needs no prior permission", () => {
    const r = checkComplianceAxis(F("A live mastermind where beginners learn how cryptocurrency and blockchain actually work, in plain language."));
    expect(r.blocking).toHaveLength(0);
  });

  it("catches endorsement of buying or trading", () => {
    const r = checkComplianceAxis(F("Learn which coins to buy and start trading this week to grow your portfolio."));
    expect(classes(r)).toContain("crypto_trade_endorsement");
  });

  it("stays silent on trade wording with no crypto subject", () => {
    const r = checkComplianceAxis(F("Start trading paperwork for real conversations with your clients."));
    expect(classes(r)).not.toContain("crypto_trade_endorsement");
  });
});

describe("check 5 — Special Ad Category (TIER 2, ADVISORY)", () => {
  it("flags career wording WITHOUT blocking — the evidence is practitioner-reported, not Meta policy", () => {
    const r = checkComplianceAxis(F("A 12-week programme for a career change into work that fits, without taking a pay cut."));
    expect(classes(r)).toContain("special_ad_category_employment");
    expect(r.advisories.length).toBeGreaterThan(0);
    expect(r.blocking.filter((h) => h.classId === "special_ad_category_employment")).toHaveLength(0);
    expect(r.ok).toBe(true); // advisories never affect ok
  });

  it("is worded as possibility, never as established fact", () => {
    const r = checkComplianceAxis(F("Land a job you actually want."));
    const hit = r.advisories.find((h) => h.classId === "special_ad_category_employment")!;
    expect(hit.description).toMatch(/\bMAY\b/);
    expect(hit.description).not.toMatch(/\bwill be\b|\balways\b|\bMeta treats\b/);
  });

  it("keeps the result publishable — an advisory alone leaves ok true", () => {
    expect(checkComplianceAxis(F("Get hired faster.")).ok).toBe(true);
  });
});

describe("check 3 — ad-to-landing-page match (§1.4)", () => {
  const page = "The Retainer Runway is an eight week cohort for freelance product designers moving from one-off projects to recurring retainer income, covering scoping, packaging and the retainer conversation.";

  it("passes a matched ad", () => {
    expect(checkAdToPageMatch("Freelance designers: move from projects to retainer income with a repeatable scoping sequence.", page).ok).toBe(true);
  });

  it("blocks an ad pointing at an unrelated page", () => {
    const r = checkAdToPageMatch("Postpartum nutrition coaching for new mothers who want their energy back after birth.", page);
    expect(r.ok).toBe(false);
    expect(r.blocking[0].classId).toBe("ad_to_page_mismatch");
  });

  it("says nothing when there is too little text to judge honestly", () => {
    expect(checkAdToPageMatch("Learn more", page).ok).toBe(true);
    expect(checkAdToPageMatch("A long enough ad about retainers and designers", "short").ok).toBe(true);
  });
});

describe("failContext", () => {
  it("is positive-framed and does not name failure shapes back at the model", () => {
    const r = checkComplianceAxis(F("You're stuck in debt and you can't afford another year of this."));
    expect(r.failContext.length).toBeGreaterThan(0);
    for (const m of [/\bnever write\b/i, /\bdo not write\b/i, /Wrong:/i]) expect(r.failContext).not.toMatch(m);
  });

  it("does not push copy back toward the reader's situation", () => {
    const r = checkComplianceAxis(F("You're exhausted and your body is failing you."));
    expect(r.failContext).not.toMatch(/reader's situation/i);
  });
});

describe("false-positive floor — legitimate launch-stage prose stays clean", () => {
  it("passes real first-person body copy from the live verification runs", () => {
    for (const ok of [
      "I used to reopen the same proposal four times before sending it. Every time I found one more thing to soften. That draft sat in my outbox for nine days while the client went quiet.",
      "I watched a man close his laptop mid-sentence. The form had asked for references from the last five years. He had none.",
      "I remember standing in my kitchen at six in the morning, baby finally asleep, trying to do a workout I had found online, and stopping halfway through.",
      "January used to arrive like a verdict. Every project I had finished. The pipeline: empty.",
    ]) {
      const r = checkComplianceAxis(F(ok));
      expect(r.blocking, `${ok}\n${JSON.stringify(r.blocking)}`).toHaveLength(0);
    }
  });
});

/**
 * DELIVERABLE NOUN PHRASES — the structural hole found by the combined sweep.
 *
 * The offer-guard keyed on a verb predicated of the reader. A deliverable described as a
 * noun phrase has none — the reader appears only inside a modifier — so the guard had
 * nothing to grip and the sentence flagged. This form is common in coaching copy and
 * disproportionately common in health and money niches, which is where the detector most
 * needs to be right, so the family is covered here and not just the leaf that surfaced.
 */
describe("deliverable noun phrases (offer is the subject)", () => {
  it("PASSES the exact string the sweep flagged", () => {
    const r = checkComplianceAxis(F("Progressive strength work specific to where your body is right now."));
    expect(r.blocking, JSON.stringify(r.blocking)).toHaveLength(0);
  });

  it("PASSES the sibling family — same shape, attribute term present in each", () => {
    for (const ok of [
      "Support tailored to where your energy actually is that week.",
      "A plan built around your health, not around a gym timetable.",
      "Coaching matched to your body's recovery stage.",
      "Support designed for where your debt actually sits.",
      "A programme paced to your sleep, not to a calendar.",
      "Sessions structured around your anxiety about the first call.",
    ]) {
      expect(checkComplianceAxis(F(ok)).blocking, ok).toHaveLength(0);
    }
  });

  it("STILL FLAGS the same subjects when the reader is the subject — the fix must not weaken detection", () => {
    for (const bad of [
      "Your body is not where it should be right now.",
      "You're exhausted and your energy is gone by ten.",
      "Your debt is the reason this keeps happening.",
      "You avoid the camera because of how your body looks.",
    ]) {
      expect(checkComplianceAxis(F(bad)).blocking.length, bad).toBeGreaterThan(0);
    }
  });

  it("STILL FLAGS a deliverable phrase that ALSO asserts something about the reader", () => {
    // The participle form does not launder a second sentence that diagnoses the reader.
    const r = checkComplianceAxis(F("A plan built around your schedule. You're failing because your body gave up."));
    expect(r.blocking.length).toBeGreaterThan(0);
  });

  it("does not fire on a first-person account that happens to use a fitting participle", () => {
    const r = checkComplianceAxis(F("I built the whole thing around my own broken sleep, because nothing else fitted."));
    expect(r.blocking).toHaveLength(0);
  });
});

describe("deliverable guard does not create false negatives", () => {
  it("STILL FLAGS when the reader is diagnosed BEFORE the fitting participle", () => {
    // Found in real prod copy while checking what the guard suppressed.
    for (const bad of [
      "Every tip you've tried was calibrated to the wrong body clock.",
      "Every generic tip you've been given was calibrated to a body clock you don't currently have.",
      "The exhaustion you feel is the weight of a life built around expectations.",
    ]) {
      expect(checkComplianceAxis(F(bad)).blocking.length, bad).toBeGreaterThan(0);
    }
  });

  it("still PASSES genuine offer-subject deliverables", () => {
    for (const ok of [
      "Progressive strength work specific to where your body is right now.",
      "It installs a fixed sleep anchor calibrated to your specific roster, not a generic schedule.",
      "The protocol is built around rebuilding your energy first, not depleting it further.",
    ]) {
      expect(checkComplianceAxis(F(ok)).blocking, ok).toHaveLength(0);
    }
  });
});
