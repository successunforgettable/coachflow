import { describe, it, expect } from "vitest";
import { stripFabricatedLocations, sweepFabricatedLocationsDeep } from "./locationSweep";

describe("locationSweep — deterministic A7 backstop", () => {
  it("replaces a fabricated city the coach never supplied with the venue token", () => {
    expect(stripFabricatedLocations("Join us live in London this November.", "The Brew House, 14 King Street"))
      .toBe("Join us live in [INSERT_EVENT_VENUE] this November.");
  });
  it("catches the harness fixture cities (London/Manchester/Atlanta/Dubai/etc.)", () => {
    for (const c of ["London", "Manchester", "Bristol", "Atlanta", "New York", "Dubai", "Singapore"]) {
      expect(stripFabricatedLocations(`the ${c} event`, "The Brew House")).toBe("the [INSERT_EVENT_VENUE] event");
    }
  });
  it("KEEPS a city the coach actually supplied in their venue", () => {
    // coach's venue names London → "London" is real, must not be stripped
    expect(stripFabricatedLocations("Join us in London.", "The Shard, London Bridge, London"))
      .toBe("Join us in London.");
  });
  it("collapses an adjacent token run (e.g. 'London, England' → one token)", () => {
    expect(stripFabricatedLocations("in London, Manchester today", "The Brew House"))
      .toBe("in [INSERT_EVENT_VENUE] today");
  });
  it("leaves copy with no fabricated city untouched", () => {
    const t = "Reserve your seat at [INSERT_EVENT_VENUE] on August 28, 2026.";
    expect(stripFabricatedLocations(t, null)).toBe(t);
  });
  it("deep-sweeps every string in an LP angle blob, immutably", () => {
    const angle = { headline: "Live in Bristol", faq: [{ q: "Where?", a: "Our Leeds venue" }], price: { amount: "__FREE__" } };
    const out = sweepFabricatedLocationsDeep(angle, "The Brew House") as typeof angle;
    expect(out.headline).toBe("Live in [INSERT_EVENT_VENUE]");
    expect(out.faq[0].a).toBe("Our [INSERT_EVENT_VENUE] venue");
    expect(out.price.amount).toBe("__FREE__"); // sentinels/non-city strings untouched
    expect((angle.headline)).toBe("Live in Bristol"); // original not mutated
  });
});
