import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  validateScriptStructure,
  hookWordCount,
  HOOK_MAX_WORDS,
  type RawScript,
} from "./_core/conceptScriptValidator";
import type { ScriptGateRecord } from "./conceptScriptGenerator";
import { summariseGate } from "./scripts/lib-gate-summary";

// The measurement harness must SEE a long hook. Before this, it read only the blocking labels of a failed first
// pass, and `script_hook_too_long` is label-only — so a long hook on a passing draft read as zero (§15k). These
// records are built from the REAL validator verdict, the way gate() builds them, then summarised.

const OPTS = { hookPattern: "problem_first", targetSeconds: 30 };
const LONG_HOOK = "Most coaches I talk to spend their whole Sunday evening dreading the Monday morning client calls ahead."; // 17 words
const SHORT_HOOK = "The Sunday dread arrives before Monday even does."; // 8 words

function script(hook: string, extraSceneWords = 0): RawScript {
  const pad = extraSceneWords ? " " + Array.from({ length: extraSceneWords }, () => "more").join(" ") + "." : "";
  return {
    hookPattern: "problem_first",
    scenes: [
      { sceneNumber: 1, sceneType: "hook", spokenLine: hook, onScreenText: "X", deliveryNote: "d" },
      { sceneNumber: 2, sceneType: "problem", spokenLine: "You are good at the job. That is exactly why leaving feels insane." + pad, onScreenText: "X", deliveryNote: "d" },
      { sceneNumber: 3, sceneType: "solution", spokenLine: "There is a ninety day way to a role that actually fits, without a pay cut.", onScreenText: "X", deliveryNote: "d" },
      { sceneNumber: 4, sceneType: "cta", spokenLine: "Tap learn more and map your pivot this week.", onScreenText: "X", deliveryNote: "d" },
    ],
  };
}

/** One record as gate() + observe() produce it, from the real structure verdict (compliance/output taken as clean). */
function record(attempt: number, s: RawScript): ScriptGateRecord {
  const structure = validateScriptStructure(s, OPTS);
  const scenes = Array.isArray(s.scenes) ? s.scenes : [];
  return {
    attempt,
    scenesReturned: scenes.length,
    ok: structure.ok,
    axes: {
      structureOk: structure.ok, complianceOk: true, outputOk: true,
      structureLabels: structure.ok ? [] : structure.hits.map((h) => h.classId),
      complianceLabels: [], outputLabels: [],
      observedLabels: structure.labels.map((h) => h.classId),
      hookWords: scenes.length > 0 ? hookWordCount(scenes[0]?.spokenLine) : null,
    },
    labels: structure.ok ? "" : structure.hits.map((h) => h.classId).join(", "),
    failContext: structure.ok ? "" : structure.failContext,
  };
}

/** The extraction sprint0b-two-arm used before this fix, verbatim in logic. Kept to prove it was blind. */
const legacyFirstPassLabels = (gate: ScriptGateRecord[]) => {
  const gated = gate.filter((g) => g.ok !== null);
  return gated.length && !gated[0].ok ? String(gated[0].labels || "").split(",").map((s) => s.trim()).filter(Boolean) : [];
};

describe("summariseGate — the harness sees a long hook on a PASSING draft", () => {
  it("known-long hook, first pass OK: caught, with its count — and the old extraction saw nothing", () => {
    const gate = [record(1, script(LONG_HOOK))];
    expect(gate[0].ok).toBe(true); // the draft PASSES — exactly the case the old harness could not see
    const s = summariseGate(gate);
    expect(s.firstPassHookTooLong).toBe(true);
    expect(s.firstPassHookWords).toBe(17);
    expect(s.hookInstrumentMismatch).toBe(false);
    expect(legacyFirstPassLabels(gate)).toEqual([]); // the blind instrument
  });

  it("short hook: a POSITIVE count is reported (not silence), and no label", () => {
    const s = summariseGate([record(1, script(SHORT_HOOK))]);
    expect(s.firstPassHookWords).toBe(8);
    expect(s.firstPassHookTooLong).toBe(false);
    expect(s.hookInstrumentMismatch).toBe(false);
  });

  it("long hook on a FAILING first pass, fixed on the retry: first pass still counts it, every attempt recorded", () => {
    const first = record(1, script(LONG_HOOK, 60)); // over the 30s budget
    expect(first.ok).toBe(false);
    const s = summariseGate([first, record(2, script(SHORT_HOOK))]);
    expect(s.attempts).toBe(2);
    expect(s.firstPassHookTooLong).toBe(true);
    expect(s.firstPassBlockingLabels).toContain("script_length_over_budget");
    expect(s.firstPassBlockingLabels).not.toContain("script_hook_too_long"); // label-only: never blocking
    expect(s.observedLabelsByAttempt).toEqual([["script_hook_too_long"], []]);
  });

  it("negative control on the consistency check: a count over the cap with no label is flagged as a broken instrument", () => {
    const r = record(1, script(SHORT_HOOK));
    r.axes!.hookWords = HOOK_MAX_WORDS + 5;
    expect(summariseGate([r]).hookInstrumentMismatch).toBe(true);
  });

  it("a generation that errored before any gate reports null, not zero", () => {
    const s = summariseGate([{ attempt: 1, scenesReturned: null, ok: null, axes: null, labels: "", failContext: "", error: "boom" }]);
    expect(s.attempts).toBe(0);
    expect(s.firstPassHookWords).toBeNull();
    expect(s.firstPassOk).toBeNull();
  });
});

describe("gate() feeds the observer the same hook count the check uses", () => {
  const src = readFileSync(join(__dirname, "conceptScriptGenerator.ts"), "utf8");
  it("lastAxes carries observedLabels from structure.labels and hookWords from hookWordCount(scene 1)", () => {
    expect(src).toContain("observedLabels: structure.labels.map((h) => h.classId),");
    expect(src).toContain("hookWords: sceneList.length > 0 ? hookWordCount(sceneList[0]?.spokenLine) : null,");
  });
  it("the validator's hook check counts with the same helper", () => {
    const v = readFileSync(join(__dirname, "_core/conceptScriptValidator.ts"), "utf8");
    expect(v).toContain("const hookWords = hookWordCount(scenes[0].spokenLine);");
  });
});
