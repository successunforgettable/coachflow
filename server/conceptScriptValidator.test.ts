import { describe, it, expect } from "vitest";
import {
  validateScriptStructure,
  screenScriptCompliance,
  type RawScript,
} from "./_core/conceptScriptValidator";

function okScript(overrides: Partial<RawScript> = {}): RawScript {
  return {
    hookPattern: "problem_first",
    scenes: [
      { sceneNumber: 1, sceneType: "hook", spokenLine: "Every Sunday at 6pm the dread arrives before Monday even does.", onScreenText: "THE SUNDAY DREAD", deliveryNote: "Direct to camera, low and honest." },
      { sceneNumber: 2, sceneType: "problem", spokenLine: "You are good at the job. That is exactly why leaving feels insane.", onScreenText: "GOOD ≠ RIGHT", deliveryNote: "Slow, let it land." },
      { sceneNumber: 3, sceneType: "solution", spokenLine: "There is a ninety day way to a role that actually fits, without a pay cut.", onScreenText: "90 DAYS", deliveryNote: "Lift energy." },
      { sceneNumber: 4, sceneType: "cta", spokenLine: "Tap learn more and map your pivot this week.", onScreenText: "LEARN MORE", deliveryNote: "Warm, inviting." },
    ],
    ...overrides,
  };
}

describe("validateScriptStructure — structural only (NOT an ICP-fabrication truth check)", () => {
  it("passes a well-formed script that matches the concept hookPattern + length", () => {
    const r = validateScriptStructure(okScript(), { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(true);
  });

  it("fails when a scene is missing its spokenLine", () => {
    const s = okScript();
    s.scenes[1].spokenLine = "";
    const r = validateScriptStructure(s, { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some((h) => h.classId === "script_missing_spoken_line")).toBe(true);
  });

  it("fails when the first scene is not the hook (opening must be the hook)", () => {
    const s = okScript();
    s.scenes[0].sceneType = "problem";
    const r = validateScriptStructure(s, { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some((h) => h.classId === "script_opening_not_hook")).toBe(true);
  });

  it("fails when the script's hookPattern does not match the concept's hookPattern", () => {
    const r = validateScriptStructure(okScript({ hookPattern: "meme_humor" }), { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some((h) => h.classId === "script_hook_pattern_mismatch")).toBe(true);
  });

  it("fails when total spoken length blows past the capped target budget", () => {
    const s = okScript();
    s.scenes[3].spokenLine = "and ".repeat(400); // ~400 words, far over a 30s budget
    const r = validateScriptStructure(s, { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some((h) => h.classId === "script_length_over_budget")).toBe(true);
  });

  it("fails when there are too few scenes to be a script", () => {
    const r = validateScriptStructure({ hookPattern: "problem_first", scenes: [okScript().scenes[0]] }, { hookPattern: "problem_first", targetSeconds: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some((h) => h.classId === "script_too_few_scenes")).toBe(true);
  });
});

describe("screenScriptCompliance — routes spoken/on-screen copy through complianceFilter", () => {
  it("passes clean script copy", () => {
    expect(screenScriptCompliance(okScript().scenes).ok).toBe(true);
  });

  it("flags fabricated scarcity in a spoken line (direct_offer_urgency risk)", () => {
    const s = okScript();
    s.scenes[3].spokenLine = "This offer expires tonight — gone forever at midnight, act now.";
    const r = screenScriptCompliance(s.scenes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failContext.toLowerCase()).toContain("scarcity");
  });
});
