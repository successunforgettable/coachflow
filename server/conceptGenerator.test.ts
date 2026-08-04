import { describe, it, expect } from "vitest";
import { buildConceptPrompt, type ConceptIcpInput } from "./conceptGenerator";

const icp: ConceptIcpInput = {
  name: "Mid-career professionals stuck in a misaligned job",
  pains: "• Every Sunday the 6pm dread arrives",
  goals: "• Land a pivot in 90 days without a pay cut",
  fears: "• I lie awake worrying I left it too late",
  objections: "• I don't have time right now",
  buyingTriggers: "• The Tuesday meeting where I thought: I cannot do this for 10 more years",
};

describe("buildConceptPrompt — one person, many angles (Desire × Awareness)", () => {
  it("asks for the requested number of concepts", () => {
    expect(buildConceptPrompt(icp, 8)).toContain("8");
  });

  // REWRITTEN 2026-08-04. The previous version asserted the prompt merely CONTAINED all 5 stage
  // names, and it kept passing after the batch became cold-weighted — because `most_aware` still
  // appears in the hook→awareness guidance block regardless of the batch distribution. It was
  // passing for the wrong reason and would not have caught a regression in the distribution.
  it("assigns a stage to every concept slot rather than letting the model choose", () => {
    const p = buildConceptPrompt(icp, 8);
    expect(p).toContain("ASSIGNED PER CONCEPT, NOT CHOSEN");
    for (let i = 1; i <= 8; i++) {
      expect(p).toMatch(new RegExp(`Concept ${i}: (unaware|problem_aware|solution_aware|product_aware)`));
    }
  });

  it("weights the batch toward the three cold stages and allocates no most_aware slot", () => {
    const p = buildConceptPrompt(icp, 8);
    const slots = [...p.matchAll(/ {2}- Concept \d+: (\w+)/g)].map((m) => m[1]);
    expect(slots).toHaveLength(8);
    // prospecting-research allocation: 3 / 3 / 1 / 1 / 0.
    expect(slots.filter((s) => s === "unaware")).toHaveLength(3);
    expect(slots.filter((s) => s === "problem_aware")).toHaveLength(3);
    expect(slots.filter((s) => s === "solution_aware")).toHaveLength(1);
    expect(slots.filter((s) => s === "product_aware")).toHaveLength(1);
    expect(slots.filter((s) => s === "most_aware")).toHaveLength(0);
  });

  // Register change 2026-07-27: the social-proof hook needs a real client account to
  // carry it, so it is offered only when the coach's client material is on the record.
  // A launch-stage coach gets the remaining patterns — the prompt never asks them for a
  // client they do not have. Both branches are asserted.
  it("lists all 7 hook patterns when the coach has supplied real client material", () => {
    const p = buildConceptPrompt(icp, 8, true);
    for (const hp of [
      "problem_first",
      "founder_authenticity",
      "social_proof",
      "aspirational_transformation",
      "meme_humor",
      "data_chart",
      "direct_offer_urgency",
    ]) {
      expect(p).toContain(hp);
    }
  });

  it("withholds the proof-dependent hooks when no real client material is supplied", () => {
    const p = buildConceptPrompt(icp, 8, false);
    for (const hp of [
      "problem_first",
      "founder_authenticity",
      "aspirational_transformation",
      "meme_humor",
      "direct_offer_urgency",
    ]) {
      expect(p).toContain(hp);
    }
    // Named only in the line explaining why they are absent, never in the usable set.
    expect(p).not.toContain("hookPattern: social_proof");
    expect(p).not.toContain("hookPattern: data_chart");
    expect(p).toContain("proof is not on the record");
  });

  it("defaults to the launch-stage (first-person) branch", () => {
    expect(buildConceptPrompt(icp, 8)).toBe(buildConceptPrompt(icp, 8, false));
  });

  it("feeds the ICP's real material (persona is fixed to this ICP)", () => {
    const p = buildConceptPrompt(icp, 8);
    expect(p).toContain("Every Sunday the 6pm dread arrives");
    expect(p).toContain("Land a pivot in 90 days");
  });

  it("instructs the two structural rules the validator enforces (distinct axis, headline≠hook)", () => {
    const p = buildConceptPrompt(icp, 8).toLowerCase();
    expect(p).toContain("desire"); // vary desire × awareness
    expect(p).toContain("awareness");
    expect(p).toMatch(/headline/); // headline must differ from hook
  });
});
