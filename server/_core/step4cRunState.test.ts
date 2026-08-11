/**
 * step4cRunState.test.ts — the incremental state file, and the teardown decision that the
 * 2026-08-10 incident exists to force.
 *
 * The shape of that incident, pinned here so it cannot come back: a run created a service, an
 * ICP, concepts, a copy ad set and four rendered images, then died at the landing-page publish
 * gate. The state file was written only after a successful publish, so teardown had nothing to
 * read; and even hand-fed a state it ran the Meta phase first, which correctly refuses a null
 * campaign id and therefore never reached the local rows.
 *
 * The refusal itself is NOT relaxed anywhere here — `assertDeletableCampaign` is unchanged and
 * still guards every non-null id. What changed is that "no campaign at all" is now a SKIP.
 */

import { describe, it, expect } from "vitest";
import {
  assertPublishable, emptyRunState, mergeRunState, metaPhasePlan, type Step4cRunState,
} from "./step4cRunState";
import { assertDeletableCampaign, KNOWN_ORPHAN_CAMPAIGN_IDS } from "./metaSafety";

const T0 = "2026-08-11T09:00:00.000Z";
const T1 = "2026-08-11T09:05:00.000Z";
const HOST = "test-host";

const prepared = (over: Partial<Step4cRunState> = {}): Step4cRunState => ({
  ...emptyRunState({ now: T0, host: HOST, label: "ZZ-4C" }),
  phase: "prepared",
  serviceId: 999, icpId: 888, adSetId: "copyset", batchId: "batch-1",
  landingPageId: 777, publicUrl: "https://example.com/p/zz",
  ...over,
});

describe("the state file accumulates ids one at a time", () => {
  it("starts empty but stamped", () => {
    const s = emptyRunState({ now: T0, host: HOST, label: "ZZ-4C" });
    expect(s.phase).toBe("prepare");
    expect(s.serviceId).toBeUndefined();
    expect(s.startedAt).toBe(T0);
  });

  it("records an id without losing the ones before it", () => {
    let s = emptyRunState({ now: T0, host: HOST, label: "ZZ-4C" });
    s = mergeRunState(s, { serviceId: 312 }, T1);
    s = mergeRunState(s, { icpId: 286 }, T1);
    s = mergeRunState(s, { batchId: "batch-x" }, T1);
    expect(s).toMatchObject({ serviceId: 312, icpId: 286, batchId: "batch-x" });
    expect(s.updatedAt).toBe(T1);
    expect(s.startedAt).toBe(T0);
  });

  it("a crash midway still leaves a usable work list", () => {
    // Exactly the 08-10 shape: service, ICP, copy and creatives exist; the page never published.
    let s = emptyRunState({ now: T0, host: HOST, label: "ZZ-4C" });
    s = mergeRunState(s, { serviceId: 312 }, T0);
    s = mergeRunState(s, { icpId: 286 }, T0);
    s = mergeRunState(s, { adSetId: "sNkYRQIXmE8QQz2G9Yfwl" }, T0);
    s = mergeRunState(s, { batchId: "batch-1786376772637-997a8f6f" }, T0);
    expect(s.serviceId && s.icpId && s.adSetId && s.batchId).toBeTruthy();
    expect(s.metaCampaignId).toBeUndefined();
    expect(metaPhasePlan({ ledgerCampaignId: null, stateCampaignId: s.metaCampaignId }).run).toBe(false);
  });

  it("carries a coach-scoped prior value, including NULL, through a JSON round-trip", () => {
    // teardown restores users.bookingUrl to what it was. A prior value of null must survive the
    // file, because "there was nothing here before" is the common case and restoring it to the
    // string "null" would be worse than not restoring at all.
    const s = mergeRunState(prepared(), { coachFieldsBefore: { bookingUrl: null } }, T1);
    const round = JSON.parse(JSON.stringify(s)) as Step4cRunState;
    expect(round.coachFieldsBefore).toEqual({ bookingUrl: null });
    expect("bookingUrl" in (round.coachFieldsBefore ?? {})).toBe(true);
  });

  it("keeps a real prior booking url intact", () => {
    const s = mergeRunState(prepared(), { coachFieldsBefore: { bookingUrl: "https://cal.com/arfeen" } }, T1);
    expect(JSON.parse(JSON.stringify(s)).coachFieldsBefore.bookingUrl).toBe("https://cal.com/arfeen");
  });

  it("replaces an array outright rather than merging it", () => {
    let s = mergeRunState(prepared(), { publishedRowIds: [1, 2] }, T1);
    s = mergeRunState(s, { publishedRowIds: [1, 2, 3] }, T1);
    expect(s.publishedRowIds).toEqual([1, 2, 3]);
  });
});

