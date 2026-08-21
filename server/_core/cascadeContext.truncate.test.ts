import { describe, it, expect } from "vitest";
import { truncateAtSentence } from "./cascadeContext";

// Regression suite for the missing `g` flag in truncateAtSentence.
// Before the fix, /[.!?]\s/.exec() found only the FIRST sentence boundary,
// so the function returned one opening sentence and `maxChars` was almost
// never the binding constraint — the 900-cap mechanism description at
// describeMechanism() and the 300-cap hvcoTopic at describeHvco() both
// carried a fraction of their budget.

const SENTENCE = "Each numbered step closes one specific gap in the client's current process. ";

describe("truncateAtSentence — carries whole sentences up to the cap", () => {
  it("carries multiple sentences up to the cap, not just the first", () => {
    const text = SENTENCE.repeat(20).trim(); // ~1500 chars, 20 sentences
    const out = truncateAtSentence(text, 900);

    expect(out.length).toBeLessThanOrEqual(900);
    // The old behaviour returned exactly one sentence.
    expect(out.length).toBeGreaterThan(SENTENCE.trim().length);
    // Spends most of the budget rather than a sliver of it.
    expect(out.length).toBeGreaterThan(800);
    // Cut lands on a sentence boundary, never mid-clause.
    expect(out.endsWith(".")).toBe(true);
    expect(text.startsWith(out)).toBe(true);
  });

  it("cuts at the LAST boundary within the cap, and adding one more sentence would overflow", () => {
    const text = SENTENCE.repeat(20).trim();
    const out = truncateAtSentence(text, 900);
    const carried = out.split(". ").length;
    const oneMore = SENTENCE.trim().repeat(1); // any further sentence pushes past 900
    expect(out.length + oneMore.length).toBeGreaterThan(900);
    expect(carried).toBeGreaterThan(1);
  });

  it("applies the same behaviour at the 300-char hvcoTopic cap", () => {
    const text = SENTENCE.repeat(10).trim();
    const out = truncateAtSentence(text, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.length).toBeGreaterThan(SENTENCE.trim().length);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("truncateAtSentence — unchanged cases", () => {
  it("returns a single sub-cap sentence unchanged", () => {
    const text = "A three-step framework that removes decision fatigue from onboarding.";
    expect(truncateAtSentence(text, 900)).toBe(text);
    expect(truncateAtSentence(text, 300)).toBe(text);
  });

  it("hard-cuts at the cap when no sentence boundary fits", () => {
    const text = "x".repeat(1200); // no boundary at all
    const out = truncateAtSentence(text, 900);
    expect(out.length).toBe(900);
    expect(out).toBe(text.slice(0, 900));
  });

  it("hard-cuts at the cap when the first boundary lies beyond the cap", () => {
    const text = "y".repeat(950) + ". " + "then a second sentence follows here.";
    const out = truncateAtSentence(text, 900);
    expect(out.length).toBe(900);
    expect(out).toBe(text.slice(0, 900));
  });

  it("trims and returns text that already fits", () => {
    expect(truncateAtSentence("   spaced out.   ", 900)).toBe("spaced out.");
  });

  it("returns an empty string for empty input", () => {
    expect(truncateAtSentence("", 900)).toBe("");
  });

  it("carries a multi-sentence body whole when it fits under the cap", () => {
    // Previously this lost everything after the first full stop even though
    // the whole body was well inside the budget.
    const text = "First sentence here. Second sentence here. Third sentence here.";
    expect(truncateAtSentence(text, 900)).toBe(text);
  });
});
