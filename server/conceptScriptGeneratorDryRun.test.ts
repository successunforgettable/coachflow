import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// The script dry run is only worth anything if it runs the SAME gate as production. These pins fail the moment someone
// gives the dry-run path its own copy of the gate, moves the early return past the write, lets the dry-run branch call
// a validator of its own, takes a verdict from the observer, or lets the batch path reach the dry run.
// Every position is asserted FOUND (> -1) before it is compared, so a renamed marker fails rather than passes (§15k).
const read = (p: string) => readFileSync(join(__dirname, p), "utf8");
const src = read("conceptScriptGenerator.ts");
const fnStart = src.indexOf("export async function generateScriptForConcept(params: {");
const fnEnd = src.indexOf("\n}\n", fnStart);
const fn = src.slice(fnStart, fnEnd);

describe("generateScriptForConcept dryRun — shares the production gate, skips only the write", () => {
  it("defines the gate exactly once in the file", () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    expect(src.match(/const gate = \(/g)?.length).toBe(1);
  });

  it("returns on dryRun AFTER every gate call and the final-failure throw, and BEFORE the only write", () => {
    const dryIdx = fn.indexOf("if (params.dryRun)");
    const lastGateCall = fn.lastIndexOf("gate(");
    const throwIdx = fn.indexOf("if (!result.ok) throw");
    const insertIdx = fn.indexOf("db.insert(conceptScripts)");
    for (const idx of [dryIdx, lastGateCall, throwIdx, insertIdx]) expect(idx).toBeGreaterThan(-1);
    expect(lastGateCall).toBeLessThan(dryIdx);
    expect(throwIdx).toBeLessThan(dryIdx);
    expect(dryIdx).toBeLessThan(insertIdx);
    // The insert is the function's only write: one insert, no update, no delete.
    expect(fn.match(/db\.insert\(/g)?.length).toBe(1);
    expect(fn).not.toMatch(/db\.update\(|db\.delete\(|\.execute\(/);
    // The dry run reports the very object the insert receives.
    expect(fn).toContain("db.insert(conceptScripts).values(row)");
  });

  it("the dry-run branch runs no validation, generation or database call of its own", () => {
    const dryIdx = fn.indexOf("if (params.dryRun)");
    const branchEnd = fn.indexOf("\n  }\n", dryIdx);
    expect(dryIdx).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(dryIdx);
    const branch = fn.slice(dryIdx, branchEnd);
    for (const own of ["gate(", "validateScriptStructure", "screenScriptCompliance", "checkOutput", "invokeScript", "generateAttempt", "db.", "observe("]) {
      expect(branch, own).not.toContain(own);
    }
    expect(branch).toContain("dryRun: true");
    expect(branch).toContain("wouldInsert: row");
  });

  it("the observer only observes: every verdict still comes from gate(), never from onGate or lastAxes", () => {
    expect(fn).toMatch(/const observe = params\.onGate \?\? \(\(\) => \{\}\)/);
    expect(fn).not.toMatch(/result\s*=\s*observe/);
    expect(fn).not.toMatch(/onGate\?\.\(/);
    expect(fn).not.toMatch(/if \([^)]*(lastAxes|observe)/);
    expect(fn).not.toMatch(/ok:\s*lastAxes/);
    // Exactly the two production assignments of the verdict, both from gate().
    expect(fn.match(/result = gate\(/g)?.length).toBe(2);
    expect(fn).toContain("if (structure.ok && compliance.ok && output.ok) return { ok: true, failContext: \"\", labels: \"\" };");
    // A generation error is observed and RE-THROWN, never swallowed.
    const attemptStart = fn.indexOf("const generateAttempt = async");
    const attemptEnd = fn.indexOf("\n  };\n", attemptStart);
    expect(attemptStart).toBeGreaterThan(-1);
    expect(fn.slice(attemptStart, attemptEnd)).toMatch(/catch \(err\) \{[\s\S]*observe\([\s\S]*throw err;/);
  });

  // ── promptTransform (sprint 0b): a measurement seam that must be INERT in production ────────────
  it("promptTransform is applied to the built prompt and nothing else; absent, the built prompt is used as-is", () => {
    const build = fn.indexOf("const builtPrompt = buildConceptScriptPrompt(");
    const apply = fn.indexOf("const prompt = params.promptTransform ? params.promptTransform(builtPrompt) : builtPrompt;");
    expect(build).toBeGreaterThan(-1);
    expect(apply).toBeGreaterThan(build);
    // exactly one build site and one application site — no second prompt path
    expect(src.match(/buildConceptScriptPrompt\(/g)?.length).toBe(2); // the definition and this one call
    expect(fn.match(/params\.promptTransform/g)?.length).toBe(2);     // the ternary's test and its call
  });

  it("promptTransform touches ONLY the prompt: the gate, the attempt budget and the write are downstream of it", () => {
    const apply = fn.indexOf("params.promptTransform ? params.promptTransform(builtPrompt)");
    const gate = fn.indexOf("const gate = (");
    const budget = fn.indexOf("const MAX_ATTEMPTS = 3");
    const insert = fn.indexOf("db.insert(conceptScripts)");
    for (const i of [apply, gate, budget, insert]) expect(i).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(apply);
    expect(budget).toBeGreaterThan(apply);
    expect(insert).toBeGreaterThan(apply);
    // it is never consulted again after the prompt is built
    expect(fn.slice(gate).includes("promptTransform")).toBe(false);
  });

  it("the default path is unchanged: same budget and loop, and the batch path never reaches the dry run", () => {
    expect(fn).toContain("const MAX_ATTEMPTS = 3;");
    expect(fn).toContain("for (let attempt = 2; attempt <= MAX_ATTEMPTS && !result.ok; attempt++)");
    expect(fn).toMatch(/if \(!result\.ok\) throw new Error\(`Script failed validation after \$\{MAX_ATTEMPTS\} attempts/);
    expect(fn).not.toMatch(/\bjobs\b/);
    const batch = read("conceptScriptBatch.ts");
    expect(batch).toContain("generateScriptForConcept({ userId, conceptId, scriptSetId })");
    expect(batch).not.toContain("dryRun");
    expect(read("_core/scriptBatch.ts")).not.toContain("dryRun");
    // The only caller that passes it is the capture harness, and it must pass it.
    expect(read("scripts/script-dry-run-capture.ts")).toContain("dryRun: true");
  });
});
