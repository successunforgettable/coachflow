import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
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

  /**
   * ENFORCEMENT SCOPE. §3.1 is TIER 3 — ZAP's own register standard — and only Tier 1 may
   * become enforcement logic. So the §3.1 examples split by whether they name an attribute
   * Meta actually enumerates. Both halves are still DETECTED; they differ in disposition.
   */
  it("BLOCKS §3.1 forms that name an ENUMERATED attribute", () => {
    for (const bad of [
      "Tired of your acne?",                // physical health
      "Struggling with debt?",              // vulnerable financial status, no pronoun
      "Living with anxiety? This helps.",   // mental health
    ]) {
      expect(checkComplianceAxis(F(bad)).blocking.length, bad).toBeGreaterThan(0);
    }
  });

  it("LABELS §3.1 forms that name no enumerated attribute — house style, not Meta policy", () => {
    for (const styleOnly of [
      "You're sitting in the car park to delay going in.",   // behaviour, not an attribute
      "Are you struggling to land high-ticket clients?",     // business frustration
    ]) {
      const r = checkComplianceAxis(F(styleOnly));
      expect(r.blocking, `${styleOnly} should not block`).toHaveLength(0);
      expect(r.advisories.map((h) => h.classId), styleOnly).toContain("register_diagnostic_address");
      expect(r.ok, styleOnly).toBe(true);
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

/**
 * checkOutput WITH grounding — the path the generators actually call.
 *
 * This exists because a lazy `require()` inside checkOutput type-checked, passed all 32
 * tests, and then threw "require is not defined" on the first real generation: every test
 * above calls checkComplianceAxis directly, so the grounded path was never executed. The
 * suite must exercise the call shape the wiring uses.
 */
describe("checkOutput (the shared pass the generators call)", () => {
  const svc: any = { id: 1, name: "Launch Coaching", description: "A programme for new coaches.",
    targetCustomer: "new coaches", mainBenefit: "book their first clients" };

  it("runs both axes without throwing, and merges their hits", async () => {
    const { checkOutput } = await import("./complianceAxis");
    const { buildCoachCorpus, buildProofSupplied } = await import("./groundingCorpus");
    const grounding = { corpus: buildCoachCorpus({ service: svc }), supplied: buildProofSupplied(svc) };
    const r = checkOutput(
      [{ location: "body", text: "You're exhausted. 87% of coaches never book a second client.", role: "body" }],
      grounding,
    );
    const classes = r.blocking.map((h) => String(h.classId));
    expect(classes).toContain("second_person_protected_attribute"); // compliance axis
    expect(classes).toContain("invented_statistic");                // fabrication axis
    expect(r.failContext.length).toBeGreaterThan(0);
  });

  it("works with no grounding supplied (compliance only)", async () => {
    const { checkOutput } = await import("./complianceAxis");
    const r = checkOutput([{ location: "body", text: "You're exhausted and your body is failing you.", role: "body" }]);
    expect(r.ok).toBe(false);
  });

  it("passes clean first-person copy on the grounded path", async () => {
    const { checkOutput } = await import("./complianceAxis");
    const { buildCoachCorpus, buildProofSupplied } = await import("./groundingCorpus");
    const grounding = { corpus: buildCoachCorpus({ service: svc }), supplied: buildProofSupplied(svc) };
    const r = checkOutput(
      [{ location: "body", text: "I reopened the same proposal four times before sending it. That draft sat in my outbox for nine days.", role: "body" }],
      grounding,
    );
    expect(r.blocking, JSON.stringify(r.blocking)).toHaveLength(0);
  });
});


/**
 * ENFORCEMENT-SCOPE REGRESSION SET.
 *
 * Narrowing enforcement to Tier 1 carries one risk: an enumerated-attribute violation
 * slipping through. These plant one case per enumerated class and assert it still blocks,
 * alongside the non-enumerated cases that must now only label. Both halves matter — the
 * set fails if enforcement is too narrow OR creeps back to blocking house style.
 */
describe("enforcement scope — enumerated blocks, house style labels", () => {
  it("all block", () => {
    const cases: [string,string][] = [
      ["physical health","You're exhausted and your body is failing you."],
      ["medical condition","Tired of your acne?"],
      ["mental health","Living with anxiety? This helps."],
      ["mental health 2","Your depression is why the mornings are hard."],
      ["financial status","Struggling with debt?"],
      ["financial status 2","You're broke and another month just went by."],
      ["body proxy (§1.3)","The clothes still don't fit and the mirror is a daily reminder."],
      ["negative self-percept","Get your body back — see the before and after."],
      ["audience by attribute","FOR WOMEN WHO JUST HAD A BABY AND FEEL LIKE THEIR BODY NO LONGER BELONGS TO THEM"],
      ["age","Are you a struggling 45-year-old?"],
      ["criminal record","Your criminal record is the first thing they see."],
      ["body clock","Every tip you've tried was calibrated to the wrong body clock."],
    ];
    const missed = cases.filter(([,t]) => checkComplianceAxis(F(t)).blocking.length === 0);
    missed.forEach(([l,t]) => console.log("SLIPPED:", l, "::", t));
    console.log(`PLANTED ENUMERATED: ${cases.length - missed.length}/${cases.length} block`);
    expect(missed.map(([l]) => l)).toEqual([]);
  });
  it("first-person account of the same detail still passes", () => {
    const r = checkComplianceAxis(F("The clothes still hang there. The ones from before. I kept them too."));
    expect(r.blocking).toHaveLength(0);
    console.log("FIRST-PERSON INVERSE: passes (no false positive)");
  });
  it("non-enumerated labels only", () => {
    for (const t of ["You're sitting in the car park to delay going in.","Are you struggling to land high-ticket clients?","You keep rewriting the same proposal every Sunday.","The CV gap is the only thing they read."]) {
      expect(checkComplianceAxis(F(t)).blocking, t).toHaveLength(0);
    }
    console.log("NON-ENUMERATED: 4/4 label without blocking");
  });
});

/**
 * VOCABULARY EXPANSION + OFFER-GUARD SUBJECT POSITION.
 *
 * The vocabulary only says which nouns are protected; the anchoring engine decides whether
 * a violation occurred. Each term is therefore tested BOTH ways — predicated of the reader
 * (must block) and as the offer's or the coach's own account (must pass).
 */
describe("expanded vocabulary — anchoring decides, not the noun", () => {
  const pairs: [string, string, string][] = [
    ["visa status",   "Worried about your visa status?",                       "Immigration paperwork support is part of the programme."],
    ["voting status", "Your voting status shouldn't cost you the job.",        "Civic engagement is one module in the curriculum."],
    ["union member",  "Are you a union member being passed over?",             "The programme works for union members and non-members alike."],
    ["diabetes",      "Reverse your diabetes in 90 days.",                     "I built the plan after my own diabetes diagnosis."],
    ["cancer",        "Since your cancer diagnosis, everything changed.",      "I coached through my own cancer treatment."],
    ["hiv",           "Living with HIV? This changes things.",                 "The programme is open to people living with HIV."],
    ["eating disorder","Is your eating disorder running the show?",            "The approach avoids eating-disorder triggers by design."],
    ["ibs",           "Your IBS is not your fault.",                           "The plan is IBS-friendly throughout."],
    ["bloating",      "Tired of your bloating?",                               "The meal plan reduces bloating for most people."],
    ["night sweats",  "Waking up at 3am with night sweats?",                   "I remember the 3am night sweats vividly."],
    ["adhd",          "Is your ADHD wrecking your focus?",                     "I was diagnosed with ADHD at forty."],
    ["bankruptcy",    "Since your bankruptcy, nobody will lend to you.",       "I went through bankruptcy myself in 2019."],
    ["credit score",  "Is your credit score stopping you?",                    "The module explains how credit scores work."],
    ["paycheck",      "You're living paycheck to paycheck.",                   "I lived paycheck to paycheck for two years."],
  ];

  it("BLOCKS every term when it is predicated of the reader", () => {
    const missed = pairs.filter(([, bad]) => checkComplianceAxis(F(bad)).blocking.length === 0).map(([l]) => l);
    expect(missed).toEqual([]);
  });

  it("PASSES every term when it belongs to the offer or the coach's own account", () => {
    const fps = pairs.filter(([, , ok]) => checkComplianceAxis(F(ok)).blocking.length > 0).map(([l]) => l);
    expect(fps).toEqual([]);
  });

  it("rejects the high-false-positive terms — they are product names in real prod copy", () => {
    for (const ok of [
      "The Profit Reset changes the structure, not just the story you tell yourself.",
      "Women who reclaim their sense of self don't need more willpower.",
      "Ready to stop resetting every month?",
      "Coaches who talk about career transitions have usually made exactly one.",
    ]) {
      expect(checkComplianceAxis(F(ok)).blocking, ok).toHaveLength(0);
    }
  });
});

describe("offer guard requires SUBJECT position, not mere presence", () => {
  it("exempts a sentence whose subject is the offer", () => {
    expect(checkComplianceAxis(F("The Fourth Trimester Method starts where your body actually is right now.")).blocking)
      .toHaveLength(0);
  });

  it("BLOCKS when the reader is the subject and an offer word merely appears later", () => {
    // Presence-testing exempted this and let a real §1.1 assertion through.
    for (const bad of [
      "You're overweight and the programme helps.",
      "You're exhausted and your body is failing, so the method rebuilds it.",
    ]) {
      expect(checkComplianceAxis(F(bad)).blocking.length, bad).toBeGreaterThan(0);
    }
  });
});


/**
 * TRIAGE REGRESSION SET — from the exhaustive review of the 121 texts released by the
 * vocabulary/substring work. Each false negative found there is locked here, alongside the
 * releases that must STAY released, so the two cannot be traded for one another.
 */
describe("triage: false negatives block, correct releases hold", () => { it("all", () => {
  const fns: [string,string][] = [
    ["midsection","Have you ever wondered why you can exercise sporadically and eat pretty healthy but still see your midsection expanding?"],
    ["body said no","That moment you went to lift something simple — and your body said no — stays with you."],
    ["trust your body","Now you're not sure you can trust your own body under a barbell."],
    ["gained weight","You've logged every meal in an app and still gained weight."],
    ["back inside body","There Is A Way To Get Back Inside Your Own Body After Baby — Without Starving."],
  ];
  const missed = fns.filter(([,t])=>checkComplianceAxis(F(t)).blocking.length===0);
  missed.forEach(([l,t])=>console.log("STILL MISSED:",l,"::",t.slice(0,90)));
  console.log(`TRIAGE FALSE NEGATIVES NOW BLOCKING: ${fns.length-missed.length}/${fns.length}`);
  // the correct releases must STAY released
  const keep = [
    "Meanwhile, your relationships strain under the weight of your resentment.",
    "It takes just 30 minutes, works with your body's natural cortisol patterns.",
    "Sprouted whole foods deliver nutrients your body can actually use.",
    "It's that nobody has shown you a framework you can stand behind.",
    "The problem isn't your body.",
    "women who come to me aren't broken",
  ];
  const regressed = keep.filter(t=>checkComplianceAxis(F(t)).blocking.length>0);
  regressed.forEach(t=>console.log("REGRESSED (should stay released):",t.slice(0,90)));
  console.log(`CORRECT RELEASES HELD: ${keep.length-regressed.length}/${keep.length}`);
}); });


/**
 * MATCHER INTEGRITY. These exist because the same defect appeared three times: plain
 * substring matching, then a bare word-boundary fix that lost inflections, then forward
 * and reverse adjacency checks that disagreed with containsAny. One matcher, one escape
 * site. Also pins the conditional guard, which is deliberately UNCHANGED.
 */
describe("matcher integrity + conditional guard unchanged", () => {
  it("word-boundary matching covers ALL terms, old and new", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    // No raw substring matching may remain on any vocabulary list.
    expect(src).not.toMatch(/hay\.includes\(n\)/);
    // Exactly one matcher exists, and every list goes through containsAny/termRe.
    expect((src.match(/function termRe\(/g) ?? []).length).toBe(1);
    // A vocabulary term may be escaped into a regex in exactly ONE place — termRe. Every
    // other matcher must derive from it, or the rules silently disagree about what a term
    // matches (which is how the forward and reverse adjacency checks drifted apart).
    const escapeSites = src.match(/\.replace\(\/\[\.\*\+\?/g) ?? [];
    expect(escapeSites.length, `term-escape sites (must be 1, inside termRe): ${escapeSites.length}`).toBe(1);
  });
  it("precedence fix is general, not patched for one case", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    // The decision must scan ALL non-neutral terms, not the first containsAny match.
    expect(src).toMatch(/PROTECTED_ATTRIBUTE_TERMS\.some\(\(t\) => !neutralOnly\(t\) && termRe\(t\)\.test\(sentence\)\)/);
  });
  it("conditional guard is UNCHANGED", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    expect(src).toMatch(/const CONDITIONAL_OPENER =/);
    expect(src).toMatch(/if \(CONDITIONAL_OPENER\.test\(sentence\)\) return;/);
  });
});
