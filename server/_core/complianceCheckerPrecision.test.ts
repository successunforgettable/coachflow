import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { checkOutput } from "./complianceAxis";

/**
 * SPRINT 8 — LEXICAL CHECKER PRECISION (2026-09-16).
 *
 * Four known false positives / blind spots in the EXISTING checker. Every verdict below was
 * written BEFORE the change, and every must-block line was first MEASURED blocking on the
 * unchanged checker (35baeb1). Record: docs/handovers/SPRINT8_CHECKER_PRECISION_2026-09-16.md.
 *
 * §15j: tighten, never delete — no term, class or check is removed. Each narrowing is paired
 * with the true positives it must keep. §15k: every must-pass group carries a POSITIVE artefact
 * (the same words, in the blocking shape, still block) so a silently dead rule cannot pass it.
 *
 * Lines that do NOT block today are deliberately not pinned either way — this sprint does not
 * widen them. Recorded in the handover doc: "heal your gut in 30 days" (bare "gut" is not a
 * listed term), "Can't afford the course?", "a criminal conviction", "even with a conviction on
 * your record", "spent convictions" (no reader anchor the rule recognises).
 */

const F = (text: string) => [{ location: "t", text }];
const blocking = (text: string) => checkOutput(F(text)).blocking;

/** Check 10's OWN hit (its description), not the delegated complianceFilter rule of the same class. */
const check10 = (text: string) =>
  blocking(text).filter((h) => h.classId === "clinical_outcome_claim" && h.description.startsWith("This promises to resolve"));
const attr = (text: string) => blocking(text).filter((h) => h.classId === "second_person_protected_attribute");
const crypto = (text: string) => blocking(text).filter((h) => h.classId === "crypto_trade_endorsement");

// ─── 1. clinical_outcome_claim — the verb must relate to the condition ────────────────────────
describe("sprint 8 · clinical_outcome_claim adjacency", () => {
  // Measured blocking via check 10 on 35baeb1.
  const MUST_STILL_BLOCK = [
    "reverse your diabetes",
    "this protocol cures anxiety",
    "fix your back pain for good",
    "get rid of eczema",
    "Heal your gut health in 30 days",
    "we fix your anxiety",
    "Your eczema, healed.",
    "Your diabetes can be reversed.",
    "anxiety cured",
    "eliminate your debt",
    "cure your migraines",
    "get rid of the bloating for good",
    // §15k positive artefact for the must-pass group: "fixed" + "savings" in ONE clause still reaches the rule.
    "Your savings, fixed.",
  ];
  for (const t of MUST_STILL_BLOCK) {
    it(`still blocks: ${t}`, () => {
      expect(check10(t).length).toBeGreaterThan(0);
    });
  }

  // Measured blocking via check 10 on 35baeb1 (except the two that already passed); must pass.
  const MUST_PASS = [
    "Savings. Fixed deposits.",
    "Most money just sits in savings. A fixed rate is not the point.",
    "I kept my own savings in a fixed deposit for years.",
    "a fixed-price package",
    "fixed income",
    "a fixed-rate savings account",
  ];
  for (const t of MUST_PASS) {
    it(`passes: ${t}`, () => {
      expect(check10(t)).toEqual([]);
      expect(checkOutput(F(t)).ok).toBe(true);
    });
  }

  it("no longer depends on how the caller splits text into fields", () => {
    for (const [a, b] of [["Savings.", "Fixed deposits."], ["Most money just sits in savings.", "A fixed rate is not the point."]]) {
      const one = checkOutput(F(`${a} ${b}`)).ok;
      const two = checkOutput([{ location: "a", text: a }, { location: "b", text: b }]).ok;
      expect(one).toBe(two);
      expect(one).toBe(true);
    }
  });

  it("does not report a financial-status line as a clinical claim (that is F5's question, not check 10's)", () => {
    // Blocked on 35baeb1 as clinical_outcome_claim "fixed … savings" — the wrong reason. See addendum §4.
    expect(check10("Your savings are sitting in a fixed deposit doing nothing.")).toEqual([]);
  });

  // Real copy from the in-repo fixtures: each blocked on 35baeb1 as check 10 with the verb and the
  // term in different sentences — the product name "Reverse-Map", "the fix" as a noun, "Fix:" as a label.
  const REAL_COPY_FALSE_POSITIVES: Array<[string, string]> = [
    ["server/__fixtures__/live-bonus-43-2026-09-14.json", ".tools[3].content"],
    ["server/__fixtures__/raw-bonus-35-attempt2-2026-09-13.json", ".nextStep.body"],
    ["server/__fixtures__/raw-bonus-35-attempt3-2026-09-13.json", ".tools[2].content"],
    ["server/__fixtures__/trimmed-bonus-35-2026-09-13.json", ".tools[2].content"],
    ["server/_core/__fixtures__/lead-magnets/hvco-5686.json", ".tools[0].content"],
    ["server/_core/__fixtures__/lead-magnets/hvco-5686.json", ".tools[3].content"],
    ["server/_core/__fixtures__/lead-magnets/hvco-5686.json", ".nextStep.body"],
    ["server/_core/__fixtures__/lead-magnets/hvco-7233.json", ".sections[0].body"],
  ];
  const read = (file: string, path: string): string => {
    let node: any = JSON.parse(readFileSync(join(__dirname, "..", "..", file), "utf8"));
    for (const [, key, idx] of path.matchAll(/\.(\w+)|\[(\d+)\]/g)) node = key !== undefined ? node[key] : node[Number(idx)];
    return node;
  };
  for (const [file, path] of REAL_COPY_FALSE_POSITIVES) {
    it(`real copy no longer blocks as a clinical claim: ${file.split("/").pop()}${path}`, () => {
      const text = read(file, path);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(200); // §15k — the fixture actually loaded
      expect(check10(text)).toEqual([]);
    });
  }
});

