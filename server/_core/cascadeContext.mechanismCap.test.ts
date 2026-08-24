/**
 * The mechanism cap is a per-call-site decision, not a global constant.
 *
 * Node 5 is the one node whose CONTENT is the coach's method — it teaches the method in
 * miniature — so it needs more of the description than the five nodes that merely reference it.
 * These tests pin that the default is unchanged for every existing caller and that the wider
 * cap is genuinely reachable.
 *
 * `describeMechanismText` is pure and exported for the same reason `truncateAtSentence` is:
 * so the test exercises the real function rather than a copy of it.
 */
import { describe, it, expect } from "vitest";
import { describeMechanismText, MECHANISM_CHARS_DEFAULT } from "./cascadeContext";

const sentence = (n: number) => `Sentence number ${n} carries enough words to matter here. `;
const longDescription = Array.from({ length: 40 }, (_, i) => sentence(i + 1)).join("");

const base = {
  mechanismName: "The Sector Translation Audit",
  mechanismDescription: longDescription,
  descriptor: null as string | null,
  sourceTier: null as string | null,
};

describe("describeMechanismText", () => {
  it("defaults to 900 chars — the five downstream nodes are byte-unchanged", () => {
    expect(MECHANISM_CHARS_DEFAULT).toBe(900);
    const a = describeMechanismText(base);
    const b = describeMechanismText(base, MECHANISM_CHARS_DEFAULT);
    expect(a).toBe(b);
  });

  it("carries materially more of the description at the Node 5 cap of 1600", () => {
    const narrow = describeMechanismText(base, 900);
    const wide = describeMechanismText(base, 1600);
    expect(wide.length).toBeGreaterThan(narrow.length);
    // The wide cap must carry at least 500 more characters, not merely one more sentence.
    expect(wide.length - narrow.length).toBeGreaterThan(500);
    expect(wide.startsWith(`Selected hero mechanism: "The Sector Translation Audit".`)).toBe(true);
  });

  it("never exceeds the cap it was given", () => {
    for (const cap of [200, 900, 1600]) {
      const out = describeMechanismText(base, cap);
      const described = out.slice(out.indexOf('Description: "') + 'Description: "'.length, out.lastIndexOf('".'));
      expect(described.length).toBeLessThanOrEqual(cap);
    }
  });

  it("carries the descriptor when present and skips a placeholder one", () => {
    expect(describeMechanismText({ ...base, descriptor: "Protocol" })).toContain("Type: Protocol.");
    expect(describeMechanismText({ ...base, descriptor: "[INSERT_TYPE]" })).not.toContain("Type:");
  });

  it("carries the guarded_fallback caveat, and only for guarded_fallback", () => {
    expect(describeMechanismText({ ...base, sourceTier: "guarded_fallback" }))
      .toContain("rather than described by the");
    for (const tier of [null, "coach_stated", "extracted"]) {
      expect(describeMechanismText({ ...base, sourceTier: tier })).not.toContain("rather than described by the");
    }
  });

  it("survives an empty description without inventing anything", () => {
    const out = describeMechanismText({ ...base, mechanismDescription: "" });
    expect(out).toContain("The Sector Translation Audit");
    expect(out).not.toContain("undefined");
  });
});
