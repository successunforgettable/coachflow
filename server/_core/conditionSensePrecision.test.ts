import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { checkComplianceAxis } from "./complianceAxis";

/**
 * REGRESSION SUITE — the "condition" sense collision. SIXTH member of the family whose first
 * member was "scale"/bathroom-scales (`11a920a`, `complianceScalePrecision.test.ts`).
 *
 * THE DEFECT, for whoever reads a failure here:
 *   "condition" sat in PROTECTED_ATTRIBUTE_TERMS as the MEDICAL sense. The word is two words:
 *
 *     health      — a thing someone HAS: "your condition", "a chronic condition"
 *     contractual — a clause of terms:   "the condition is that the coursework is complete"
 *
 *   The second is ordinary guarantee wording and blocked at tier 1 as an assertion about the
 *   reader's HEALTH. Surfaced 2026-08-18 by the FAQ-guardrail generation probe: asking the
 *   generator to state a remedy's terms made it write conditions, and the collision was waiting.
 *
 * THE FIX, following the `scale` precedent exactly: the term is NOT deleted — deleting it would
 * silently retire a real detection class. It is removed from the bare list and the health sense is
 * matched positively by HEALTH_CONDITION_RE, through ONE matcher shared by every call site.
 *
 * ⚠️ The discriminator is NOT the determiner. That is what separated the two senses of "scale";
 * here both senses take one ("the condition is that…"). The health sense is marked by a POSSESSIVE
 * or a MEDICAL MODIFIER; the contractual sense by a complementiser clause.
 */

const hitsFor = (text: string) =>
  checkComplianceAxis([{ location: "t", text, role: "body" }]);

const blockingClasses = (text: string) => hitsFor(text).blocking.map((h) => h.classId);

describe("the contractual sense — a clause of terms is not a health claim", () => {
  // ── The exact sentences the generation probe produced. ──
  it("does NOT block 'The condition is that you have done the work through week four.'", () => {
    const res = hitsFor("The condition is that you have done the work through week four.");
    expect(res.blocking).toHaveLength(0);
    expect(res.ok).toBe(true);
  });

  it("does NOT block the full guarantee sentence the probe flagged", () => {
    const real =
      "The remedy is a full refund, the window is fourteen days from your notification, and the condition is that the work through week six has been completed.";
    expect(blockingClasses(real)).not.toContain("second_person_protected_attribute");
    expect(hitsFor(real).blocking).toHaveLength(0);
  });

  it("does NOT block a single named condition of use", () => {
    expect(hitsFor("The only condition is that you attend the live sessions.").blocking).toHaveLength(0);
  });

  it("does NOT block a colon-introduced condition", () => {
    expect(hitsFor("You can use the guarantee on one condition: the coursework is complete.").blocking).toHaveLength(0);
  });

  it("does NOT block terms and conditions", () => {
    expect(hitsFor("Terms and conditions apply to every place you book on the programme.").blocking).toHaveLength(0);
  });

  // ── The probe's isolation controls: each half alone must be inert. ──
  it("stays clean with the noun swapped out ('the requirement is that')", () => {
    expect(hitsFor("The requirement is that you have done the work through week four.").blocking).toHaveLength(0);
  });

  it("stays clean with the second person removed", () => {
    expect(hitsFor("The condition is that the work has been completed.").blocking).toHaveLength(0);
  });
});

describe("the health sense still blocks — the fix must not open a hole", () => {
  it("blocks a possessive health condition asserted of the reader", () => {
    expect(blockingClasses("Your condition improves within the first month.")).toContain("second_person_protected_attribute");
  });

  it("blocks a possessive health condition in a burden frame", () => {
    expect(blockingClasses("Tired of your condition?")).toContain("second_person_protected_attribute");
  });

  it("blocks a medically modified condition asserted of the reader", () => {
    expect(blockingClasses("You have lived with a chronic condition for years.")).toContain("second_person_protected_attribute");
  });

  it("blocks a pre-existing condition asserted of the reader", () => {
    expect(blockingClasses("Your pre-existing condition is not a barrier to joining.")).toContain("second_person_protected_attribute");
  });

  it("keeps blocking the neighbouring health vocabulary untouched by this change", () => {
    expect(blockingClasses("Your diagnosis does not define what you can build.")).toContain("second_person_protected_attribute");
    expect(blockingClasses("Tired of your acne?")).toContain("second_person_protected_attribute");
  });
});

describe("one matcher, so the list and the guarded term cannot drift", () => {
  it("routes every PROTECTED_ATTRIBUTE_TERMS read through the shared matcher", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    expect(src).toMatch(/function protectedAttributeMatch\(/);
    // The matcher's OWN read is the one legitimate direct consultation — drop its body, then
    // require that nothing else reaches the list without going through it.
    const outside = src.replace(/function protectedAttributeMatch\([\s\S]*?\n}/, "");
    const direct = outside.match(/containsAny\([a-zA-Z]+, PROTECTED_ATTRIBUTE_TERMS\)/g) ?? [];
    expect(direct.length, `direct PROTECTED_ATTRIBUTE_TERMS reads outside the matcher: ${direct.length}`).toBe(0);
  });

  it("no longer carries the bare term in the list", () => {
    const src = readFileSync("server/_core/complianceAxis.ts", "utf8");
    const list = (/const PROTECTED_ATTRIBUTE_TERMS = \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? "")
      .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");   // entries, not commentary
    expect(list, 'bare "condition" is still a list term').not.toMatch(/"conditions?"/);
    // The neighbouring health vocabulary must survive — this is a split, not a deletion.
    expect(list).toMatch(/"diagnosis"/);
    expect(list).toMatch(/"illness"/);
  });
});
