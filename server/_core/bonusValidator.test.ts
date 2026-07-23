import { describe, it, expect } from "vitest";
import { validateBonusFabricationPatterns, type RawBonus, type BonusValidationContext } from "./validator";

const ctx: BonusValidationContext = {
  pains: "They spend hours each week manually chasing unpaid invoices and lose track of who owes what.",
  frustrations: "Setting up a CRM feels overwhelming; they never finish onboarding it.",
  objections: "I don't have time to implement another system, and I've been burned by tools before.",
  implementationBarriers: "No technical skill to wire up automations.",
  leadMagnetTitle: "The 5-Step Cashflow Rescue Plan",
};

const clean: RawBonus[] = [
  { bonusType: "accelerator", title: "The 48-Hour Invoice Chase Checklist", description: "A step-by-step checklist to recover overdue invoices in your first two days.", format: "checklist", derivedFromObstacle: "spend hours chasing unpaid invoices", value: null },
  { bonusType: "gap_filler", title: "The 1-Page CRM Onboarding Template", description: "A fill-in template that finishes your CRM setup without technical skill.", format: "template", derivedFromObstacle: "setting up a CRM feels overwhelming", value: null },
  { bonusType: "objection_crusher", title: "The 'No Time to Implement' Script Bank", description: "Ready-to-use scripts that make implementation take minutes, not weeks.", format: "script", derivedFromObstacle: "I don't have time to implement another system", value: null },
];

describe("validateBonusFabricationPatterns", () => {
  it("passes clean, ICP-derived, implementation-heavy bonuses", () => {
    expect(validateBonusFabricationPatterns(clean, ctx).ok).toBe(true);
  });

  it("flags an invented currency figure (value is coach-supplied only)", () => {
    const bad = structuredClone(clean);
    bad[0].description = "A checklist worth £497 that recovers overdue invoices.";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_invented_value")).toBe(true);
  });

  it("flags an invented ROI / case-study claim", () => {
    const bad = structuredClone(clean);
    bad[1].description = "The template a client like John used to turn 12k into 150k.";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_invented_roi_or_casestudy")).toBe(true);
  });

  it("flags an excluded (non-DFY) bonus type — live/community/Q&A", () => {
    const bad = structuredClone(clean);
    bad[2].description = "Access to our private Slack community plus a weekly live Q&A call.";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_excluded_type")).toBe(true);
  });

  it("flags guarantee language leaking into a bonus", () => {
    const bad = structuredClone(clean);
    bad[0].description = "A checklist backed by a 30-day money-back guarantee.";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_guarantee_leak")).toBe(true);
  });

  it("flags a bonus not traceable to any ICP obstacle", () => {
    const bad = structuredClone(clean);
    bad[1].derivedFromObstacle = "";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_missing_obstacle")).toBe(true);
  });

  it("flags a bonus that overlaps/duplicates the selected lead magnet", () => {
    const bad = structuredClone(clean);
    bad[0].title = "The 5-Step Cashflow Rescue Plan Checklist"; // ≈ leadMagnetTitle
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_overlap")).toBe(true);
  });

  it("flags a structurally wrong stack — not exactly one per type", () => {
    const bad = structuredClone(clean);
    bad[2].bonusType = "accelerator"; // now two accelerators, no objection_crusher
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hits.some(h => h.classId === "bonus_structural")).toBe(true);
  });

  it("returns a non-empty failContext for the regeneration retry", () => {
    const bad = structuredClone(clean);
    bad[0].description = "Worth £1,997 today.";
    const r = validateBonusFabricationPatterns(bad, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failContext.length).toBeGreaterThan(20);
  });
});
