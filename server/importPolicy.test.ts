import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dealChipsFor, zeroCardChipsFor, IMPORT_CHIP, IMPORT_FORMS, buildImportPayload } from "../client/src/v2/importPolicy";

/**
 * SKIP, MADE HONEST (Arfeen decision 5, 2026-09-27).
 *   Offer, Unique Method, Lead Magnet: "I already have this — use mine" asks for the coach's own version and imports it.
 *   Headlines, Ad Copy, Landing Page: no Skip at all — Meta push needs them.
 */

describe("which nodes offer what", () => {
  for (const step of ["offer", "mechanism", "hvco"]) {
    it(`${step}: options or import-mine, never a bare skip`, () => {
      expect(dealChipsFor(step)).toEqual(["Show me options", IMPORT_CHIP]);
      expect(zeroCardChipsFor(step)).toEqual(["Try again", IMPORT_CHIP]);
    });
  }
  for (const step of ["headlines", "adCopy", "landingPage"]) {
    it(`${step}: no skip and no import`, () => {
      expect(dealChipsFor(step)).toEqual(["Show me options"]);
      expect(zeroCardChipsFor(step)).toEqual(["Try again"]);
    });
  }
  it("the import chip says what it does", () => expect(IMPORT_CHIP).toBe("I already have this — use mine"));
});

describe("the import form → the importAssets payload", () => {
  it("offer: name + what it gives them, CTA defaults to Book a Free Call", () => {
    const r = buildImportPayload("offer", { name: " The 90-Day Pivot ", valueProposition: "A new role in 90 days, without a pay cut.", cta: "" });
    expect(r).toEqual({ ok: true, payload: { offer: { name: "The 90-Day Pivot", valueProposition: "A new role in 90 days, without a pay cut.", cta: "Book a Free Call" } } });
  });
  it("method: name + how it works", () => {
    const r = buildImportPayload("mechanism", { name: "Translation Method", description: "Re-codes your last ten years into the target role's words." });
    expect(r).toEqual({ ok: true, payload: { mechanism: { name: "Translation Method", description: "Re-codes your last ten years into the target role's words." } } });
  });
  it("lead magnet: title + what it covers", () => {
    const r = buildImportPayload("hvco", { title: "The CV Rewrite Checklist", topic: "A one-page checklist for rewriting your CV for a new sector." });
    expect(r).toEqual({ ok: true, payload: { hvco: { title: "The CV Rewrite Checklist", topic: "A one-page checklist for rewriting your CV for a new sector." } } });
  });
  it("a required field left blank is refused with a plain message naming it", () => {
    const r = buildImportPayload("mechanism", { name: "Translation Method", description: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/how it works/i);
  });
  it("over-long text is refused, never silently cut", () => {
    const r = buildImportPayload("hvco", { title: "x".repeat(501), topic: "fine topic text here" });
    expect(r.ok).toBe(false);
  });
  it("a node with no import form is refused", () => {
    expect(buildImportPayload("headlines", {}).ok).toBe(false);
  });
  it("every importable step has a form with at least one required field", () => {
    for (const step of ["offer", "mechanism", "hvco"]) {
      expect(IMPORT_FORMS[step].fields.some((f) => f.required)).toBe(true);
    }
  });
});

describe("the Trail uses the policy (§15d)", () => {
  const trail = readFileSync(join(__dirname, "..", "client", "src", "v2", "V2Trail.tsx"), "utf8");
  it("no bare 'Skip — I already have this' chip survives", () => {
    expect(trail).not.toMatch(/"Skip — I already have this"/);
  });
  it("the chips come from the policy, and the import path imports and marks the stop imported", () => {
    expect(trail).toMatch(/dealChipsFor\(stepDef\.step\)/);
    expect(trail).toMatch(/zeroCardChipsFor\(stepDef\.step\)/);
    expect(trail).toMatch(/autoMode\.importAssets/);
    expect(trail).toMatch(/markImportedMutation\.mutateAsync/);
  });
  it("the Trail no longer records a skip that imports nothing", () => {
    expect(trail).not.toMatch(/skipNodeMutation\.mutateAsync/);
  });
});
