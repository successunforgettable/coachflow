/**
 * ICP grounding — structural gate, R3 labelling, provenance, single-prompt-source.
 * Add-only: no existing suite is modified.
 */
import { describe, it, expect } from "vitest";
import {
  validateIcpStructure,
  validateIcpGrounding,
  computeIcpProvenance,
  normalizeDemographics,
  buildIcpStructuralFailContext,
  type IcpValidationContext,
} from "./_core/icpGrounding";
import {
  ICP_USER_PROMPT, buildLadderBlock, hasLadderContent,
  ICP_JSON_SCHEMA, ICP_RETIRED_SECTION_KEYS,
  ICP_BUYER_INTEL_FIELDS, buildBuyerIntelBlock, hasBuyerIntel,
} from "./_core/icpPrompts";
import { buildIcpInputCorpus } from "./_core/icpGrounding";

const TEXT_KEYS = [
  "introduction", "fears", "hopesDreams", "psychographics", "pains", "frustrations",
  "goals", "values", "objections", "buyingTriggers",
  "communicationStyle", "decisionMaking", "successMetrics", "implementationBarriers",
];

function validIcp(over: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) base[k] = `content for ${k}`;
  return { ...base, ...over };
}

const SERVICE = {
  name: "Rest Assured",
  category: "coaching",
  description: "A 4-week online program combining gentle sleep training with parent wellness support.",
  targetCustomer: "Exhausted first-time parents aged 28-40 with babies not yet sleeping through the night.",
  mainBenefit: "Get their baby sleeping through the night while supporting the parent's own wellness.",
};
const CTX: IcpValidationContext = { service: SERVICE };

describe("validateIcpStructure — the hard gate", () => {
  it("passes a correctly shaped profile", () => {
    expect(validateIcpStructure(validIcp())).toEqual([]);
  });

  /**
   * REGRESSION — the failure that forced the Class-A removal: the model hoisted the
   * seven demographic values out of their nested object into top-level keys. There is
   * no nested object in the schema any more, but any invented top-level key is still
   * caught, so this can never silently persist.
   */
  it("catches invented top-level keys (the old flattening signature)", () => {
    const broken = validIcp({
      gender: "Not specified",
      income_level: "Not specified",
      family_status: "First-time parent",
    });
    const hits = validateIcpStructure(broken);
    const codes = hits.map((h) => h.code);
    expect(codes).toContain("icp_unexpected_top_level_keys");
    expect(buildIcpStructuralFailContext(hits)).toMatch(/no other keys/i);
  });

  it("no longer requires demographics — the three retired fields are simply absent", () => {
    const icp = validIcp();
    expect(icp.demographics).toBeUndefined();
    expect(icp.mediaConsumption).toBeUndefined();
    expect(icp.influencers).toBeUndefined();
    expect(validateIcpStructure(icp)).toEqual([]);
  });

  it("catches an empty section and a non-object payload", () => {
    expect(validateIcpStructure(validIcp({ pains: "   " })).map((h) => h.code)).toContain("icp_section_empty");
    expect(validateIcpStructure(validIcp({ fears: 42 })).map((h) => h.code)).toContain("icp_section_not_string");
    expect(validateIcpStructure("nope").map((h) => h.code)).toContain("icp_not_object");
    expect(validateIcpStructure(null).map((h) => h.code)).toContain("icp_not_object");
  });
});

describe("normalizeDemographics — casing drift (sibling fix 3)", () => {
  it("passes canonical snake_case through", () => {
    expect(normalizeDemographics({ age_range: "28-40", gender: "All" })).toEqual({ age_range: "28-40", gender: "All" });
  });
  it("maps the camelCase shape the schema used to declare", () => {
    expect(normalizeDemographics({ ageRange: "30-45", incomeLevel: "x", familyStatus: "y" }))
      .toEqual({ age_range: "30-45", income_level: "x", family_status: "y" });
  });
  it("carries a free-text import blob as summary rather than inventing a key", () => {
    expect(normalizeDemographics("Women 35-50, UK-based professionals")).toEqual({
      summary: "Women 35-50, UK-based professionals",
    });
  });
  it("parses a JSON string and returns null for empty input", () => {
    expect(normalizeDemographics('{"age_range":"28-40"}')).toEqual({ age_range: "28-40" });
    expect(normalizeDemographics(null)).toBeNull();
    expect(normalizeDemographics("")).toBeNull();
    expect(normalizeDemographics({})).toBeNull();
    expect(normalizeDemographics([1, 2])).toBeNull();
  });
});

