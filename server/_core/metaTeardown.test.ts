/**
 * metaTeardown.test.ts — deleting 4c's own campaign, and provably nothing else.
 *
 * ⚠️ NO META CALL IS POSSIBLE HERE. Every Graph function is a fake, and the assertions are
 * about which calls would have been made and with what. That is the point: the four rules that
 * keep a live, million-dirham ad account safe are proven before anything is pointed at it.
 *
 * The two that matter most are both about NOT deleting:
 *   · a protected id is refused BEFORE any call goes out, so a wrong id cannot reach Meta;
 *   · the three pre-existing orphans are proven still present afterwards, so the run cannot
 *     quietly "tidy" the evidence for a question that has not been decided.
 */

import { describe, it, expect, vi } from "vitest";
import { teardownRecordedCampaign, readBackPublishedSet } from "./metaTeardown";
import { KNOWN_ORPHAN_CAMPAIGN_IDS, TRACKED_CAMPAIGN_IDS, ProtectedCampaignError } from "./metaSafety";

const AUTO_KIT = "Auto Campaign Kit";
const OURS = "120999999999999999";

/** The account as it stands today: five Auto Campaign Kit rows plus unrelated real campaigns. */
function accountCampaigns(extra: Array<{ id: string; name: string }> = []) {
  return [
    ...TRACKED_CAMPAIGN_IDS.map((id) => ({ id, name: AUTO_KIT })),
    ...KNOWN_ORPHAN_CAMPAIGN_IDS.map((id) => ({ id, name: AUTO_KIT })),
    { id: "120210859131180626", name: "Highticket - 31st Aug" },
    ...extra,
  ];
}

function deps(over: any = {}) {
  return {
    deleteCampaign: vi.fn(async () => true),
    getCampaignById: vi.fn(async () => ({ id: OURS, status: "DELETED" })),
    getAdById: vi.fn(async () => null),
    listCampaigns: vi.fn(async () => accountCampaigns()),
    ...over,
  };
}

describe("the refusal fires BEFORE anything is called", () => {
  it("refuses each of the three pre-existing orphans without calling Meta", async () => {
    for (const id of KNOWN_ORPHAN_CAMPAIGN_IDS) {
      const d = deps();
      await expect(teardownRecordedCampaign(d, { userId: 1, campaignId: id, adIds: [] }))
        .rejects.toThrow(ProtectedCampaignError);
      expect(d.deleteCampaign).not.toHaveBeenCalled();
      expect(d.getCampaignById).not.toHaveBeenCalled();
    }
  });

  it("refuses each tracked published campaign without calling Meta", async () => {
    for (const id of TRACKED_CAMPAIGN_IDS) {
      const d = deps();
      await expect(teardownRecordedCampaign(d, { userId: 1, campaignId: id, adIds: [] }))
        .rejects.toThrow(ProtectedCampaignError);
      expect(d.deleteCampaign).not.toHaveBeenCalled();
    }
  });

  it("refuses when the ledger recorded no campaign at all", async () => {
    const d = deps();
    await expect(teardownRecordedCampaign(d, { userId: 1, campaignId: null, adIds: [] }))
      .rejects.toThrow(ProtectedCampaignError);
    expect(d.deleteCampaign).not.toHaveBeenCalled();
  });
});

describe("it deletes exactly the recorded id, and confirms BY ID", () => {
  it("deletes only that campaign and never searches by name", async () => {
    const d = deps();
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: ["a1", "a2"] });
    expect(d.deleteCampaign).toHaveBeenCalledTimes(1);
    expect(d.deleteCampaign).toHaveBeenCalledWith(1, OURS);
    expect(out.ok).toBe(true);
    expect(out.confirmedStatus).toBe("DELETED");
  });

  it("accepts Meta's SOFT delete — the id stays readable as DELETED", async () => {
    const d = deps({ getCampaignById: vi.fn(async () => ({ id: OURS, status: "DELETED" })) });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.ok).toBe(true);
  });

  it("accepts a campaign that reads back gone", async () => {
    const d = deps({ getCampaignById: vi.fn(async () => null) });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.confirmedStatus).toBe("gone");
    expect(out.ok).toBe(true);
  });

  it("FAILS when the campaign is still live after the delete", async () => {
    const d = deps({ getCampaignById: vi.fn(async () => ({ id: OURS, status: "PAUSED" })) });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.ok).toBe(false);
    expect(out.problems.join(" ")).toMatch(/still reads back as PAUSED/);
  });

  it("checks every recorded ad by id and fails if one survives", async () => {
    const d = deps({
      getAdById: vi.fn(async (_u: number, id: string) => (id === "a2" ? { id, status: "PAUSED" } : null)),
    });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: ["a1", "a2"] });
    expect(d.getAdById).toHaveBeenCalledTimes(2);
    expect(out.ads.find((a) => a.id === "a1")!.confirmedGone).toBe(true);
    expect(out.ads.find((a) => a.id === "a2")!.confirmedGone).toBe(false);
    expect(out.ok).toBe(false);
  });

  it("reports a delete that returned false", async () => {
    const d = deps({ deleteCampaign: vi.fn(async () => false), getCampaignById: vi.fn(async () => null) });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.problems.join(" ")).toMatch(/deleteCampaign returned false/);
    expect(out.ok).toBe(false);
  });
});

