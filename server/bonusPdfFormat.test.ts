import { describe, it, expect } from "vitest";
import { bonusFormatToLeadMagnet } from "./bonusPdfGenerator";

describe("bonusFormatToLeadMagnet", () => {
  it("maps checklist + cheatsheet → checklist", () => {
    expect(bonusFormatToLeadMagnet("checklist")).toEqual({ leadMagnetFormat: "checklist" });
    expect(bonusFormatToLeadMagnet("cheatsheet")).toEqual({ leadMagnetFormat: "checklist" });
  });
  it("maps sop/template/script/swipe → toolkit with the matching ToolType", () => {
    expect(bonusFormatToLeadMagnet("sop")).toEqual({ leadMagnetFormat: "toolkit", toolType: "sop" });
    expect(bonusFormatToLeadMagnet("template")).toEqual({ leadMagnetFormat: "toolkit", toolType: "template" });
    expect(bonusFormatToLeadMagnet("script")).toEqual({ leadMagnetFormat: "toolkit", toolType: "script" });
    expect(bonusFormatToLeadMagnet("swipe")).toEqual({ leadMagnetFormat: "toolkit", toolType: "swipe" });
  });
  it("falls back to checklist for anything unexpected", () => {
    expect(bonusFormatToLeadMagnet("weird")).toEqual({ leadMagnetFormat: "checklist" });
  });
});
