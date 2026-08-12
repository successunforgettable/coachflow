/**
 * multiAdPublish.test.ts — N ads into ONE campaign and ONE ad set.
 *
 * ⚠️ NO META CALL IS POSSIBLE HERE. Every Graph function is injected as a fake, and the
 * assertions are about the CALLS that would have been made — how many, in what order, and
 * with which ad set id. That is the point of the injected shape: the ordering that keeps a
 * real ad account clean can be proven before anything is ever pointed at Meta. Step 4c, the
 * live push, is held for its own authorisation and is not exercised by this suite.
 *
 * The properties worth the most here are about NOT creating things:
 *   · a fully-blocked push creates NOTHING — not even an empty campaign shell, which is the
 *     shape of the orphans already sitting on the real account;
 *   · a push screened down BELOW THE TWO-AD FLOOR creates nothing either — one ad shares an ad
 *     set with nothing, so a single survivor refuses on the same terms as zero;
 *   · a failure part-way through KEEPS what already landed, because tearing down would
 *     destroy good ads to tidy up a bad one.
 *
 * ⚠️ Several cases below use two ads where one would read more simply. That is the floor, not
 * padding: a one-ad push now refuses before any Graph call, so a single-ad fixture would prove
 * the opposite of what its case is about.
 */

import { describe, it, expect, vi } from "vitest";
import { publishAssembledAds, MIN_ADS, type MetaWriteDeps, type PublishableAd } from "./multiAdPublish";

const ad = (n: number): PublishableAd => ({
  conceptId: n,
  headline: `headline ${n}`,
  body: `body ${n}`,
  headlineAdCopyId: 1000 + n,
  bodyAdCopyId: 2000 + n,
  imageUrl: `https://img/${n}.png`,
});

function fakeDeps(over: Partial<MetaWriteDeps> = {}) {
  const calls = { campaign: [] as any[], adSet: [] as any[], creative: [] as any[], ad: [] as any[] };
  const deps: MetaWriteDeps = {
    createCampaign: vi.fn(async (_u, p) => { calls.campaign.push(p); return { id: "camp-1" }; }),
    createAdSet: vi.fn(async (_u, p) => { calls.adSet.push(p); return { id: "adset-1" }; }),
    createAdCreative: vi.fn(async (_u, p) => { calls.creative.push(p); return { id: `cr-${calls.creative.length}` }; }),
    createAd: vi.fn(async (_u, p) => { calls.ad.push(p); return { id: `ad-${calls.ad.length}` }; }),
    ...over,
  };
  return { deps, calls };
}

const base = {
  userId: 1, campaignName: "ZZ-TEST", objective: "OUTCOME_LEADS",
  linkUrl: "https://example.com/p/1", status: "PAUSED" as const, dailyBudget: 20,
  screen: async () => ({ blocked: false, classes: [] }),
};

describe("one campaign, one ad set", () => {
  it("creates the campaign ONCE and the ad set ONCE for three ads", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2), ad(3)] });
    expect(deps.createCampaign).toHaveBeenCalledTimes(1);
    expect(deps.createAdSet).toHaveBeenCalledTimes(1);
    expect(deps.createAdCreative).toHaveBeenCalledTimes(3);
    expect(deps.createAd).toHaveBeenCalledTimes(3);
    expect(out.published).toHaveLength(3);
  });

  it("puts EVERY ad into the same ad set — the whole point of the capability", async () => {
    const { deps, calls } = fakeDeps();
    await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2), ad(3)] });
    expect(new Set(calls.ad.map((c) => c.adSetId))).toEqual(new Set(["adset-1"]));
  });

  it("applies the requested status to campaign, ad set AND every ad", async () => {
    const { deps, calls } = fakeDeps();
    await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(calls.campaign[0].status).toBe("PAUSED");
    expect(calls.adSet[0].status).toBe("PAUSED");
    expect(calls.ad.every((c) => c.status === "PAUSED")).toBe(true);
  });

  it("keeps the budget on the ad set, never on the campaign (CBO would override bid strategy)", async () => {
    const { deps, calls } = fakeDeps();
    await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(calls.adSet[0].dailyBudget).toBe(20);
    expect(calls.campaign[0].dailyBudget).toBeUndefined();
  });

  it("gives each ad its OWN creative, carrying its own headline, body and picture", async () => {
    const { deps, calls } = fakeDeps();
    await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(calls.creative.map((c) => c.headline)).toEqual(["headline 1", "headline 2"]);
    expect(calls.creative.map((c) => c.body)).toEqual(["body 1", "body 2"]);
    expect(calls.creative.map((c) => c.imageUrl)).toEqual(["https://img/1.png", "https://img/2.png"]);
  });

  it("returns the provenance ids for each published ad so the caller can persist them", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(out.published.map((p) => [p.conceptId, p.headlineAdCopyId, p.bodyAdCopyId]))
      .toEqual([[1, 1001, 2001], [2, 1002, 2002]]);
    expect(out.campaignId).toBe("camp-1");
    expect(out.adSetId).toBe("adset-1");
  });
});

