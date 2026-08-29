import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * THE APPROVED COPY IS PINNED CHARACTER-FOR-CHARACTER.
 *
 * Arfeen approved this wording twice and it shipped nowhere — the server computed the questions and
 * no caller rendered them. Now that it IS rendered, this guard exists so it cannot drift back out or
 * be "improved" in passing. Changing either string is a product decision; this test failing is the
 * intended alarm, not an obstacle.
 *
 * Read from source rather than imported: V2Trail pulls in the whole React/tRPC client tree, which a
 * node-environment unit test cannot load. The strings are what matter, and they are what is checked.
 * (Lives under server/ only because vitest's include is `server/**` — it is a client-source guard.)
 *
 * ⚠️ THIS FILE IS BOOKKEEPING, NOT EVIDENCE. Every assertion here greps SOURCE TEXT. It can prove
 * the code is shaped the way we intended and it can catch a later edit undoing that shape, which is
 * worth having. It CANNOT prove the ask renders, survives a reload, or is answerable. The evidence
 * for that is the live before-and-after on kit 222: the same kit, the same URL, the same reload,
 * with the date control and the Skip chip ABSENT on 246ffb8 and PRESENT after the fix. Judge the
 * behaviour there and treat a green run here as nothing more than "the shape has not drifted".
 */
const SRC = readFileSync(new URL("../client/src/v2/V2Trail.tsx", import.meta.url), "utf8");

const APPROVED_ASK =
  "Planning to run a live session for the people who download this? Give me the date, time and timezone and I'll build the registration page — your guide will send readers straight to it.";
const APPROVED_SKIP =
  "No date yet? Skip this. Your guide still ends with an invitation, it just won't have a link.";

// Anchored on the function, not on a step name. The ask deliberately no longer lives inside any
// step's turn — see the reload defect of 2026-08-29.
//
// ⚠️ BOTH ANCHORS ARE ASSERTED FOUND, and this is not defensive noise — it is a bug this file
// actually had. The end anchor used to be "FREE_STEP_ACK_SKIPPED," (with a comma), which appears
// NOWHERE in V2Trail: the constant is used as `skipped ? FREE_STEP_ACK_SKIPPED : ...`. indexOf
// returned -1, `slice(start, -1)` silently means "to the end of the file", and so every
// `expect(askBlock())` in this suite was really asserting against the whole remainder of a
// 2,400-line file. The positive assertions passed anyway and the one negative assertion passed by
// luck. A scoped assertion that is not actually scoped is the §15c shape — it cannot fail for the
// reason it claims to check. Caught 2026-08-29 only because a new negative assertion tripped over
// unrelated code the block should never have contained.
const START = "const maybeAskFreeStep = async () =>";
const END = '[trail] free-next-step ask failed';
const askBlock = () => {
  const a = SRC.indexOf(START), b = SRC.indexOf(END);
  if (a < 0 || b < 0 || b <= a) throw new Error(`askBlock anchors broken: start=${a} end=${b}`);
  return SRC.slice(a, b);
};

describe("free-next-step intake copy — approved wording, shipped exactly", () => {
  it("the block anchors resolve — without this every scoped assertion below is meaningless", () => {
    expect(SRC.indexOf(START)).toBeGreaterThan(-1);
    expect(SRC.indexOf(END)).toBeGreaterThan(SRC.indexOf(START));
    // A sanity bound: the ask is a few dozen lines, not the rest of the file.
    expect(askBlock().length).toBeLessThan(6000);
  });
  it("the ASK is present verbatim", () => expect(SRC).toContain(APPROVED_ASK));
  it("the SKIP hint is present verbatim", () => expect(SRC).toContain(APPROVED_SKIP));
  it("both are exported named constants, not inlined at the call site", () => {
    expect(SRC).toMatch(/export const FREE_STEP_ASK\s*=/);
    expect(SRC).toMatch(/export const FREE_STEP_SKIP_HINT\s*=/);
  });
  it("🔑 rendered ONLY from what the server returned — never inferred from campaignType", () => {
    // The defect this exists to fix was a server value with no renderer. The opposite failure would
    // be a renderer that guesses. Pin that the GATE is the server's own array.
    //
    // ⚠️ Corrected 2026-08-29. This previously matched /Array.isArray(fr.freeStepQuestions) &&
    // ...length > 0/, which after the refactor was ALSO satisfied by the `while` loop's continuation
    // condition further down — so the assertion would have gone green without the guard clause
    // existing at all. An assertion that can pass through a construct it was not written for is the
    // §15c shape. Pinned to the early-return guard specifically.
    expect(askBlock()).toMatch(
      /if \(!Array\.isArray\(fr\.freeStepQuestions\) \|\| fr\.freeStepQuestions\.length === 0\) return;/,
    );
    expect(askBlock()).not.toMatch(/campaignType\s*===\s*["']lead_magnet["']/);
  });

  it("🔑 A STATE CONDITION, NOT A PLACEMENT — the ask is not attached to any step's turn", () => {
    // The 2026-08-29 defect: the ask sat at the tail of the `hvco` iteration, so it fired at a
    // moment the resume path could never return to. It must not be gated on a step name again.
    expect(askBlock()).not.toMatch(/stepDef\.step\s*===/);
    expect(askBlock()).toMatch(/if \(kit\.selectedHvcoId == null\) return;/);
    expect(askBlock()).toMatch(/if \(kit\.selectedLandingPageId != null\) return;/);
  });

  it("🔑 offered BEFORE the completed-node skip, or resume swallows it again", () => {
    // This is the whole fix in one assertion. `if (kit[stepDef.field] != null) continue` is what
    // skipped the ask on every reload; the call has to come first inside the loop body.
    // Scoped to runManualLoop. The auto loop has its own `for (const stepDef of AUTO_STEPS)` and it
    // comes FIRST in the file — anchoring on the bare loop header compared the manual call site
    // against the AUTO loop's skip line and failed for a reason that had nothing to do with the fix.
    const manual = SRC.slice(SRC.indexOf("const runManualLoop = async () =>"));
    const loop = manual.slice(manual.indexOf("for (const stepDef of AUTO_STEPS) {"));
    const call = loop.indexOf("await maybeAskFreeStep();");
    const skip = loop.indexOf("if (kit[stepDef.field] != null) continue;");
    expect(call).toBeGreaterThan(-1);
    expect(skip).toBeGreaterThan(-1);
    expect(call).toBeLessThan(skip);
  });

  it("🔑 cancellation still aborts the cascade, not merely the ask", () => {
    // Moving the ask into an arrow function changed what its internal `return` statements do.
    // Without a re-check at the call site a cancelled run would build one more node.
    expect(SRC).toMatch(/await maybeAskFreeStep\(\);[\s\S]{0,400}?if \(cancelled\.current\) return;/);
  });
  it("🔑 a skippable ask, never a gate — Skip offered on every question", () => {
    expect(askBlock()).toContain('"Skip"');
    expect(askBlock()).toContain("__SKIP__");
  });
  it("🔑 a skip records NOTHING — it breaks out before answerCampaignFact", () => {
    // Nothing is generated to fill an unanswered question: missing stays missing, and the magnet
    // keeps the honest text card.
    expect(askBlock()).toMatch(/__SKIP__[\s\S]{0,60}skipped = true;\s*break;/);
  });
  it("🔑 non-fatal by construction — the ask can never block the campaign", () => {
    // Case-insensitive: the comment reads "Non-fatal by construction" at the start of a sentence.
    // The old lowercase-only regex passed solely because the unscoped askBlock spanned the whole
    // file and matched some other catch block entirely.
    expect(askBlock()).toMatch(/catch \(e\)[\s\S]{0,200}non-fatal/i);
  });
});