describe("validateIcpGrounding — R3 failure modes, label-and-persist", () => {
  it("flags a named real person the coach never mentioned", () => {
    const hits = validateIcpGrounding(
      validIcp({ influencers: "They follow Justin Welsh closely because he went solo." }),
      CTX,
    );
    const named = hits.filter((h) => h.classId === "icp_named_third_party");
    expect(named.length).toBeGreaterThan(0);
    expect(named[0].matched).toContain("Justin Welsh");
    expect(named[0].retryable).toBe(true); // Class-A violations drive a retry
  });

  it("does NOT flag a name the coach supplied", () => {
    const ctx: IcpValidationContext = {
      service: { ...SERVICE, description: `${SERVICE.description} Taught alongside Cara Dumaplin.` },
    };
    const hits = validateIcpGrounding(validIcp({ influencers: "They trust Cara Dumaplin." }), ctx);
    expect(hits.filter((h) => h.classId === "icp_named_third_party")).toHaveLength(0);
  });

  it("accepts kind-of-voice prose with no named individuals", () => {
    const hits = validateIcpGrounding(
      validIcp({
        influencers: "They trust clinicians who translate research into plain language, and peers one step ahead.",
        mediaConsumption: "Long forum threads at 2am, short videos during a night feed.",
      }),
      CTX,
    );
    expect(hits.filter((h) => h.classId === "icp_named_third_party")).toHaveLength(0);
  });

  it("still guards demographics IF a row carries one (legacy or coach-supplied), and is silent when absent", () => {
    // absent on a generated profile → nothing to flag
    expect(validateIcpGrounding(validIcp(), CTX).filter((h) => h.classId === "icp_demographic_unsupported"))
      .toHaveLength(0);

    // a legacy/imported row with an invented bracket is still caught
    const flagged = validateIcpGrounding(
      validIcp({ demographics: { income_level: "$75,000-$160,000 household" } }),
      CTX,
    );
    expect(flagged.filter((h) => h.classId === "icp_demographic_unsupported").length).toBeGreaterThan(0);

    // the age range IS in the coach's targetCustomer → supported
    const supported = validateIcpGrounding(validIcp({ demographics: { age_range: "28-40" } }), CTX);
    expect(supported.filter((h) => h.location === "demographics.age_range")).toHaveLength(0);
  });

  it("flags a Cast-Iron Net audience as breadth, without making it retryable", () => {
    const broad: IcpValidationContext = { service: { ...SERVICE, targetCustomer: "business owners" } };
    const hits = validateIcpGrounding(validIcp(), broad);
    const breadth = hits.filter((h) => h.classId === "icp_breadth");
    expect(breadth).toHaveLength(1);
    expect(breadth[0].retryable).toBe(false); // labelled, never blocks the coach
  });
});

describe("computeIcpProvenance — out-of-band labels", () => {
  it("labels a section built from the coach's own words higher than an invented one", () => {
    const icp = validIcp({
      pains: "Exhausted first-time parents whose babies are not sleeping through the night, needing gentle sleep training and wellness support.",
      psychographics: "Zzz.",
    });
    const p = computeIcpProvenance(icp, CTX);
    expect(p.version).toBe(1);
    expect(["stated", "partial"]).toContain(p.perSection.pains);
    expect(p.perSection.psychographics).toBe("inferred");
    expect(p.corpusWords).toBeGreaterThan(0);
  });

  it("records which laddered follow-ups were answered, and copes with none", () => {
    const withLadder: IcpValidationContext = {
      service: SERVICE,
      ladder: { trigger: "Their GP asked how they were coping and they burst into tears.", hesitation: "   " },
    };
    const p = computeIcpProvenance(validIcp(), withLadder);
    expect(p.ladderAnswered).toEqual(["trigger"]);        // blank answers are skips
    expect(computeIcpProvenance(validIcp(), CTX).ladderAnswered).toEqual([]);
  });

  it("labels only the 14 generated sections, and never writes labels into the text fields", () => {
    const icp = validIcp();
    const p = computeIcpProvenance(icp, CTX);
    expect(Object.keys(p.perSection).sort()).toEqual([...TEXT_KEYS].sort());
    expect(p.perSection.demographics).toBeUndefined();
    // out-of-band invariant: the profile itself is untouched by labelling
    for (const k of TEXT_KEYS) expect(String(icp[k])).not.toMatch(/inferred|stated|provenance/i);
  });
});

