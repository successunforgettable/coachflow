import { describe, it, expect } from "vitest";
import { activeAngleContent, pageTextForAdMatch, LP_AD_MATCH_FIELDS } from "./landingPageActiveAngle";
import { checkAdToPageMatch } from "./complianceAxis";

const RETAINER_ANGLE = {
  eyebrowHeadline: "FOR FREELANCE PRODUCT DESIGNERS",
  mainHeadline: "Move from one-off projects to recurring retainer income",
  subheadline: "Without discounting to close, rewriting the proposal four times, or adding another tool to the stack.",
  problemAgitation: "The quote sits in the outbox for nine days while the client goes quiet and the scope keeps growing.",
  solutionIntro: "Scripts, discounts and faster follow-up all treat the symptom. The scope is what actually moves.",
  uniqueMechanism: "The Scope-First Sequence: the four minutes of the call that decide the rest of the engagement.",
  guarantee: "A guarantee sentence that the ad-to-page check deliberately does not read.",
};

const POSTPARTUM_ANGLE = {
  eyebrowHeadline: "FOR MOTHERS IN THE FIRST YEAR",
  mainHeadline: "Postpartum nutrition coaching for new mothers",
  subheadline: "Rebuild energy after birth with a weekly plan built around feeding, sleep and recovery.",
  problemAgitation: "Every plan assumes eight hours of sleep and a kitchen nobody is crying in.",
  solutionIntro: "Recovery nutrition is sequenced around the feed, not around a calorie target.",
  uniqueMechanism: "The Fourth Trimester Plate: what to eat in the twenty minutes you actually get.",
};

const row = (over: Record<string, unknown> = {}) => ({
  activeAngle: "original",
  originalAngle: RETAINER_ANGLE,
  godfatherAngle: null,
  freeAngle: null,
  dollarAngle: null,
  ...over,
});

const MATCHING_AD =
  "Freelance designers: move from one-off projects to recurring retainer income with a repeatable scoping sequence.";
const UNRELATED_AD =
  "Postpartum nutrition coaching for new mothers who want their energy back after birth and better sleep.";

describe("landing-page active-angle text (the ad-to-page gate's input)", () => {
  it("derives text from the active angle", () => {
    const text = pageTextForAdMatch(row());
    expect(text).toContain("retainer income");
    expect(text).toContain("Scope-First Sequence");
  });

  it("compares only the six argument fields — scaffolding is left out", () => {
    expect(LP_AD_MATCH_FIELDS).toHaveLength(6);
    expect(pageTextForAdMatch(row())).not.toContain("deliberately does not read");
  });

  it("honours activeAngle rather than always reading original", () => {
    const text = pageTextForAdMatch(row({ activeAngle: "godfather", godfatherAngle: POSTPARTUM_ANGLE }));
    expect(text).toContain("Fourth Trimester Plate");
    expect(text).not.toContain("Scope-First Sequence");
  });

  it("falls back to the original angle when the selected one is empty", () => {
    expect(pageTextForAdMatch(row({ activeAngle: "free", freeAngle: null }))).toContain("retainer income");
  });

  it("returns empty for rows with nothing to judge, and never throws", () => {
    expect(pageTextForAdMatch(null)).toBe("");
    expect(pageTextForAdMatch(undefined)).toBe("");
    expect(pageTextForAdMatch({})).toBe("");
    expect(pageTextForAdMatch(row({ activeAngle: "original", originalAngle: null }))).toBe("");
    expect(activeAngleContent(row({ activeAngle: "nonsense" }))).toEqual(RETAINER_ANGLE);
  });

  it("REGRESSION — the old `content` read yields nothing, which is why the gate was dead", () => {
    // The exact shape routers/meta.ts used to read. `landingPages` has no `content` column,
    // so this is what production actually had in hand at every publish.
    expect(pageTextForAdMatch({ content: RETAINER_ANGLE })).toBe("");
  });
});

describe("the restored gate, composed as the publish path composes it", () => {
  it("FIRES when the ad points at a page about something else", () => {
    const r = checkAdToPageMatch(UNRELATED_AD, pageTextForAdMatch(row()));
    expect(r.ok).toBe(false);
    expect(r.blocking[0].classId).toBe("ad_to_page_mismatch");
  });

  it("PASSES when the ad and the page are about the same thing", () => {
    expect(checkAdToPageMatch(MATCHING_AD, pageTextForAdMatch(row())).ok).toBe(true);
  });

  it("PINS THE DEFECT — the same mismatched pair passed silently under the old derivation", () => {
    // Identical ad, identical landing page, only the derivation differs. Under `.content`
    // the page text was "", the gate returned ok on no evidence, and the ad published.
    const deadGate = checkAdToPageMatch(UNRELATED_AD, pageTextForAdMatch({ content: RETAINER_ANGLE }));
    expect(deadGate.ok).toBe(true);
    expect(checkAdToPageMatch(UNRELATED_AD, pageTextForAdMatch(row())).ok).toBe(false);
  });
});