describe("screening happens BEFORE anything is created", () => {
  it("screens every ad before the first Graph write", async () => {
    const order: string[] = [];
    const { deps } = fakeDeps({
      createCampaign: vi.fn(async () => { order.push("campaign"); return { id: "camp-1" }; }),
    });
    await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2)],
      screen: async (a) => { order.push(`screen-${a.conceptId}`); return { blocked: false, classes: [] }; },
    });
    expect(order).toEqual(["screen-1", "screen-2", "campaign"]);
  });

  it("creates NOTHING when every ad is blocked — no empty campaign shell is left behind", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2)],
      screen: async () => ({ blocked: true, classes: ["second_person_protected_attribute"] }),
    });
    expect(deps.createCampaign).not.toHaveBeenCalled();
    expect(deps.createAdSet).not.toHaveBeenCalled();
    expect(out.campaignId).toBeNull();
    expect(out.refusedReason).toContain("no campaign, ad set, creative or ad was created");
    expect(out.blocked.map((b) => b.classes[0])).toEqual([
      "second_person_protected_attribute", "second_person_protected_attribute",
    ]);
  });

  it("publishes the survivors and reports the blocked ones by index", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2), ad(3)],
      screen: async (a) => a.conceptId === 2
        ? { blocked: true, classes: ["invented_testimonial"] }
        : { blocked: false, classes: [] },
    });
    expect(out.published.map((p) => p.conceptId)).toEqual([1, 3]);
    expect(out.blocked).toEqual([{ index: 1, conceptId: 2, classes: ["invented_testimonial"] }]);
    expect(deps.createAd).toHaveBeenCalledTimes(2);
  });

  it("FAILS CLOSED — a screen that throws blocks that ad rather than passing it", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2)],
      screen: async () => { throw new Error("gate unavailable"); },
    });
    expect(out.published).toEqual([]);
    expect(out.blocked[0].classes).toEqual(["screen_threw"]);
    expect(deps.createCampaign).not.toHaveBeenCalled();
  });

  it("refuses an empty set without calling anything", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, { ...base, ads: [] });
    expect(out.refusedReason).toContain("no assembled ads");
    expect(deps.createCampaign).not.toHaveBeenCalled();
  });
});

describe("partial failure keeps what landed", () => {
  it("keeps the ads that succeeded when one creative call fails", async () => {
    let n = 0;
    const { deps } = fakeDeps({
      createAdCreative: vi.fn(async () => {
        n += 1;
        if (n === 2) throw new Error("Failed to create Meta ad creative");
        return { id: `cr-${n}` };
      }),
    });
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2), ad(3)] });
    expect(out.published.map((p) => p.conceptId)).toEqual([1, 3]);
    expect(out.failed).toEqual([
      { index: 1, conceptId: 2, stage: "creative", message: "Failed to create Meta ad creative" },
    ]);
    expect(out.campaignId).toBe("camp-1");
  });

  it("records the stage as `ad` when the creative landed but the ad did not", async () => {
    const { deps } = fakeDeps({ createAd: vi.fn(async () => null) });
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(out.published).toEqual([]);
    expect(out.failed[0].stage).toBe("ad");
    expect(out.adSetId).toBe("adset-1");
  });

  it("stops and reports when the campaign itself cannot be created", async () => {
    const { deps } = fakeDeps({ createCampaign: vi.fn(async () => null) });
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(out.refusedReason).toBe("Failed to create Meta campaign");
    expect(deps.createAdSet).not.toHaveBeenCalled();
  });

  it("surfaces the empty campaign plainly when the ad set cannot be created", async () => {
    const { deps } = fakeDeps({ createAdSet: vi.fn(async () => null) });
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(out.campaignId).toBe("camp-1");
    expect(out.adSetId).toBeNull();
    expect(out.refusedReason).toContain("is empty");
    expect(deps.createAdCreative).not.toHaveBeenCalled();
  });
});