describe("Laddered sharpening — provenance carries the coach's real input", () => {
  const LADDER = {
    trigger: "She lost a retainer client with no warning and realised her pipeline was one referral deep.",
    priorAttempts: "She had posted a handful of times, got almost no engagement, and decided it did not work.",
    hesitation: "She worried posting would look like she was desperate in front of former colleagues.",
    successMoment: "Two inbound enquiries in a week from people she had never met.",
  };

  it("persists the answer TEXT, not just which questions were answered", () => {
    const p = computeIcpProvenance(validIcp(), { service: SERVICE, ladder: LADDER });
    expect(p.ladderAnswered).toEqual(["trigger", "priorAttempts", "hesitation", "successMoment"]);
    expect(p.ladderAnswers).toEqual(LADDER);
  });

  it("records a partial answer set and omits the answers key entirely when nothing was given", () => {
    const partial = computeIcpProvenance(validIcp(), {
      service: SERVICE,
      ladder: { trigger: LADDER.trigger, hesitation: "   " },
    });
    expect(partial.ladderAnswered).toEqual(["trigger"]);
    expect(partial.ladderAnswers).toEqual({ trigger: LADDER.trigger });

    const none = computeIcpProvenance(validIcp(), { service: SERVICE });
    expect(none.ladderAnswered).toEqual([]);
    expect(none.ladderAnswers).toBeUndefined();
  });

  it("widens the grounded corpus, so the same prose scores better with a ladder than without", () => {
    // A section written from the coach's laddered answer.
    const icp = validIcp({
      pains: "Every month she looks at her pipeline and it is still only people she knew before she went solo — she posted a handful of times, got almost no engagement, and decided it did not work.",
    });
    const withoutLadder = computeIcpProvenance(icp, { service: SERVICE });
    const withLadder = computeIcpProvenance(icp, { service: SERVICE, ladder: LADDER });

    expect(withLadder.corpusWords).toBeGreaterThan(withoutLadder.corpusWords);
    const rank = { inferred: 0, partial: 1, stated: 2 } as const;
    expect(rank[withLadder.perSection.pains]).toBeGreaterThan(rank[withoutLadder.perSection.pains]);
  });

  it("puts the coach's answers into the prompt as authoritative, and omits the block when all four are skipped", () => {
    const p = ICP_USER_PROMPT(SERVICE, { ladder: LADDER });
    expect(p).toContain("treat this as authoritative");
    expect(p).toContain(LADDER.trigger);
    expect(p).toContain(LADDER.successMoment);
    expect(hasLadderContent({ trigger: " ", priorAttempts: "" })).toBe(false);
    expect(ICP_USER_PROMPT(SERVICE, { ladder: { trigger: "  " } })).not.toContain("treat this as authoritative");
  });
});

