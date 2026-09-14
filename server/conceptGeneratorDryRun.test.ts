import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// The dry run is only worth anything if it runs the SAME gate as production. These pins fail the moment someone
// gives the dry-run path its own copy of the gate, moves the early return past the write, or lets the dry-run branch
// call a validator of its own.
const src = readFileSync(join(__dirname, "conceptGenerator.ts"), "utf8");
const fnStart = src.indexOf("export async function generateConceptsForIcp(");
const fnEnd = src.indexOf("\n}\n", fnStart);
const fn = src.slice(fnStart, fnEnd);

describe("generateConceptsForIcp dryRun — shares the production gate, skips only the write", () => {
  it("defines the gate exactly once in the file", () => {
    expect(src.match(/const gate = \(/g)?.length).toBe(1);
  });

  it("returns on dryRun AFTER every gate call and BEFORE the only delete and insert", () => {
    const dryIdx = fn.indexOf("if (params.dryRun)");
    const lastGateCall = fn.lastIndexOf("gate(");
    const deleteIdx = fn.indexOf("db.delete(campaignConcepts)");
    const insertIdx = fn.indexOf("db.insert(campaignConcepts)");
    expect(dryIdx).toBeGreaterThan(-1);
    expect(lastGateCall).toBeLessThan(dryIdx);
    expect(dryIdx).toBeLessThan(deleteIdx);
    expect(dryIdx).toBeLessThan(insertIdx);
  });

  it("has exactly one delete and one insert (the write the dry run skips)", () => {
    expect(fn.match(/db\.delete\(/g)?.length).toBe(1);
    expect(fn.match(/db\.insert\(/g)?.length).toBe(1);
  });

  it("the dry-run branch runs no validation or generation of its own", () => {
    const dryIdx = fn.indexOf("if (params.dryRun)");
    const branch = fn.slice(dryIdx, fn.indexOf("\n  }\n", dryIdx));
    for (const own of ["gate(", "validateConceptSetStructure", "screenConceptCompliance", "checkOutput", "invokeConcepts", "conceptPassesAlone"]) {
      expect(branch, own).not.toContain(own);
    }
    expect(branch).toContain("persisted: 0");
  });

  it("the observer only observes: every gate verdict is still assigned from gate(), never from onGate", () => {
    expect(fn).not.toMatch(/result\s*=\s*observe/);
    expect(fn).not.toMatch(/onGate\?\.\([^)]*\)\s*\?/);
    expect(fn).toMatch(/const observe = params\.onGate \?\? \(\(\) => \{\}\)/);
  });
});
