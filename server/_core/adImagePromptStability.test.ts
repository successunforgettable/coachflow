/**
 * BYTE-FOR-BYTE STABILITY OF THE SURVIVING AD-IMAGE PROMPTS.
 *
 * WHY THIS EXISTS. The object slot was retired on 2026-08-01 by deleting its
 * template and its four object-only strings from `generateAdImagePrompt`. The
 * danger in that edit is not the deletion — it is the neighbours. Four strings
 * in that function are SHARED with the surviving `screenshot` style:
 *
 *   cleanPlate · compositionSetting · nicheContextSetting · complianceNoteStill
 *
 * `complianceNoteStill` was CREATED by the L4 object work, so the intuitive way
 * to undo the object slot — reverting the L1–L5 commits — would drag it back
 * into the person-worded `complianceNotePerson` and silently reword the
 * screenshot prompt. `screenshot` renders on gpt-image-1 and was 6/6 clean on
 * the L1–L4 run and clean on the live Step D run; a silent reword is exactly
 * the kind of regression that passes every other gate.
 *
 * The fixture was captured from the pre-retirement code and is asserted
 * verbatim here. Every surviving style, both `uglyMode` values, with and
 * without a resolved subject clause. If any of these prompts changes by a
 * single character, this test fails and names the variant.
 *
 * A DELIBERATE prompt change should update the fixture in the same commit that
 * changes the prompt — never separately, and never to make a red test green.
 */
import { describe, it, expect } from "vitest";
import { generateAdImagePrompt } from "../routers/adCreatives";
import { AD_VARIATIONS } from "./adVariations";
import baseline from "./__fixtures__/adImagePrompts.baseline.json";

const NICHE = "burnt-out sales managers at mid-market SaaS companies";
const PROBLEM =
  "They inherit a team that has missed target three quarters running and cannot tell whether it is the people or the pipeline.";
const SUBJECT = "A woman in her late thirties";

const SURVIVING = ["person_shocked", "screenshot", "person_intense", "person_curious"] as const;

const fixture = baseline as Record<string, string>;

describe("surviving ad-image prompts are byte-for-byte unchanged by the object retirement", () => {
  for (const style of SURVIVING) {
    it(`${style} — uglyMode off, resolved subject`, () => {
      expect(generateAdImagePrompt(style, NICHE, PROBLEM, false, SUBJECT))
        .toBe(fixture[`${style}|ugly=false|subject`]);
    });

    it(`${style} — uglyMode on, resolved subject`, () => {
      expect(generateAdImagePrompt(style, NICHE, PROBLEM, true, SUBJECT))
        .toBe(fixture[`${style}|ugly=true|subject`]);
    });

    it(`${style} — uglyMode off, no subject (legacy call sites)`, () => {
      expect(generateAdImagePrompt(style, NICHE, PROBLEM))
        .toBe(fixture[`${style}|ugly=false|nosubject`]);
    });

    it(`${style} — uglyMode on, no subject (legacy call sites)`, () => {
      expect(generateAdImagePrompt(style, NICHE, PROBLEM, true))
        .toBe(fixture[`${style}|ugly=true|nosubject`]);
    });
  }

  it("the fixture covers exactly the styles still in the deck", () => {
    expect([...SURVIVING].sort()).toEqual(AD_VARIATIONS.map((v) => v.style).sort());
  });

  it("the fixture itself carries no object-only string", () => {
    // Guards the guard: if the baseline had been captured AFTER a bad edit, the
    // equality assertions above would happily pin the regression.
    for (const [key, prompt] of Object.entries(fixture)) {
      expect(prompt, key).not.toContain("worked smooth and continuous");
      expect(prompt, key).not.toContain("an object study only");
    }
  });
});