describe("Class A removal — the three fields are no longer generated", () => {
  it("names none of the retired sections anywhere in the prompt", () => {
    for (const prompt of [ICP_USER_PROMPT(SERVICE), ICP_USER_PROMPT(SERVICE, { angle: {
      angleName: "Second-time parents", description: "d", primaryPain: "p", primaryBuyingTrigger: "t" } })]) {
      expect(prompt).not.toMatch(/DEMOGRAPHICS/);
      expect(prompt).not.toMatch(/MEDIA CONSUMPTION/);
      expect(prompt).not.toMatch(/INFLUENCERS/);
      expect(prompt).not.toContain("age_range");
      expect(prompt).not.toContain('"demographics"');
      expect(prompt).not.toContain("Not specified");
    }
  });

  it("asks for exactly 14 sections, numbered 1-14 with no gaps", () => {
    const prompt = ICP_USER_PROMPT(SERVICE);
    expect(prompt).toContain("ALL 14 sections");
    const nums = (prompt.match(/^(\d+)\. [A-Z]/gm) ?? []).map((m) => parseInt(m, 10));
    expect(nums).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it("declares a flat 14-key schema with no nested object (the flattening had nothing to attach to)", () => {
    expect(ICP_JSON_SCHEMA.schema.required).toHaveLength(14);
    expect(ICP_JSON_SCHEMA.schema.required).not.toContain("demographics");
    const props = ICP_JSON_SCHEMA.schema.properties as Record<string, { type: string }>;
    expect(Object.keys(props)).toHaveLength(14);
    for (const v of Object.values(props)) expect(v.type).toBe("string");
  });

  it("keeps the retired keys listed so a future tool can populate the dormant columns", () => {
    expect([...ICP_RETIRED_SECTION_KEYS]).toEqual(["demographics", "mediaConsumption", "influencers"]);
  });
});

describe("ICP_USER_PROMPT — single source (sibling fix 1)", () => {
  it("numbers each section exactly once", () => {
    for (const prompt of [ICP_USER_PROMPT(SERVICE), ICP_USER_PROMPT(SERVICE, { angle: {
      angleName: "Second-time parents", description: "d", primaryPain: "p", primaryBuyingTrigger: "t" } })]) {
      expect(prompt.match(/^1\. INTRODUCTION/gm) ?? []).toHaveLength(1);
      expect(prompt.match(/^14\. IMPLEMENTATION BARRIERS/gm) ?? []).toHaveLength(1);
    }
  });

  it("carries the angle as a parameter of the one prompt", () => {
    const angled = ICP_USER_PROMPT(SERVICE, {
      angle: { angleName: "Second-time parents", description: "d", primaryPain: "p", primaryBuyingTrigger: "t" },
    });
    expect(angled).toContain("Second-time parents");
    expect(angled).toContain("FOCUS THIS ICP ON THIS SPECIFIC AUDIENCE ANGLE");
    expect(ICP_USER_PROMPT(SERVICE)).not.toContain("FOCUS THIS ICP ON THIS SPECIFIC AUDIENCE ANGLE");
  });

  it("keeps the vivid Class-B instructions completely intact", () => {
    const p = ICP_USER_PROMPT(SERVICE);
    expect(p).toContain("the 3am version");
    expect(p).toContain("I lie awake worrying that");
    expect(p).toContain("their internal monologue, not a textbook description");
    expect(p).toContain("It's 2am and I'm refreshing my inbox again");
    expect(p).toContain("Every [day/week/month]");
  });

  it("includes the coach's laddered answers as authoritative, and omits the block when skipped", () => {
    expect(hasLadderContent(null)).toBe(false);
    expect(hasLadderContent({ trigger: "  " })).toBe(false);
    expect(buildLadderBlock({ trigger: "" })).toBe("");
    const withLadder = ICP_USER_PROMPT(SERVICE, { ladder: { trigger: "Their GP asked how they were coping." } });
    expect(withLadder).toContain("treat this as authoritative");
    expect(withLadder).toContain("Their GP asked how they were coping.");
    expect(ICP_USER_PROMPT(SERVICE)).not.toContain("treat this as authoritative");
  });
});

// ── Phase A: buyer-intel widening ────────────────────────────────────────────

const INTEL = {
  painPoints: "They rebook the same 3am feed six nights running and cancel plans they had looked forward to.",
  whyProblemExists: "Nobody taught them that a baby's sleep cycle is not a character flaw in the parent.",
  failedSolutions: "They tried a rigid cry-it-out plan from a paperback and gave up on night four.",
  falseBeliefsVsRealReasons: "They think they lack discipline; the real reason is nobody sequenced the wind-down.",
  hiddenReasons: "They quietly resent their partner sleeping through it and will not say so out loud.",
  avatarName: "Priya",
  avatarTitle: "First-time mother back at work three days a week",
};

describe("buyer intel — empty fields are OMITTED, never placeholdered", () => {
  it("renders nothing at all when the coach filled none of the seven", () => {
    expect(hasBuyerIntel(SERVICE)).toBe(false);
    expect(buildBuyerIntelBlock(SERVICE)).toBe("");
    expect(ICP_USER_PROMPT(SERVICE)).not.toContain("WHAT THE COACH ALREADY TOLD US ABOUT THIS BUYER");
  });

  it("never emits a placeholder for a blank field — the whole line is dropped", () => {
    const partial = { ...SERVICE, painPoints: INTEL.painPoints, hiddenReasons: "   ", avatarName: "" };
    const p = ICP_USER_PROMPT(partial);
    expect(p).toContain(INTEL.painPoints);
    // The blank ones contribute no label line at all.
    expect(p).not.toContain("Reasons behind the problem this buyer would never admit out loud");
    expect(p).not.toContain("What the coach calls this buyer");
    // The standing prohibition that made this a bug the first time.
    expect(p).not.toContain("Not specified");
    expect(p).not.toContain("N/A");
  });

  it("treats whitespace-only as absent for every one of the seven fields", () => {
    for (const { key } of ICP_BUYER_INTEL_FIELDS) {
      expect(hasBuyerIntel({ ...SERVICE, [key]: "   " })).toBe(false);
      expect(hasBuyerIntel({ ...SERVICE, [key]: "x" })).toBe(true);
    }
  });

  // ── PROVENANCE SPLIT (migration 0108, 2026-09-02) ──────────────────────────────────
  // This test previously asserted that ANY populated buyer-intel field renders as "the
  // coach's own words". That assumption was measured false: 4 of 35 completed kits carried
  // expandProfile output that CONTRADICTED the coach's typed description (services 232, 248,
  // 249, 250). The contract is now per-field provenance, and it is asserted in BOTH
  // directions so neither block can silently stop rendering.

  const LADDER = { trigger: "Their health visitor asked how they were coping." };
  const HYPOTHESIS_HEADING = "A WORKING HYPOTHESIS ABOUT THIS BUYER — GENERATED, NOT SUPPLIED BY THE COACH.";
  const COACH_HEADING = "WHAT THE COACH ALREADY TOLD US ABOUT THIS BUYER";
  const allTagged = (tier: string) =>
    Object.fromEntries(ICP_BUYER_INTEL_FIELDS.map(f => [String(f.key), tier]));

  it("renders UNTAGGED buyer intel as a generated hypothesis, never as the coach's words", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, ...INTEL }, { ladder: LADDER });
    for (const v of Object.values(INTEL)) expect(p).toContain(v);
    expect(p).toContain(HYPOTHESIS_HEADING);
    expect(p).not.toContain(COACH_HEADING);
    // The ladder is real clients and must remain the LAST, highest-authority block.
    expect(p.indexOf(HYPOTHESIS_HEADING)).toBeLessThan(p.indexOf("treat this as authoritative"));
    expect(p).toContain("including the coach's general description of this buyer above");
  });

  it("renders COACH-TAGGED buyer intel as ground truth, and emits no hypothesis block", () => {
    const p = ICP_USER_PROMPT(
      { ...SERVICE, ...INTEL, buyerIntelSource: allTagged("coach_stated") },
      { ladder: LADDER },
    );
    for (const v of Object.values(INTEL)) expect(p).toContain(v);
    expect(p).toContain(COACH_HEADING);
    expect(p).not.toContain(HYPOTHESIS_HEADING);
    expect(p.indexOf(COACH_HEADING)).toBeLessThan(p.indexOf("treat this as authoritative"));
  });

  it("puts the coach's own words ABOVE the generated sketch when the row carries both", () => {
    const p = ICP_USER_PROMPT({
      ...SERVICE,
      ...INTEL,
      buyerIntelSource: { painPoints: "coach_stated" },
    });
    expect(p).toContain(COACH_HEADING);
    expect(p).toContain(HYPOTHESIS_HEADING);
    expect(p).toContain(INTEL.painPoints);
    expect(p).toContain(INTEL.hiddenReasons);
    expect(p.indexOf(COACH_HEADING)).toBeLessThan(p.indexOf(HYPOTHESIS_HEADING));
  });

  // ── STATED NEGATIVE (migration 0109, 2026-09-02) ───────────────────────────────────
  // Service 319: the coach wrote "Around nine in ten have never touched crypto and would not
  // call themselves investors" and no trace survived into any of the six extracted fields.
  // These assert the fact now reaches the prompt AND outranks the generated sketch.

  const NEGATIVE = "Around nine in ten have never touched crypto and would not call themselves investors.";
  const NEG_HEADING = "NOT TRUE OF THIS BUYER";

  it("renders a stated negative, verbatim, when the coach supplied one", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, buyerNegatives: NEGATIVE });
    expect(p).toContain(NEG_HEADING);
    expect(p).toContain(NEGATIVE);
  });

  it("emits NO negative block when the coach stated none — blank and whitespace alike", () => {
    expect(ICP_USER_PROMPT(SERVICE)).not.toContain(NEG_HEADING);
    expect(ICP_USER_PROMPT({ ...SERVICE, buyerNegatives: "" })).not.toContain(NEG_HEADING);
    expect(ICP_USER_PROMPT({ ...SERVICE, buyerNegatives: "   " })).not.toContain(NEG_HEADING);
  });

  it("places the stated negative ABOVE the generated hypothesis it constrains", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, ...INTEL, buyerNegatives: NEGATIVE });
    expect(p.indexOf(NEG_HEADING)).toBeLessThan(p.indexOf(HYPOTHESIS_HEADING));
  });

  it("gives the stated negative explicit precedence over the sketch below it", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, ...INTEL, buyerNegatives: NEGATIVE });
    expect(p).toContain("It outranks anything below that would describe them otherwise.");
  });

  it("the hypothesis block carries the subordination sentence that is the whole fix", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, ...INTEL });
    expect(p).toContain("The coach's own words above — Description, Target Customer and Main Benefit — are the authority here.");
    expect(p).toContain("Where the sketch points somewhere else, follow the coach's words and leave the sketch behind.");
  });
});