// ─── 2. "can't afford to" — the stakes idiom ────────────────────────────────────────────────────
describe("sprint 8 · the 'can't afford to' idiom", () => {
  // Blocked on 35baeb1 as second_person_protected_attribute ("we can't afford to ignore this" already passed).
  const MUST_PASS = [
    "You can't afford to get this wrong.",
    "you can't afford to wait",
    "we can't afford to ignore this",
    "It accounts for the fact that you can't afford to get this wrong.", // capture 2, concept[1].longText
    "you cannot afford to get this wrong.",
  ];
  for (const t of MUST_PASS) {
    it(`passes: ${t}`, () => {
      expect(attr(t)).toEqual([]);
      expect(checkOutput(F(t)).ok).toBe(true);
    });
  }

  // Measured blocking on 35baeb1. The first two are the §15k artefact: same subject and term, money complement.
  const MUST_STILL_BLOCK = [
    "you can't afford rent",
    "you can't afford it right now",
    "you can't afford to pay rent",
    "you can't afford to lose your home",
    "You're stuck in debt and you can't afford another year of this.",
  ];
  for (const t of MUST_STILL_BLOCK) {
    it(`still blocks: ${t}`, () => {
      expect(attr(t).length).toBeGreaterThan(0);
    });
  }
});

// ─── 3. "conviction" — certainty sense vs criminal record ───────────────────────────────────────
describe("sprint 8 · 'conviction' word sense", () => {
  // Blocked on 35baeb1 ("say it with real conviction" already passed — no reader anchor).
  const MUST_PASS = [
    "an answer you can say with conviction",
    "say it with real conviction",
    "It ends with an answer you can say with conviction.", // capture 2, concept[9].shortText
    "A named role, a specific type of organisation, an answer you could say out loud with actual conviction.", // concept[9].longText
    "you can say it with conviction",
  ];
  for (const t of MUST_PASS) {
    it(`passes: ${t}`, () => {
      expect(attr(t)).toEqual([]);
      expect(checkOutput(F(t)).ok).toBe(true);
    });
  }

  // Measured blocking on 35baeb1. "you're living with a conviction" is the §15k artefact: "with" + a determiner.
  const MUST_STILL_BLOCK = [
    "you have a criminal conviction",
    "Your conviction still follows you into every interview.",
    "you're living with a conviction",
    "Worried your conviction will show up on a background check?",
    "Still carrying the weight of your conviction years after release?",
  ];
  for (const t of MUST_STILL_BLOCK) {
    it(`still blocks: ${t}`, () => {
      expect(attr(t).length).toBeGreaterThan(0);
    });
  }

  it("keeps today's verdict on 'your convictions' (beliefs) — it blocked on 35baeb1 and still does", () => {
    expect(attr("your convictions").length).toBeGreaterThan(0);
    expect(attr("Stand by your convictions.").length).toBeGreaterThan(0);
  });

  it("guards the occurrence, not the sentence: a second, unguarded use still blocks", () => {
    expect(attr("you say it with conviction, and your convictions guide you").length).toBeGreaterThan(0);
  });
});

// ─── 4. crypto — "digital asset(s)", with word-sense protection ─────────────────────────────────
describe("sprint 8 · 'digital asset' crypto vocabulary", () => {
  // All PASSED on 35baeb1 — the blind spot. Must now block via the existing endorsement paths.
  const MUST_BLOCK = [
    "start buying digital assets now",
    "grow your portfolio of digital assets before the price moves",
    "Here's which digital assets to buy before the next cycle.",
  ];
  for (const t of MUST_BLOCK) {
    it(`now blocks: ${t}`, () => {
      expect(crypto(t).length).toBeGreaterThan(0);
    });
  }

  it("§15k — the block comes from the new term: the endorsement alone, with no crypto topic, passes", () => {
    expect(crypto("start buying now")).toEqual([]);
    expect(crypto("grow your portfolio before the price moves")).toEqual([]);
  });

  // Word-sense controls. Every one passed on 35baeb1 and must still pass.
  const MUST_PASS = [
    "digital asset management",
    "our DAM platform organises your digital assets",
    "sell digital assets like templates and presets",
    "your brand's digital assets (logos, photos)",
    "how digital assets work and how to think about risk",
    // These two carry a transactional/endorsement phrase, so they FAIL without the sense guard.
    "Learn how to sell digital assets like templates and presets.",
    "Our digital asset management platform helps you profit from the files you already own.",
  ];
  for (const t of MUST_PASS) {
    it(`passes: ${t}`, () => {
      expect(crypto(t)).toEqual([]);
      expect(checkOutput(F(t)).ok).toBe(true);
    });
  }

  it("§15k — the education line is read as crypto topic: add an endorsement and it blocks", () => {
    expect(crypto("how digital assets work and how to think about risk. Start buying before the price moves.").length).toBeGreaterThan(0);
  });
});
