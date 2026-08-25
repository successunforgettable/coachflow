import { describe, it, expect } from "vitest";
import { truncateAtSentence, truncateAtBlock } from "./cascadeContext";

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

// ─────────────────────────────────────────────────────────────────────────────
// truncateAtBlock — the instrument for STRUCTURED content.
//
// `truncateAtSentence` is correct for prose and wrong here. A lead-magnet section or toolkit tool
// carries markdown artefacts — fill-in templates, checklists the reader ticks, swipe messages —
// and none of a bold label, a list item, a checkbox row or a table row ends in sentence
// punctuation. Cutting at the last `[.!?]\s` inside the cap therefore lands INSIDE the artefact,
// and a swipe message severed halfway is worse than one that is absent.
// ─────────────────────────────────────────────────────────────────────────────
describe("truncateAtBlock", () => {
  it("returns text that already fits, trimmed, and never touches it", () => {
    expect(truncateAtBlock("  - one\n- two  ", 900)).toBe("- one\n- two");
    expect(truncateAtBlock("", 900)).toBe("");
  });

  it("cuts on a LIST-ITEM boundary rather than mid-item", () => {
    const text = ["- Filter for a sector where your last role already reads as adjacent",
                  "- Name the two capabilities that transfer without translation",
                  "- Strike anything that needs a paragraph of context to land"].join("\n");
    const out = truncateAtBlock(text, 120);
    // whole items only — the cut never lands inside a bullet
    for (const line of out.split("\n")) expect(text.split("\n")).toContain(line);
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it("cuts on a BLANK-LINE boundary, keeping whole paragraphs", () => {
    const text = "Block one line one.\nBlock one line two.\n\nBlock two opens here and runs on.";
    expect(truncateAtBlock(text, 50)).toBe("Block one line one.\nBlock one line two.");
  });

  it("cuts on a HEADING boundary", () => {
    const text = "## Message One\nHi [NAME], I am making a considered move into [SECTOR].\n## Message Two\nFollowing up on the note below.";
    const out = truncateAtBlock(text, 90);
    expect(out).toBe("## Message One\nHi [NAME], I am making a considered move into [SECTOR].");
  });

  it("NEVER severs a swipe message mid-sentence — the defect this exists for", () => {
    // The observed failure: the trim kept "…making a considered move into [TARGET SECTOR]." and
    // cut the rest of that same message.
    const msg2 = "**Message 2 — the follow-up**\nQuick nudge: I am in the process of making a considered move into [TARGET SECTOR]. Worth fifteen minutes?";
    const text = "**Message 1 — the opener**\nShort opener here.\n\n" + msg2;
    const out = truncateAtBlock(text, text.length - 20);
    // either message 2 survives whole or it is absent — never half of it
    expect(out.includes("[TARGET SECTOR]") ? out.includes("Worth fifteen minutes?") : true).toBe(true);
  });

  it("keeps a fill-in template whole rather than cutting inside its blanks", () => {
    const tpl = "**Template**\n\n\"In my highest-leverage moments the thing I was actually doing was ______\"\n\n**Next**\n\nRun it three times.";
    const out = truncateAtBlock(tpl, 70);
    expect(out.includes("______") ? out.trimEnd().endsWith('"') : true).toBe(true);
  });

  it("falls back to the sentence cut when the content inside the cap has NO block structure", () => {
    const prose = "First sentence here. Second sentence here. Third sentence here. Fourth sentence here.";
    expect(truncateAtBlock(prose, 45)).toBe(truncateAtSentence(prose, 45));
  });

  it("always returns something — it can never empty a field", () => {
    for (const t of ["- only one item that is far longer than the cap allows for", "no blocks at all and no sentence end either"]) {
      expect(truncateAtBlock(t, 10).length).toBeGreaterThan(0);
    }
  });

  it("never returns more than the cap", () => {
    const text = Array.from({ length: 40 }, (_, i) => `- item number ${i} with some trailing words`).join("\n");
    expect(truncateAtBlock(text, 300).length).toBeLessThanOrEqual(300);
  });
});
