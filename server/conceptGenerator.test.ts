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

  it("spans all 5 Schwartz awareness stages", () => {
    const p = buildConceptPrompt(icp, 8);
    for (const stage of ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"]) {
      expect(p).toContain(stage);
    }
  });

  it("lists all 6 hook patterns", () => {
    const p = buildConceptPrompt(icp, 8);
    for (const hp of [
      "problem_first",
      "founder_authenticity",
      "social_proof",
      "aspirational_transformation",
      "meme_humor",
      "data_chart",
    ]) {
      expect(p).toContain(hp);
    }
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