describe("buyer intel — the prompt and the grounding corpus read ONE list", () => {
  it("puts every field the prompt renders into the corpus, so coach words are never Class-A", () => {
    const service = { ...SERVICE, ...INTEL };
    const prompt = ICP_USER_PROMPT(service);
    const corpus = buildIcpInputCorpus({ service });
    for (const { key } of ICP_BUYER_INTEL_FIELDS) {
      const v = (service as Record<string, string>)[key];
      expect(prompt).toContain(v);
      expect(corpus).toContain(v); // drift here = the coach's own words flagged as fabrication
    }
  });

  it("widens the corpus beyond the five base fields once intel is present", () => {
    const bare = buildIcpInputCorpus({ service: SERVICE });
    const rich = buildIcpInputCorpus({ service: { ...SERVICE, ...INTEL } });
    expect(rich.length).toBeGreaterThan(bare.length);
    expect(bare).not.toContain(INTEL.failedSolutions);
  });

  /**
   * ⚠️ THE CLASS THAT MATTERS HERE IS `icp_assumed_prior_evaluation`, NOT
   * `icp_named_third_party`. The Class-A named-person check scans `influencers`
   * and `mediaConsumption` only, and both were retired on 2026-07-26 — against a
   * generated profile it finds nothing by construction. The prior-evaluation
   * check is the one that reads `objections` / `buyingTriggers`, which ARE
   * generated, and the new PRIOR ATTEMPTS calibration makes the model more
   * likely to write exactly the phrases it matches.
   */
  it("stops a prior attempt the COACH supplied being read as an assumed evaluation", () => {
    const icp = validIcp({
      objections: "What they say: it is not the right time. What they mean: I already tried the Baby Sleep Academy and it took my money.",
    });

    // The coach never named it → the assumption is genuinely unsupported.
    const bare = validateIcpGrounding(icp, { service: SERVICE });
    expect(bare.filter((h) => h.classId === "icp_assumed_prior_evaluation").length).toBeGreaterThan(0);

    // The coach named it in failedSolutions → the corpus now knows it, so the
    // buyer's own history stops being reported as a fabricated assumption.
    const service = { ...SERVICE, failedSolutions: "They tried the Baby Sleep Academy programme and gave up on night four." };
    const hits = validateIcpGrounding(icp, { service });
    expect(hits.filter((h) => h.classId === "icp_assumed_prior_evaluation")).toHaveLength(0);
  });

  it("records that the Class-A named-person check cannot fire on a generated profile", () => {
    // Kept as executable documentation: the check is retained for the day a tool
    // repopulates the dormant columns, but influencers/mediaConsumption are not
    // generated, so a generated ICP never reaches it. Anyone reasoning about
    // burned retries from this class is reasoning about a path that is not live.
    const hits = validateIcpGrounding(validIcp(), { service: SERVICE });
    expect(hits.filter((h) => h.classId === "icp_named_third_party")).toHaveLength(0);
  });
});