describe("metaPhasePlan — skip when nothing was ever created, never a relaxed guard", () => {
  it("SKIPS when neither the ledger nor the state names a campaign", () => {
    const plan = metaPhasePlan({ ledgerCampaignId: null, stateCampaignId: undefined });
    expect(plan.run).toBe(false);
    expect(plan.campaignId).toBeNull();
    expect(plan.reason).toMatch(/never reached Meta/i);
  });

  it("treats blank strings as absent", () => {
    expect(metaPhasePlan({ ledgerCampaignId: "   ", stateCampaignId: "" }).run).toBe(false);
  });

  it("RUNS on the ledger's id when both agree", () => {
    const plan = metaPhasePlan({ ledgerCampaignId: "1202467999", stateCampaignId: "1202467999" });
    expect(plan.run).toBe(true);
    expect(plan.campaignId).toBe("1202467999");
  });

  it("RUNS when only the ledger has it — the ledger is written first, so this is normal", () => {
    const plan = metaPhasePlan({ ledgerCampaignId: "1202467999", stateCampaignId: null });
    expect(plan.run).toBe(true);
    expect(plan.campaignId).toBe("1202467999");
  });

  it("STOPS when they disagree rather than guessing", () => {
    expect(() => metaPhasePlan({ ledgerCampaignId: "111", stateCampaignId: "222" }))
      .toThrow(/will not guess/i);
  });

  it("STOPS when the state has a campaign the ledger never recorded — a campaign may be live", () => {
    expect(() => metaPhasePlan({ ledgerCampaignId: null, stateCampaignId: "333" }))
      .toThrow(/ledger has no campaign entry/i);
  });

  it("the protected-id refusal is UNCHANGED and still fires on a planned id", () => {
    const orphan = KNOWN_ORPHAN_CAMPAIGN_IDS[0];
    const plan = metaPhasePlan({ ledgerCampaignId: orphan, stateCampaignId: orphan });
    expect(plan.run).toBe(true); // the plan says "there is something to do"…
    expect(() => assertDeletableCampaign(plan.campaignId)).toThrow(/REFUSING/); // …and the guard still says no
  });

  it("a skipped Meta phase never reaches the guard at all", () => {
    const plan = metaPhasePlan({ ledgerCampaignId: null, stateCampaignId: null });
    expect(plan.run).toBe(false);
    // The old code called the guard unconditionally and threw here, so teardown could not run.
    expect(() => assertDeletableCampaign(plan.campaignId)).toThrow();
  });
});

describe("assertPublishable — every reason to refuse a state file", () => {
  it("accepts a complete prepared state on the same host", () => {
    expect(() => assertPublishable(prepared(), HOST)).not.toThrow();
  });

  it("refuses a state that never finished preparing", () => {
    expect(() => assertPublishable(prepared({ phase: "prepare" }), HOST)).toThrow(/not "prepared"/);
  });

  it("refuses to publish twice — the first campaign would be left standing", () => {
    expect(() => assertPublishable(prepared({ phase: "published", metaCampaignId: "999" }), HOST))
      .toThrow(/already at phase/);
    expect(() => assertPublishable(prepared({ phase: "publish" }), HOST)).toThrow(/already at phase/);
  });

  it("refuses a state prepared on another machine — /tmp does not travel", () => {
    expect(() => assertPublishable(prepared(), "some-other-host")).toThrow(/SAME machine/i);
  });

  it("refuses when any prepared artifact is missing", () => {
    for (const missing of ["serviceId", "icpId", "adSetId", "batchId", "landingPageId", "publicUrl"] as const) {
      const s = prepared();
      delete (s as any)[missing];
      expect(() => assertPublishable(s, HOST), missing).toThrow(new RegExp(`no ${missing}`));
    }
  });

  it("refuses an empty publicUrl as firmly as an absent one", () => {
    expect(() => assertPublishable(prepared({ publicUrl: "" }), HOST)).toThrow(/no publicUrl/);
  });
});
