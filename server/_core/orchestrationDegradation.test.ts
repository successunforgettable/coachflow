import { describe, it, expect } from "vitest";
import { ORCHESTRATION_STEP_LABELS, ORCHESTRATION_STEP_NAMES } from "./orchestration";

// Add-only. Pins the two coach-visible behaviours changed after the beginner
// cascade run died at step 9: the truthfulness of the headline progress label,
// and adCreatives being the LAST cascade step (which is what makes it safe to
// mark optional — nothing downstream consumes its output).
describe("orchestration — terminal-step degradation + label truthfulness", () => {
  it("headline label claims no headline COUNT (liteMode produces ~10, not 100)", () => {
    const label = ORCHESTRATION_STEP_LABELS.headlines;
    // "5 formulas" is true and stays. What must not return is a quantity
    // attached to the headlines themselves — the old label promised 100.
    expect(label).not.toMatch(/\d+\s*\+?\s*headline/i);
    expect(label.toLowerCase()).toContain("headline");
  });

  it("adCreatives is the final cascade step, so its failure costs only itself", () => {
    expect(ORCHESTRATION_STEP_NAMES[ORCHESTRATION_STEP_NAMES.length - 1]).toBe("adCreatives");
  });

  it("every load-bearing text step still precedes adCreatives", () => {
    const idx = (n: string) => ORCHESTRATION_STEP_NAMES.indexOf(n as never);
    for (const loadBearing of [
      "offer", "mechanism", "hvco", "headlines",
      "adCopy", "landingPage", "emailSequence", "whatsappSequence",
    ]) {
      expect(idx(loadBearing)).toBeGreaterThanOrEqual(0);
      expect(idx(loadBearing)).toBeLessThan(idx("adCreatives"));
    }
  });
});
