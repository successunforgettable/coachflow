import { describe, it, expect } from "vitest";
import { systemPromptFor, userPromptFor, schemaFor, type MagnetContext } from "./leadMagnetContentGenerator";

// Bonuses are POST-PURCHASE deliverables — the reader has already bought/enrolled. The generator was written for
// pre-registration lead magnets, so bonus copy pitched the reader to convert ("Reserve My Spot… next cohort is
// forming now" on kit 191). Bonus mode must write to a buyer on the inside, and produce a howToUse orientation.

const ctx: MagnetContext = {
  niche: "mid-career professionals", title: "The Confidential Pivot Outreach SOP",
  programme: "The Career Pivot Intensive", mainBenefit: "land a new role without a pay cut",
  mechanism: "Map, Bridge, Move", offerDescription: "", icpPains: "", icpGoals: "", icpBarriers: "", sot: "",
  contentBrief: "A ready-to-run SOP for activating your network without tipping off your employer.",
};

describe("generator framing — bonus vs lead_magnet mode", () => {
  it("lead_magnet mode is unchanged: still bridges to the paid programme", () => {
    const sys = systemPromptFor("lead_magnet");
    const user = userPromptFor("toolkit", ctx, "lead_magnet");
    expect(sys.toLowerCase()).toContain("lead-magnet");
    expect(user).toContain("bridges to");
  });

  it("bonus system prompt addresses a reader who has ALREADY purchased/enrolled", () => {
    const sys = systemPromptFor("bonus").toLowerCase();
    expect(sys).toContain("already");
    expect(sys).toMatch(/enrolled|purchased|bought|joined/);
  });

  it("bonus user prompt writes to a buyer and does NOT pitch the sale", () => {
    const user = userPromptFor("toolkit", ctx, "bonus");
    // buyer framing present
    expect(user.toLowerCase()).toMatch(/already (enrolled|purchased|bought|joined)/);
    // the pre-purchase conversion cue must be gone
    expect(user).not.toContain("Book My Free Call");
    expect(user).not.toContain("free win to the paid outcome");
  });

  it("bonus user prompt asks for a howToUse orientation (what it is / how to use / what it achieves)", () => {
    const user = userPromptFor("toolkit", ctx, "bonus").toLowerCase();
    expect(user).toContain("howtouse");
  });

  it("bonus schema requires howToUse; lead_magnet schema does not", () => {
    const bonusSchema: any = schemaFor("toolkit", "bonus").json_schema.schema;
    const lmSchema: any = schemaFor("toolkit", "lead_magnet").json_schema.schema;
    expect(bonusSchema.required).toContain("howToUse");
    expect(bonusSchema.properties.howToUse).toBeDefined();
    expect(lmSchema.required).not.toContain("howToUse");
  });
});
