/**
 * Regression: the live crash found by the sprint-0b run — "scenes.forEach is not a function", thrown on 2 of 24
 * arm-(a) cells (concepts 224 and 230, run 3).
 *
 * The model returned `scenes` as something other than an array. `json_schema` declares it an array, but on the
 * Anthropic tool-use path that is steering, not enforcement (§15i), and the old `script.scenes ?? []` only guarded
 * null/undefined — a wrong TYPE went straight into `.forEach`.
 *
 * Why it mattered more than a bad draft: the throw happened inside `gate()`, which sits OUTSIDE `generateAttempt`'s
 * try — so it escaped the attempt loop entirely. No retry, no `recordComplianceGate`, the whole generation died.
 * The exact payload the model sent was not captured (the throw escaped before anything recorded it), so this pins
 * the FAILURE MODE across the shapes a JSON response can actually take, and the exact error message it produced.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { validateScriptStructure, screenScriptCompliance } from "./_core/conceptScriptValidator";

const OPTS = { hookPattern: "meme_humor", targetSeconds: 30 };
const SCENE = { sceneNumber: 1, sceneType: "hook", spokenLine: "A line the coach says.", onScreenText: "CAP", deliveryNote: "warm" };

/** Every non-array shape a `scenes` field has plausibly arrived as. Each one used to throw. */
const NON_ARRAYS: Array<[string, unknown]> = [
  ["object keyed by index", { "0": SCENE, "1": SCENE }],
  ["object with a scenes key", { scenes: [SCENE] }],
  ["JSON string", JSON.stringify([SCENE])],
  ["plain string", "hook: a line the coach says"],
  ["number", 5],
  ["boolean", true],
];

describe("scenes arrives as a non-array (live crash, sprint-0b run)", () => {
  for (const [label, scenes] of NON_ARRAYS) {
    it(`${label}: validateScriptStructure fails the gate instead of throwing`, () => {
      const r = validateScriptStructure({ hookPattern: "meme_humor", scenes } as any, OPTS);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      // reads as NO scenes, which is a normal, retryable gate failure
      expect(r.hits.map((h) => h.classId)).toContain("script_too_few_scenes");
      expect(r.failContext.length).toBeGreaterThan(0);
    });

    it(`${label}: screenScriptCompliance returns a verdict instead of throwing`, () => {
      const r = screenScriptCompliance(scenes as any);
      expect(r.ok).toBe(true); // nothing to screen is not a compliance failure
    });
  }

  it("null and undefined still read as no scenes (the original ?? [] behaviour is kept)", () => {
    for (const v of [null, undefined]) {
      const r = validateScriptStructure({ hookPattern: "meme_humor", scenes: v } as any, OPTS);
      expect(r.ok).toBe(false);
      expect(screenScriptCompliance(v as any).ok).toBe(true);
    }
  });

  it("a real array is untouched: a valid script still passes both axes", () => {
    const scenes = [
      { ...SCENE, spokenLine: "Most people never open the laptop at all." },
      { ...SCENE, sceneNumber: 2, sceneType: "problem", spokenLine: "They wait for a certainty that never turns up in the end." },
      { ...SCENE, sceneNumber: 3, sceneType: "turn", spokenLine: "Name one problem you already solve, then write to one person who has it today." },
      { ...SCENE, sceneNumber: 4, sceneType: "cta", spokenLine: "On Sunday we do that together, live and free. The link is below for you." },
    ];
    const r = validateScriptStructure({ hookPattern: "meme_humor", scenes } as any, OPTS);
    expect(r.ok).toBe(true);
    expect(screenScriptCompliance(scenes as any).ok).toBe(true);
  });

  it("the generator normalises once and feeds all three axes from it (no `s.scenes ?? []` left on the gate path)", () => {
    const src = readFileSync(join(__dirname, "conceptScriptGenerator.ts"), "utf8");
    expect(src).toContain("const sceneList: any[] = Array.isArray(s.scenes) ? s.scenes : [];");
    expect(src.includes("s.scenes ?? []")).toBe(false);
    expect(src.match(/Array\.isArray\(script\.scenes\)/g)?.length).toBe(1); // the post-gate row build
  });
});
