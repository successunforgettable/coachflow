/**
 * Node 5 receives the coach's METHOD, not the label on it.
 *
 * The lead magnet is the coach's method in miniature — it teaches the "what" while the paid work
 * teaches the personalised "how". Before this change the body generator read one column,
 * `heroMechanisms.mechanismName`, and fell back to an LLM-invented service field. These tests pin
 * the three things that must stay true: the method arrives with substance, no invented method is
 * ever laundered in, and the absence of a method produces silence rather than a fabrication.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMagnetContextBlock,
  renderMethodDetail,
  userPromptFor,
  type MagnetContext,
} from "./leadMagnetContentGenerator";

const ctx = (over: Partial<MagnetContext> = {}): MagnetContext => ({
  niche: "senior managers changing sector",
  title: "The 3 Reasons Senior Directors Get Auto-Rejected",
  programme: "The Career Reinvention Blueprint",
  mainBenefit: "land interviews outside your industry",
  upstream: "",
  hasMethod: false,
  methodDetail: "",
  offerDescription: "",
  icpPains: "",
  icpGoals: "",
  icpBarriers: "",
  sot: "",
  contentBrief: "",
  ...over,
});

describe("buildMagnetContextBlock", () => {
  it("carries the upstream cascade block when one resolved", () => {
    const out = buildMagnetContextBlock(ctx({
      upstream: `Selected hero mechanism: "The Sector Translation Audit". Description: "Most senior professionals fail because their narrative is written in the language of their origin industry.".`,
      hasMethod: true,
    }));
    expect(out).toContain("The Sector Translation Audit");
    expect(out).toContain("language of their origin industry");
  });

  it("names the method exactly once — no duplicate name line beside the description", () => {
    const out = buildMagnetContextBlock(ctx({
      upstream: `Selected hero mechanism: "The Sector Translation Audit". Description: "…".`,
      hasMethod: true,
    }));
    expect(out.match(/The Sector Translation Audit/g)?.length).toBe(1);
    expect(out).not.toContain("The named method behind it");
  });

  it("emits NO method line at all when nothing resolved", () => {
    const out = buildMagnetContextBlock(ctx({ upstream: "", hasMethod: false }));
    expect(out).not.toMatch(/method/i);
    expect(out).not.toContain("the method");
  });

  it("appends coachMethods detail beneath the cascade block when it exists", () => {
    const out = buildMagnetContextBlock(ctx({
      upstream: `Selected hero mechanism: "X". Description: "…".`,
      hasMethod: true,
      methodDetail: "How the method runs, in order: 1) Conditions Audit — the client lists what has to be true.",
    }));
    expect(out).toContain("Conditions Audit");
  });
});

describe("renderMethodDetail — designed for coachMethods, never dependent on it", () => {
  it("returns an empty string for a missing row, so the caller falls through silently", () => {
    expect(renderMethodDetail(null)).toBe("");
    expect(renderMethodDetail(undefined as any)).toBe("");
  });

  it("returns an empty string when the row carries no ordered steps", () => {
    expect(renderMethodDetail({ steps: [], operationalTwist: null, oldVehicle: null, differentiator: null })).toBe("");
  });

  it("renders the steps in order when they exist", () => {
    const out = renderMethodDetail({
      steps: [
        { name: "Conditions Audit", whatHappens: "the client lists what has to be true" },
        { name: "Real-Money Test", whatHappens: "they test it before resigning" },
      ],
      operationalTwist: { kind: "sequence", description: "no talk of what you want until two weeks of evidence exists" },
      oldVehicle: "rewriting the CV again",
      differentiator: null,
    });
    expect(out.indexOf("Conditions Audit")).toBeLessThan(out.indexOf("Real-Money Test"));
    expect(out).toContain("two weeks of evidence");
    expect(out).toContain("rewriting the CV again");
  });

  it("tolerates a malformed row rather than throwing", () => {
    expect(() => renderMethodDetail({ steps: "not-an-array" } as any)).not.toThrow();
    expect(renderMethodDetail({ steps: "not-an-array" } as any)).toBe("");
  });
});

describe("the no-method prompt directive", () => {
  it("tells the model what to DO when no method resolved — positive framing, never a prohibition", () => {
    const p = userPromptFor("guide", ctx({ hasMethod: false }));
    expect(p).toContain("plain descriptive terms");
    // Negative examples prime the shape they forbid (CLAUDE.md §14). No prohibition may appear.
    expect(p).not.toMatch(/do not invent|don't invent|never invent|avoid naming/i);
  });

  it("frames a resolved method as SOURCE MATERIAL to teach from, positively", () => {
    const p = userPromptFor("guide", ctx({ hasMethod: true, upstream: `Selected hero mechanism: "X".` }));
    expect(p).toContain("source material to teach from");
    expect(p).toContain("in your own words");
    // Positive framing only. A prohibition primes the shape it forbids (CLAUDE.md §14).
    expect(p).not.toMatch(/do not copy|don't copy|never copy|do not reuse|avoid copying|not an example/i);
  });

  it("omits the directive when a real method is present", () => {
    const p = userPromptFor("guide", ctx({ hasMethod: true, upstream: `Selected hero mechanism: "X".` }));
    expect(p).not.toContain("plain descriptive terms");
  });
});

describe("the two laundering fallbacks are gone", () => {
  const src = readFileSync(join(__dirname, "leadMagnetContentGenerator.ts"), "utf8");

  it("never reads services.uniqueMechanismSuggestion — Node 4 refuses it as an invention", () => {
    expect(src).not.toContain("uniqueMechanismSuggestion");
  });

  it('never floors the method to the literal string "the method"', () => {
    expect(src).not.toContain('"the method"');
  });

  it("resolves upstream context through the shared cascade helper, not a hand-rolled read", () => {
    expect(src).toContain("getCascadeContext");
    expect(src).toContain("mechanismChars");
  });
});
