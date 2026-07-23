import { describe, it, expect } from "vitest";
import { applyBonusesToText, type BonusFill } from "./bonusTokens";

// Offer bonus lines (offersGenerator.ts). Hybrid fix: the prompt now emits name-only, but the fill must
// WHOLE-LINE replace so a drifted trailer (the "live group call" bug) can never survive.
const nameOnly = (n: number) => `BONUS #${n}: [INSERT_BONUS_${n}_NAME]`;
const withTrailer = (n: number) => `BONUS #${n}: [INSERT_BONUS_${n}_NAME] ([INSERT_BONUS_${n}_VALUE]) — A live group call about ${n}.`;

const fill = (index: number, title: string, shortLine: string, value: string | null = null): BonusFill =>
  ({ index, title, shortLine, value });

describe("applyBonusesToText (whole-line replacement + shortLine)", () => {
  it("replaces a name-only slot with 'title — shortLine'", () => {
    const out = applyBonusesToText(nameOnly(1), [fill(1, "The 48-Hour Invoice Checklist", "recover overdue invoices in your first two days")]);
    expect(out).toBe("BONUS #1: The 48-Hour Invoice Checklist — recover overdue invoices in your first two days");
  });

  it("OVERWRITES a drifted contradicting trailer (the live-group-call bug)", () => {
    const out = applyBonusesToText(withTrailer(3), [fill(3, "The 'Tried Coaching Before' Script Bank", "ready-to-use reframe scripts, decide in minutes")]);
    expect(out).toBe("BONUS #3: The 'Tried Coaching Before' Script Bank — ready-to-use reframe scripts, decide in minutes");
    expect(out).not.toContain("live group call");
    expect(out).not.toContain("[INSERT_BONUS");
  });

  it("renders a coach-supplied value in parentheses", () => {
    const out = applyBonusesToText(nameOnly(1), [fill(1, "The Checklist", "does a thing fast", "£97")]);
    expect(out).toBe("BONUS #1: The Checklist (£97) — does a thing fast");
  });

  it("shows no value when the coach supplied none", () => {
    const out = applyBonusesToText(withTrailer(1), [fill(1, "The Checklist", "does a thing fast", null)]);
    expect(out).not.toContain("(");
    expect(out).not.toContain("[INSERT_BONUS");
  });

  it("fills all three and leaves zero bonus tokens", () => {
    const text = [withTrailer(1), withTrailer(2), withTrailer(3)].join("\n\n");
    const out = applyBonusesToText(text, [fill(1, "A", "line a"), fill(2, "B", "line b"), fill(3, "C", "line c")]);
    expect(out).toContain("A — line a");
    expect(out).toContain("B — line b");
    expect(out).toContain("C — line c");
    expect(out).not.toContain("[INSERT_BONUS");
    expect(out).not.toContain("live group call");
  });

  it("strips straggler bonus 4/5 slots the offer may still emit", () => {
    const text = [nameOnly(1), nameOnly(2), nameOnly(3), withTrailer(4), withTrailer(5)].join("\n\n");
    const out = applyBonusesToText(text, [fill(1, "A", "la"), fill(2, "B", "lb"), fill(3, "C", "lc")]);
    expect(out).not.toContain("[INSERT_BONUS");
  });

  it("is a no-op on text with no bonus tokens", () => {
    const clean = "No bonuses mentioned here.";
    expect(applyBonusesToText(clean, [fill(1, "X", "lx")])).toBe(clean);
  });
});
