import { describe, it, expect } from "vitest";
import { detectEditedIntelKeys, BUYER_INTEL_KEYS } from "./services";

/**
 * THE PROOF FOR THE 2026-09-03 UPDATE-PATH FIX.
 *
 * The defect: `typeof updateData[k] === "string"` read "the key is in the payload" as "the coach
 * wrote this". Because CreateServiceStep resends all seven fields loaded from expandProfile's own
 * output, a coach clicking through the review screen unchanged converted the entire invention into
 * `coach_stated` — which the ICP prompt then presents as the coach's own words with override
 * authority.
 *
 * ⚠️ THE RUN IS VOID IF BOTH ARMS AGREE. "No fields tagged" is what a working comparison AND a
 * broken one both produce, so a single arm proves nothing. The two arms below must DIFFER, and the
 * final test asserts exactly that rather than trusting the two to have been read correctly.
 */

/** A stored row as expandProfile left it — all seven populated, none of them the coach's words. */
const stored: Record<string, unknown> = {
  painPoints: "They open the notes app and close it again.",
  whyProblemExists: "Nobody sequenced the first step for them.",
  failedSolutions: "A course they never finished.",
  falseBeliefsVsRealReasons: "They think it is knowledge; it is sequence.",
  hiddenReasons: "They will not say they are afraid of looking foolish.",
  avatarName: "Priya",
  avatarTitle: "Senior specialist, eleven years in",
};

describe("detectEditedIntelKeys — presence is not authorship", () => {
  // ── ARM A — the form resends everything, unchanged ──────────────────────────────────────
  it("ARM A: a save with NOTHING changed detects ZERO edits, even though all seven are sent", () => {
    const incoming = { ...stored, category: "coaching" }; // CreateServiceStep's exact shape
    expect(detectEditedIntelKeys(incoming, stored)).toEqual([]);
  });

  it("ARM A: the OLD presence test would have flagged all seven — this is what changed", () => {
    const incoming = { ...stored };
    const oldBehaviour = BUYER_INTEL_KEYS.filter((k) => typeof incoming[k] === "string");
    expect(oldBehaviour).toHaveLength(7);                      // the defect, reproduced
    expect(detectEditedIntelKeys(incoming, stored)).toHaveLength(0); // the fix
  });

  // ── ARM B — the coach changes exactly one field ─────────────────────────────────────────
  it("ARM B: a save with EXACTLY ONE field changed detects exactly that field", () => {
    const incoming = { ...stored, painPoints: "They keep rewriting the same LinkedIn headline." };
    expect(detectEditedIntelKeys(incoming, stored)).toEqual(["painPoints"]);
  });

  it("ARM B: the other six are untouched and stay undetected", () => {
    const incoming = { ...stored, avatarName: "Basim" };
    const edited = detectEditedIntelKeys(incoming, stored);
    expect(edited).toEqual(["avatarName"]);
    expect(edited).not.toContain("painPoints");
    expect(edited).not.toContain("hiddenReasons");
  });

  // ── THE DISCRIMINATOR — the two arms must differ, or the comparison is not running ──────
  it("THE RUN IS VOID UNLESS THE ARMS DIFFER — asserted directly", () => {
    const armA = detectEditedIntelKeys({ ...stored }, stored);
    const armB = detectEditedIntelKeys({ ...stored, painPoints: "something genuinely new" }, stored);
    expect(armA).not.toEqual(armB);
    expect(armA).toHaveLength(0);
    expect(armB).toHaveLength(1);
  });

  // ── Normalisation: cosmetic round-trips must not manufacture authorship ─────────────────
  it("trailing/leading whitespace is NOT an edit", () => {
    expect(detectEditedIntelKeys({ painPoints: "  " + stored.painPoints + "  " }, stored)).toEqual([]);
  });

  it("collapsed internal whitespace is NOT an edit", () => {
    const respaced = String(stored.painPoints).replace(" ", "   ").replace(" ", "\n");
    expect(detectEditedIntelKeys({ painPoints: respaced }, stored)).toEqual([]);
  });

  it("a real word change IS an edit even when whitespace also differs", () => {
    expect(detectEditedIntelKeys({ painPoints: "  They open the notes app and give up.  " }, stored))
      .toEqual(["painPoints"]);
  });

  // ── Edge cases that must not be read as authorship ──────────────────────────────────────
  it("a field absent from the payload is never an edit", () => {
    expect(detectEditedIntelKeys({ category: "speaking" }, stored)).toEqual([]);
  });

  it("a non-string value is never an edit", () => {
    expect(detectEditedIntelKeys({ painPoints: null, avatarName: 42 }, stored)).toEqual([]);
  });

  it("filling a previously EMPTY field IS an edit — the coach supplied what was missing", () => {
    const blank = { ...stored, hiddenReasons: "" };
    expect(detectEditedIntelKeys({ hiddenReasons: "They resent being the one who tracks it." }, blank))
      .toEqual(["hiddenReasons"]);
  });

  it("clearing a field IS an edit — the coach removed content deliberately", () => {
    expect(detectEditedIntelKeys({ avatarTitle: "" }, stored)).toEqual(["avatarTitle"]);
  });

  it("only the seven buyer-intel keys are ever considered", () => {
    const incoming = { ...stored, name: "A new service name", description: "Rewritten entirely" };
    expect(detectEditedIntelKeys(incoming, stored)).toEqual([]);
  });
});
