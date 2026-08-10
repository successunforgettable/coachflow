/**
 * metaSafety.test.ts — the refusals that stand between step 4c and a live ad account.
 *
 * ⚠️ These are not defensive-programming niceties. `act_1254349025145319` is ACTIVE, bills in
 * AED and carries ~AED 1.17M of lifetime spend across ~200 real campaigns. Each case below
 * pins a mistake that would be unrecoverable: deleting someone else's campaign, quietly
 * removing the orphan evidence, publishing under a name that makes this run indistinguishable
 * from the orphans, or sending a budget Meta rejects part-way through a live run.
 */

import { describe, it, expect } from "vitest";
import {
  PROTECTED_CAMPAIGN_IDS, TRACKED_CAMPAIGN_IDS, KNOWN_ORPHAN_CAMPAIGN_IDS,
  EXPECTED_AUTO_KIT_COUNT, ORPHAN_CAMPAIGN_NAME,
  PINNED_DAILY_BUDGET_AED, MIN_DAILY_BUDGET_AED,
  ProtectedCampaignError, assertDailyBudgetFloor, assertDeletableCampaign,
  assertSafeCampaignName, campaignLabelFor,
} from "./metaSafety";

describe("the protected id list matches what was measured on the account", () => {
  it("protects exactly the five campaigns named Auto Campaign Kit", () => {
    expect(PROTECTED_CAMPAIGN_IDS).toHaveLength(5);
    expect(TRACKED_CAMPAIGN_IDS).toHaveLength(2);
    expect(KNOWN_ORPHAN_CAMPAIGN_IDS).toHaveLength(3);
    expect(EXPECTED_AUTO_KIT_COUNT).toBe(5);
  });

  it("carries the two tracked ids from meta_published_ads", () => {
    expect(PROTECTED_CAMPAIGN_IDS).toContain("120246733556760626");
    expect(PROTECTED_CAMPAIGN_IDS).toContain("120246734574720626");
  });

  it("carries the three pre-existing orphans identified 2026-08-10", () => {
    for (const id of ["120246733286970626", "120246731977370626", "120246731522130626"]) {
      expect(KNOWN_ORPHAN_CAMPAIGN_IDS).toContain(id);
      expect(PROTECTED_CAMPAIGN_IDS).toContain(id);
    }
  });
});

describe("assertDeletableCampaign", () => {
  it("refuses every tracked campaign", () => {
    for (const id of TRACKED_CAMPAIGN_IDS) {
      expect(() => assertDeletableCampaign(id)).toThrow(ProtectedCampaignError);
      expect(() => assertDeletableCampaign(id)).toThrow(/TRACKED published campaign/);
    }
  });

  it("refuses every pre-existing orphan, naming it as one", () => {
    for (const id of KNOWN_ORPHAN_CAMPAIGN_IDS) {
      expect(() => assertDeletableCampaign(id)).toThrow(/PRE-EXISTING ORPHAN/);
    }
  });

  it("refuses an empty or missing id rather than deleting by guesswork", () => {
    for (const bad of ["", "   ", null, undefined]) {
      expect(() => assertDeletableCampaign(bad as any)).toThrow(ProtectedCampaignError);
    }
  });

  it("tolerates surrounding whitespace — a padded id is still the protected id", () => {
    expect(() => assertDeletableCampaign("  120246733286970626  ")).toThrow(ProtectedCampaignError);
  });

  it("ALLOWS an id this run created itself", () => {
    expect(() => assertDeletableCampaign("120999999999999999")).not.toThrow();
  });
});

describe("the budget floor — our z.number().min(1) is currency-unaware", () => {
  it("pins 20, the value proven accepted on this account", () => {
    expect(PINNED_DAILY_BUDGET_AED).toBe(20);
    expect(() => assertDailyBudgetFloor(PINNED_DAILY_BUDGET_AED)).not.toThrow();
  });

  it("REFUSES 1 — the value our own validator would allow and Meta rejects", () => {
    expect(() => assertDailyBudgetFloor(1)).toThrow(/AED/);
    expect(() => assertDailyBudgetFloor(1)).toThrow(/must be more than AED3\.00/);
  });

  it("refuses 3, which is at the floor rather than above it", () => {
    expect(() => assertDailyBudgetFloor(3)).toThrow();
  });

  it("refuses zero — an ad set with no budget is rejected outright", () => {
    expect(() => assertDailyBudgetFloor(0)).toThrow();
  });

  it("accepts the first value at or above the guard", () => {
    expect(() => assertDailyBudgetFloor(MIN_DAILY_BUDGET_AED)).not.toThrow();
  });

  it("refuses a non-finite budget instead of sending NaN to Meta", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => assertDailyBudgetFloor(bad)).toThrow();
    }
  });

  it("converts to the minor units Meta actually receives", () => {
    // createAdSet sends Math.round(dailyBudget * 100).
    expect(Math.round(PINNED_DAILY_BUDGET_AED * 100)).toBe(2000);
    expect(Math.round(1 * 100)).toBe(100); // what the unguarded path would have sent
  });
});

describe("the campaign name", () => {
  it("builds a ZZ-prefixed, timestamped throwaway label", () => {
    const name = campaignLabelFor("2026-08-10T14:23:45.000Z");
    expect(name).toBe("ZZ-4C-MULTIAD-20260810-142345");
    expect(name.startsWith("ZZ-")).toBe(true);
  });

  it("gives two runs different names", () => {
    expect(campaignLabelFor("2026-08-10T14:23:45.000Z"))
      .not.toBe(campaignLabelFor("2026-08-10T15:01:02.000Z"));
  });

  it("REFUSES the orphans' name, in any casing", () => {
    for (const n of [ORPHAN_CAMPAIGN_NAME, "auto campaign kit", "  Auto Campaign Kit  "]) {
      expect(() => assertSafeCampaignName(n)).toThrow(/REFUSING to publish under the name/);
    }
  });

  it("refuses any name that is not marked as a throwaway", () => {
    expect(() => assertSafeCampaignName("Q4 Lead Gen")).toThrow(/must start with "ZZ-"/);
  });
});
