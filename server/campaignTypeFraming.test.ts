import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { campaignTypeContextFor, lpFramingForCampaign } from "./_core/campaignFraming";

/**
 * Part F of the 2026-09-10 lead-magnet build (docs/handovers/BRIEF_2026-09-10_LEAD_MAGNET_OFFER_MODE.md):
 * the email and WhatsApp generators fell back to COURSE-LAUNCH framing for every type their own maps
 * do not carry. Their four own entries are pinned unchanged in promptPins.test.ts.
 */
describe("F · email and WhatsApp take the shared framing for the types they do not carry", () => {
  it("a lead magnet, a discovery call and an in-person event get the shared framing, not course launch", () => {
    const map = { course_launch: "COURSE-LAUNCH FRAMING" };
    for (const t of ["lead_magnet", "discovery_call", "in_person_event"]) {
      expect(campaignTypeContextFor(map, t)).toBe(lpFramingForCampaign(t));
      expect(campaignTypeContextFor(map, t)).not.toBe("COURSE-LAUNCH FRAMING");
    }
    expect(campaignTypeContextFor(map, "lead_magnet")).toContain("CAMPAIGN TYPE: Free Lead Magnet");
  });

  it("a type the map carries keeps its own entry", () => {
    expect(campaignTypeContextFor({ webinar: "OWN WEBINAR FRAMING" }, "webinar")).toBe("OWN WEBINAR FRAMING");
  });

  it.each(["./emailSequenceGenerator.ts", "./whatsappSequenceGenerator.ts"])("%s calls it, and no longer falls back to course launch", (p) => {
    const s = readFileSync(new URL(p, import.meta.url), "utf8");
    expect(s).toContain("campaignTypeContextFor(campaignTypeContextMap, campaignType)");
    expect(s).not.toContain("|| campaignTypeContextMap['course_launch']");
  });
});