/**
 * THE FLOOR. One ad shares an ad set with nothing, so a single survivor is a FAILED multi-ad
 * push, not a reduced one — and it must refuse on the same terms as zero survivors. These cases
 * pin the floor at all three points a count exists, and the load-bearing assertion in every
 * refusal case is the same one: `createCampaign` was never called, so Meta holds nothing.
 */
describe("the two-ad floor", () => {
  it("MIN_ADS is two — the number the three points share", () => {
    expect(MIN_ADS).toBe(2);
  });

  it("POINT ONE — one assembled ad in refuses before screening anything", async () => {
    const screen = vi.fn(async () => ({ blocked: false, classes: [] }));
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1)], screen });
    expect(out.refusedReason).toContain("at least 2 are");
    expect(out.campaignId).toBeNull();
    expect(screen).not.toHaveBeenCalled();
    expect(deps.createCampaign).not.toHaveBeenCalled();
  });

  it("POINT TWO — three ads screened down to ONE survivor create NOTHING on Meta", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2), ad(3)],
      // Only concept 1 comes through; 2 and 3 are blocked by the gate.
      screen: async (a) => a.conceptId === 1
        ? { blocked: false, classes: [] }
        : { blocked: true, classes: ["invented_testimonial"] },
    });
    // Not one Graph write of any kind — no campaign shell, no ad set, no creative, no ad.
    expect(deps.createCampaign).not.toHaveBeenCalled();
    expect(deps.createAdSet).not.toHaveBeenCalled();
    expect(deps.createAdCreative).not.toHaveBeenCalled();
    expect(deps.createAd).not.toHaveBeenCalled();
    expect(out.campaignId).toBeNull();
    expect(out.adSetId).toBeNull();
    expect(out.published).toEqual([]);
    // It refuses, and it says WHY — one survivor out of three, not a bare failure.
    expect(out.refusedReason).toContain("only 1 of 3");
    expect(out.refusedReason).toContain("no campaign, ad set, creative or ad was created");
    // The lone survivor is still reported as blocked-context, not silently dropped:
    expect(out.blocked.map((b) => b.conceptId)).toEqual([2, 3]);
  });

  it("POINT TWO — TWO survivors still proceed and publish normally", async () => {
    const { deps, calls } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2), ad(3)],
      // Exactly at the floor: concepts 1 and 2 survive, 3 is blocked.
      screen: async (a) => a.conceptId === 3
        ? { blocked: true, classes: ["invented_testimonial"] }
        : { blocked: false, classes: [] },
    });
    expect(out.refusedReason).toBeNull();
    expect(deps.createCampaign).toHaveBeenCalledTimes(1);
    expect(deps.createAdSet).toHaveBeenCalledTimes(1);
    expect(out.published.map((p) => p.conceptId)).toEqual([1, 2]);
    expect(new Set(calls.ad.map((c) => c.adSetId))).toEqual(new Set(["adset-1"]));
    expect(out.belowFloor).toBeNull();
  });

  it("POINT THREE — a campaign left under the floor by Graph failures is REPORTED, not hidden", async () => {
    // Both ads survive screening, so the campaign is legitimately created; then one of the two
    // ad calls fails at Meta. Nothing is un-created — that would destroy the good ad — but the
    // result says plainly that the campaign is below the floor and needs deliberate teardown.
    let n = 0;
    const { deps } = fakeDeps({
      createAd: vi.fn(async (_u, p) => { n += 1; return n === 1 ? { id: "ad-1" } : null; }),
    });
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2)] });
    expect(out.campaignId).toBe("camp-1");
    expect(out.published).toHaveLength(1);
    expect(out.refusedReason).toBeNull();
    expect(out.belowFloor).toContain("1 of 2");
    expect(out.belowFloor).toContain("tearing down");
  });

  it("POINT THREE stays null on a push that met the floor", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, { ...base, ads: [ad(1), ad(2), ad(3)] });
    expect(out.published).toHaveLength(3);
    expect(out.belowFloor).toBeNull();
  });

  it("a refusal before creation leaves belowFloor null — refusedReason already carries it", async () => {
    const { deps } = fakeDeps();
    const out = await publishAssembledAds(deps, {
      ...base, ads: [ad(1), ad(2)],
      screen: async (a) => a.conceptId === 2
        ? { blocked: true, classes: ["invented_testimonial"] }
        : { blocked: false, classes: [] },
    });
    expect(out.refusedReason).toContain("only 1 of 2");
    expect(out.belowFloor).toBeNull();
  });
});