describe("Phase A — the output contract is untouched", () => {
  it("still asks for exactly 14 sections when the new blocks are present", () => {
    const p = ICP_USER_PROMPT({ ...SERVICE, ...INTEL }, { ladder: { trigger: "t" } });
    const nums = (p.match(/^(\d+)\. [A-Z]/gm) ?? []).map((m) => parseInt(m, 10));
    expect(nums).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(ICP_JSON_SCHEMA.schema.required).toHaveLength(14);
  });

  it("carries the calibration block without adding a numbered section", () => {
    const p = ICP_USER_PROMPT(SERVICE);
    expect(p).toContain("CALIBRATE BEFORE YOU WRITE");
    expect(p).toContain("WHO THIS IS NOT");
    expect(p).toContain("Most-aware: ready, waiting on a reason to act now");
    expect(p).toContain("Precision is disciplined exclusion, not a bigger net");
  });

  it("keeps all five pinned craft phrases after the section upgrades", () => {
    const p = ICP_USER_PROMPT(SERVICE);
    expect(p).toContain("the 3am version");
    expect(p).toContain("I lie awake worrying that");
    expect(p).toContain("their internal monologue, not a textbook description");
    expect(p).toContain("It's 2am and I'm refreshing my inbox again");
    expect(p).toContain("Every [day/week/month]");
  });
});