describe("the orphans must be exactly as we found them", () => {
  it("passes when all five Auto Campaign Kit rows survive", async () => {
    const out = await teardownRecordedCampaign(deps(), { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.orphanCheck.autoKitCount).toBe(5);
    expect(out.orphanCheck.countUnchanged).toBe(true);
    expect(out.orphanCheck.allOrphansIntact).toBe(true);
    expect(out.orphanCheck.orphansMissing).toEqual([]);
  });

  it("FAILS loudly if one of the three orphans has disappeared", async () => {
    const survivors = accountCampaigns().filter((c) => c.id !== KNOWN_ORPHAN_CAMPAIGN_IDS[0]);
    const d = deps({ listCampaigns: vi.fn(async () => survivors) });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.ok).toBe(false);
    expect(out.orphanCheck.orphansMissing).toEqual([KNOWN_ORPHAN_CAMPAIGN_IDS[0]]);
    expect(out.problems.join(" ")).toMatch(/orphan\(s\) MISSING/);
  });

  it("FAILS if the run ADDED a sixth Auto Campaign Kit campaign", async () => {
    const d = deps({
      listCampaigns: vi.fn(async () => accountCampaigns([{ id: "120888888888888888", name: AUTO_KIT }])),
    });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.ok).toBe(false);
    expect(out.orphanCheck.autoKitCount).toBe(6);
    expect(out.problems.join(" ")).toMatch(/changed the pre-existing discrepancy/);
  });

  it("does not count a similarly-named campaign as one of the five", async () => {
    const d = deps({
      listCampaigns: vi.fn(async () => accountCampaigns([{ id: "120777777777777777", name: "Auto Campaign Kit v2" }])),
    });
    const out = await teardownRecordedCampaign(d, { userId: 1, campaignId: OURS, adIds: [] });
    expect(out.orphanCheck.autoKitCount).toBe(5);
    expect(out.ok).toBe(true);
  });
});

describe("the read-back proof — Meta's stored state, not our request", () => {
  const expected = [
    { adId: "a1", creativeId: "cr1", headline: "H1", body: "B1" },
    { adId: "a2", creativeId: "cr2", headline: "H2", body: "B2" },
    { adId: "a3", creativeId: "cr3", headline: "H3", body: "B3" },
  ];

  function rbDeps(over: any = {}) {
    return {
      getCampaignById: vi.fn(async () => ({ id: "c1", status: "PAUSED" })),
      getAdSetById: vi.fn(async () => ({ id: "s1", status: "PAUSED", campaign_id: "c1", daily_budget: "2000" })),
      getAdById: vi.fn(async (_u: number, id: string) => ({ id, status: "PAUSED", adset_id: "s1" })),
      getAdCreativeById: vi.fn(async (_u: number, id: string) => ({
        id, effectiveTitle: `H${id.slice(-1)}`, effectiveBody: `B${id.slice(-1)}`,
      })),
      ...over,
    };
  }

  it("PASSES when all three ads share one ad set, everything is paused and the copy matches", async () => {
    const out = await readBackPublishedSet(rbDeps(), { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.allShareOneAdSet).toBe(true);
    expect(out.sharedAdSetId).toBe("s1");
    expect(out.adSetBelongsToCampaign).toBe(true);
    expect(out.allPaused).toBe(true);
    expect(out.dailyBudgetMinorUnits).toBe("2000");
    expect(out.ok).toBe(true);
  });

  it("🔑 FAILS when the ads landed in DIFFERENT ad sets — the claim 4c exists to prove", async () => {
    const d = rbDeps({
      getAdById: vi.fn(async (_u: number, id: string) => ({ id, status: "PAUSED", adset_id: id === "a3" ? "s2" : "s1" })),
    });
    const out = await readBackPublishedSet(d, { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.allShareOneAdSet).toBe(false);
    expect(out.ok).toBe(false);
    expect(out.problems.join(" ")).toMatch(/do NOT share one ad set/);
  });

  it("FAILS when anything came back ACTIVE rather than PAUSED", async () => {
    const d = rbDeps({ getAdSetById: vi.fn(async () => ({ id: "s1", status: "ACTIVE", campaign_id: "c1", daily_budget: "2000" })) });
    const out = await readBackPublishedSet(d, { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.allPaused).toBe(false);
    expect(out.ok).toBe(false);
  });

  it("FAILS when the ad set belongs to a different campaign", async () => {
    const d = rbDeps({ getAdSetById: vi.fn(async () => ({ id: "s1", status: "PAUSED", campaign_id: "OTHER", daily_budget: "2000" })) });
    const out = await readBackPublishedSet(d, { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.adSetBelongsToCampaign).toBe(false);
    expect(out.ok).toBe(false);
  });

  it("FAILS when Meta stored copy other than the assembled rows", async () => {
    const d = rbDeps({
      getAdCreativeById: vi.fn(async (_u: number, id: string) => ({ id, effectiveTitle: "something else", effectiveBody: "B1" })),
    });
    const out = await readBackPublishedSet(d, { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.ok).toBe(false);
    expect(out.copyMatches.every((c) => c.titleOk)).toBe(false);
    expect(out.problems.join(" ")).toMatch(/headline differs from the assembled row/);
  });

  it("treats an unreadable ad as a failure rather than a pass", async () => {
    const d = rbDeps({ getAdById: vi.fn(async () => null) });
    const out = await readBackPublishedSet(d, { userId: 1, campaignId: "c1", adSetId: "s1", expected });
    expect(out.ok).toBe(false);
    expect(out.allShareOneAdSet).toBe(false);
  });
});
