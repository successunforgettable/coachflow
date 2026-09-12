import { describe, it, expect } from "vitest";
import {
  VALUE_EQUATION_BLOCK,
  VALUE_EQUATION_BLOCK_FREE_ASSET,
  offerStandardBlock,
  offerAngleBlock,
} from "./offerStandard";

/**
 * THE FREE-ASSET OFFER STANDARD CARRIES NO TIMED PROMISE — queue item 15, CLAUDE.md §14b.
 *
 * §14b: what the asset IS may always be described ("a one-page checklist"); a time attached to the
 * READER'S OUTCOME is a claim, barred unless the coach supplied it ("ready to send the same day").
 * The free-asset offer prompt instructed the second shape, in five places, and every offer, magnet
 * and page angle generated 2026-09-10/11 carried it.
 *
 * ⚠️ SCOPE, STATED. These tests read `offerStandardBlock` and `offerAngleBlock` — the standard
 * itself. The per-call lines that `offersGenerator` assembles around it are covered by
 * `leadMagnetOfferMode.test.ts`; the three shared cross-generator compliance blocks are imported
 * further downstream and are outside this file.
 *
 * ⚠️ "immediately" IS DELIBERATELY NOT IN THE SCANNER. The section spec uses it about the PIPELINE
 * ("filled from the campaign's own bonus stack immediately after this step") and the 80/20 bar uses
 * "immediately-usable" as a property of the artefact — neither attaches a time to the reader's
 * result. Adding it would fire on both and say nothing about §14b.
 */

// A time attached to an outcome. Every alternative here is a CLOCK, not a description of the asset.
const TIMED_CLAIM =
  /\btoday\b|\btonight\b|\bovernight\b|\bthe same day\b|\bone sitting\b|\bhow soon\b|\bstraight away\b|\bright away\b|\bquick win\b|\bby day \d+\b|\b(?:in|within) \d+ (?:minutes?|hours?|days?|weeks?)\b|\bin minutes\b/gi;

const timedClaimsIn = (t: string) => (t.match(TIMED_CLAIM) ?? []).map((s) => s.toLowerCase());

// The three bonus bodies that were live on production when item 15 was scoped. They are the
// instrument's calibration: a scanner that cannot see these cannot certify anything.
const LIVE_BAD_COPY = [
  "By Day 7, you will hold a ranked shortlist of the three warmest people to approach.",
  "Pick one and send to a real person today.",
  "You will have a complete sales page draft in 48 hours — the outline complete today.",
];

/** Levers split on their own numbered headings, so a reworded lever cannot hide inside a neighbour. */
function levers(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^(\d)\. ([\s\S]*?)(?=^\d\. |\s*$)/gm)) out[m[1]] = m[2].trimEnd();
  return out;
}

describe("the timed-claim scanner is calibrated before it is trusted (§15k)", () => {
  // 🔴 NEGATIVE CONTROL. Without this, "0 hits" below is indistinguishable from a broken regex.
  // It asserts a POSITIVE artefact of the negative result — a named claim, found — never an absence.
  it("fires on all three bonus bodies that were live when item 15 was scoped", () => {
    for (const bad of LIVE_BAD_COPY) expect(timedClaimsIn(bad).length).toBeGreaterThan(0);
  });

  it("names the specific claim it found, rather than merely returning non-empty", () => {
    expect(timedClaimsIn(LIVE_BAD_COPY[0])).toContain("by day 7");
    expect(timedClaimsIn(LIVE_BAD_COPY[1])).toContain("today");
    expect(timedClaimsIn(LIVE_BAD_COPY[2])).toContain("in 48 hours");
  });

  it("passes a description of the asset itself, which §14b allows", () => {
    expect(timedClaimsIn("A one-page checklist with eight lines to fill in.")).toEqual([]);
  });
});

describe("the free-asset value equation differs from the paid one in lever 3 and nowhere else", () => {
  const paid = levers(VALUE_EQUATION_BLOCK);
  const free = levers(VALUE_EQUATION_BLOCK_FREE_ASSET);

  it("found all four levers in both blocks", () => {
    expect(Object.keys(paid).sort()).toEqual(["1", "2", "3", "4"]);
    expect(Object.keys(free).sort()).toEqual(["1", "2", "3", "4"]);
  });

  // The whole point of duplicating the literal is that levers 1/2/4 must not drift from the paid
  // copy. This is the guard that makes the duplication safe.
  for (const n of ["1", "2", "4"] as const) {
    it(`lever ${n} is byte-identical to the paid block`, () => expect(free[n]).toBe(paid[n]));
  }

  it("lever 3 differs, and only the free-asset one is free of a clock", () => {
    expect(free["3"]).not.toBe(paid["3"]);
    expect(timedClaimsIn(paid["3"])).toContain("how soon"); // control: the paid lever still has it
    expect(timedClaimsIn(free["3"])).toEqual([]);
  });
});

describe("the assembled free-asset prompt attaches no time to the reader's outcome", () => {
  it("the standard block carries no timed claim", () => {
    expect(timedClaimsIn(offerStandardBlock("free_asset"))).toEqual([]);
  });

  for (const angle of ["godfather", "free", "dollar"] as const) {
    it(`the ${angle} angle carries no timed claim`, () => {
      expect(timedClaimsIn(offerAngleBlock("free_asset", angle))).toEqual([]);
    });
  }

  // CONTROL: the paid standard still carries one, so the absence above is a property of the
  // free-asset rewrite and not of a scanner pointed at the wrong string.
  it("control: the paid standard still carries a timed claim, so the checks above can fail", () => {
    expect(timedClaimsIn(offerStandardBlock("paid")).length).toBeGreaterThan(0);
  });
});
