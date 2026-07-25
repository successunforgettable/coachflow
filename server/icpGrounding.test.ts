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
import { ICP_USER_PROMPT, buildLadderBlock, hasLadderContent } from "./_core/icpPrompts";

const TEXT_KEYS = [
  "introduction", "fears", "hopesDreams", "psychographics", "pains", "frustrations",
  "goals", "values", "objections", "buyingTriggers", "mediaConsumption", "influencers",
  "communicationStyle", "decisionMaking", "successMetrics", "implementationBarriers",
];

function validIcp(over: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) base[k] = `content for ${k}`;
  base.demographics = {
    age_range: "Not specified", gender: "Not specified", income_level: "Not specified",
    education: "Not specified", occupation: "Not specified", location: "Not specified",
    family_status: "Not specified",
  };
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
   * REGRESSION — the exact Phase-1 failure: the model emitted
   * `demographics: "<parameter name=\"age_range\">28-40"` and hoisted the other six
   * keys to the top level, producing 23 fields. This must never persist.
   */
  it("catches the flattened-demographics failure (23 top-level fields)", () => {
    const broken = validIcp({
      demographics: '\n<parameter name="age_range">28-40',
      gender: "Not specified",
      income_level: "Not specified",
      education: "Not specified",
      occupation: "Not specified",
      location: "Not specified",
      family_status: "First-time parent",
    });
    const hits = validateIcpStructure(broken);
    expect(hits.length).toBeGreaterThan(0);
    const codes = hits.map((h) => h.code);
    expect(codes).toContain("icp_demographics_not_object");
    expect(codes).toContain("icp_unexpected_top_level_keys");
    // and the retry prompt names the fix
    expect(buildIcpStructuralFailContext(hits)).toMatch(/nested object/i);
  });

  it("catches a missing demographic key, an empty section and a non-object payload", () => {
    const missingKey = validIcp({ demographics: { age_range: "28-40" } });
    expect(validateIcpStructure(missingKey).map((h) => h.code)).toContain("icp_demographic_key_missing");
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

  it("flags an unsupported income bracket but accepts \"Not specified\" and input-derived values", () => {
    const flagged = validateIcpGrounding(
      validIcp({ demographics: { ...(validIcp().demographics as object), income_level: "$75,000-$160,000 household" } }),
      CTX,
    );
    expect(flagged.filter((h) => h.classId === "icp_demographic_unsupported").length).toBeGreaterThan(0);

    // all "Not specified" → clean
    expect(validateIcpGrounding(validIcp(), CTX).filter((h) => h.classId === "icp_demographic_unsupported"))
      .toHaveLength(0);

    // the age range IS in the coach's targetCustomer → supported
    const supported = validateIcpGrounding(
      validIcp({ demographics: { ...(validIcp().demographics as object), age_range: "28-40" } }),
      CTX,
    );
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

  it("marks all-\"Not specified\" demographics inferred, and never writes labels into the text fields", () => {
    const icp = validIcp();
    const p = computeIcpProvenance(icp, CTX);
    expect(p.perSection.demographics).toBe("inferred");
    // out-of-band invariant: the profile itself is untouched by labelling
    for (const k of TEXT_KEYS) expect(String(icp[k])).not.toMatch(/inferred|stated|provenance/i);
  });
});

describe("ICP_USER_PROMPT — single source (sibling fix 1)", () => {
  it("numbers each section exactly once (regression: the duplicate 4. DEMOGRAPHICS that garbled the tool-call)", () => {
    for (const prompt of [ICP_USER_PROMPT(SERVICE), ICP_USER_PROMPT(SERVICE, { angle: {
      angleName: "Second-time parents", description: "d", primaryPain: "p", primaryBuyingTrigger: "t" } })]) {
      expect(prompt.match(/^4\. DEMOGRAPHICS/gm) ?? []).toHaveLength(1);
      expect(prompt.match(/^12\. MEDIA CONSUMPTION/gm) ?? []).toHaveLength(1);
      expect(prompt.match(/^13\. INFLUENCERS/gm) ?? []).toHaveLength(1);
      expect(prompt.match(/^17\. IMPLEMENTATION BARRIERS/gm) ?? []).toHaveLength(1);
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

  it("keeps the vivid Class-B instructions intact while grounding only 4/12/13", () => {
    const p = ICP_USER_PROMPT(SERVICE);
    expect(p).toContain("the 3am version");
    expect(p).toContain("I lie awake worrying that");
    expect(p).toContain("their internal monologue, not a textbook description");
    expect(p).toContain("GROUNDING — applies to sections 4, 12 and 13 only");
    expect(p).toContain('the exact text "Not specified"');
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
