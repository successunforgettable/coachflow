/**
 * metaTeardown.ts — deleting step 4c's own campaign from a real ad account, and nothing else.
 *
 * ⚠️ THE ACCOUNT THIS RUNS AGAINST IS LIVE AND CARRIES REAL ADVERTISING (~AED 1.17M spent
 * across ~200 campaigns). Every rule here exists to make one specific mistake impossible.
 *
 * FOUR RULES:
 *
 *  1. **DELETE BY RECORDED ID, NEVER BY NAME.** The campaign listing truncates (200 came back
 *     against a limit of 200), and five campaigns already share the name "Auto Campaign Kit",
 *     so a name match is neither complete nor unambiguous. The only id deleted is the one this
 *     run's ledger recorded.
 *  2. **THE REFUSAL IS CHECKED ON THE RESOLVED ID, before any DELETE.** Guarding the arguments
 *     would wave through exactly the case that matters — a wrong-but-plausible id.
 *  3. **CONFIRM BY ID, NOT BY LIST.** Meta SOFT-deletes: the object stays readable with
 *     `status = DELETED`. A list check would show it absent for the wrong reason, or show it
 *     present and be misread as failure. `getCampaignById` is exact.
 *  4. **PROVE THE ORPHANS ARE UNTOUCHED AFTERWARDS.** The five "Auto Campaign Kit" campaigns
 *     must still number five, and the three orphan ids must all still be present. 4c's
 *     obligation is to leave that discrepancy exactly as it found it.
 *
 * Every Graph call is INJECTED, so all four rules are provable without touching Meta.
 */
import {
  EXPECTED_AUTO_KIT_COUNT,
  KNOWN_ORPHAN_CAMPAIGN_IDS,
  ORPHAN_CAMPAIGN_NAME,
  assertDeletableCampaign,
} from "./metaSafety";

export type MetaTeardownDeps = {
  deleteCampaign: (userId: number, campaignId: string) => Promise<boolean>;
  getCampaignById: (userId: number, campaignId: string) => Promise<any | null>;
  getAdById: (userId: number, adId: string) => Promise<any | null>;
  /** Every campaign on the account, for the orphan re-check. */
  listCampaigns: (userId: number) => Promise<Array<{ id: string; name: string }>>;
};

export type MetaTeardownResult = {
  campaignId: string;
  deleted: boolean;
  /** What Meta says the campaign is now — "DELETED", or "gone" when it reads back null. */
  confirmedStatus: string;
  ads: Array<{ id: string; confirmedGone: boolean; status: string }>;
  orphanCheck: {
    autoKitCount: number;
    expected: number;
    countUnchanged: boolean;
    orphansPresent: string[];
    orphansMissing: string[];
    allOrphansIntact: boolean;
  };
  ok: boolean;
  problems: string[];
};

export async function teardownRecordedCampaign(
  deps: MetaTeardownDeps,
  params: { userId: number; campaignId: string | null | undefined; adIds: string[] },
): Promise<MetaTeardownResult> {
  // Rule 2 — refuse first, on the resolved id, before anything is called.
  assertDeletableCampaign(params.campaignId);
  const campaignId = String(params.campaignId).trim();

  const problems: string[] = [];

  // Rule 1 — delete exactly this id.
  const deleted = await deps.deleteCampaign(params.userId, campaignId);
  if (!deleted) problems.push(`deleteCampaign returned false for ${campaignId}`);

  // Rule 3 — confirm BY ID. Null means the object is gone; DELETED is Meta's soft-delete.
  const after = await deps.getCampaignById(params.userId, campaignId);
  const confirmedStatus = after == null ? "gone" : String(after.status ?? after.effective_status ?? "unknown");
  if (!(confirmedStatus === "gone" || confirmedStatus.toUpperCase() === "DELETED")) {
    problems.push(`campaign ${campaignId} still reads back as ${confirmedStatus} — NOT deleted`);
  }

  const ads: MetaTeardownResult["ads"] = [];
  for (const adId of params.adIds) {
    const row = await deps.getAdById(params.userId, adId);
    const status = row == null ? "gone" : String(row.status ?? row.effective_status ?? "unknown");
    const confirmedGone = row == null || status.toUpperCase() === "DELETED" || status.toUpperCase() === "ARCHIVED";
    if (!confirmedGone) problems.push(`ad ${adId} still reads back as ${status}`);
    ads.push({ id: adId, confirmedGone, status });
  }

  // Rule 4 — the orphans must be exactly as we found them.
  const all = await deps.listCampaigns(params.userId);
  const autoKit = (all ?? []).filter((c) => String(c.name).trim() === ORPHAN_CAMPAIGN_NAME);
  const presentIds = new Set((all ?? []).map((c) => String(c.id)));
  const orphansPresent = KNOWN_ORPHAN_CAMPAIGN_IDS.filter((id) => presentIds.has(id));
  const orphansMissing = KNOWN_ORPHAN_CAMPAIGN_IDS.filter((id) => !presentIds.has(id));
  const countUnchanged = autoKit.length === EXPECTED_AUTO_KIT_COUNT;
  const allOrphansIntact = orphansMissing.length === 0;

  if (!countUnchanged) {
    problems.push(
      `"${ORPHAN_CAMPAIGN_NAME}" count is ${autoKit.length}, expected ${EXPECTED_AUTO_KIT_COUNT} — ` +
      `this run has changed the pre-existing discrepancy it was required to leave alone`,
    );
  }
  if (!allOrphansIntact) {
    problems.push(`pre-existing orphan(s) MISSING: ${orphansMissing.join(", ")}`);
  }

  return {
    campaignId,
    deleted,
    confirmedStatus,
    ads,
    orphanCheck: {
      autoKitCount: autoKit.length,
      expected: EXPECTED_AUTO_KIT_COUNT,
      countUnchanged,
      orphansPresent: [...orphansPresent],
      orphansMissing: [...orphansMissing],
      allOrphansIntact,
    },
    ok: problems.length === 0,
    problems,
  };
}

/**
 * The read-back proof, run BEFORE teardown: what Meta actually stored, never what we sent.
 *
 * 🔑 `allShareOneAdSet` is the entire point of step 4c. Everything else here is a guard on the
 * claim — a set of ads that shared one ad set but were quietly ACTIVE, or carried copy other
 * than the assembled rows, would not be the result we are after.
 */
export type ReadBackDeps = {
  getCampaignById: (userId: number, id: string) => Promise<any | null>;
  getAdSetById: (userId: number, id: string) => Promise<any | null>;
  getAdById: (userId: number, id: string) => Promise<any | null>;
  getAdCreativeById: (userId: number, id: string) => Promise<any | null>;
};

export type ReadBackResult = {
  allShareOneAdSet: boolean;
  sharedAdSetId: string | null;
  adSetBelongsToCampaign: boolean;
  allPaused: boolean;
  dailyBudgetMinorUnits: string | null;
  copyMatches: Array<{ adId: string; creativeId: string; titleOk: boolean; bodyOk: boolean }>;
  ok: boolean;
  problems: string[];
};

export async function readBackPublishedSet(
  deps: ReadBackDeps,
  params: {
    userId: number;
    campaignId: string;
    adSetId: string;
    expected: Array<{ adId: string; creativeId: string; headline: string; body: string }>;
  },
): Promise<ReadBackResult> {
  const problems: string[] = [];

  const campaign = await deps.getCampaignById(params.userId, params.campaignId);
  const campaignPaused = String(campaign?.status ?? "").toUpperCase() === "PAUSED";
  if (!campaignPaused) problems.push(`campaign status is ${campaign?.status ?? "unreadable"}, expected PAUSED`);

  const adSet = await deps.getAdSetById(params.userId, params.adSetId);
  const adSetPaused = String(adSet?.status ?? "").toUpperCase() === "PAUSED";
  if (!adSetPaused) problems.push(`ad set status is ${adSet?.status ?? "unreadable"}, expected PAUSED`);
  const adSetBelongsToCampaign = String(adSet?.campaign_id ?? "") === params.campaignId;
  if (!adSetBelongsToCampaign) {
    problems.push(`ad set's campaign_id is ${adSet?.campaign_id ?? "unreadable"}, expected ${params.campaignId}`);
  }
  const dailyBudgetMinorUnits = adSet?.daily_budget == null ? null : String(adSet.daily_budget);

  const adSetIds: string[] = [];
  let allAdsPaused = true;
  for (const e of params.expected) {
    const ad = await deps.getAdById(params.userId, e.adId);
    adSetIds.push(String(ad?.adset_id ?? "unreadable"));
    if (String(ad?.status ?? "").toUpperCase() !== "PAUSED") {
      allAdsPaused = false;
      problems.push(`ad ${e.adId} status is ${ad?.status ?? "unreadable"}, expected PAUSED`);
    }
  }
  const unique = Array.from(new Set(adSetIds));
  const allShareOneAdSet = unique.length === 1 && unique[0] === params.adSetId;
  if (!allShareOneAdSet) {
    problems.push(
      `ads do NOT share one ad set — saw ${unique.join(", ")} (expected all ${params.adSetId}). ` +
      `This is the claim step 4c exists to prove.`,
    );
  }

  const copyMatches: ReadBackResult["copyMatches"] = [];
  for (const e of params.expected) {
    const cr = await deps.getAdCreativeById(params.userId, e.creativeId);
    const titleOk = String(cr?.effectiveTitle ?? "") === e.headline;
    const bodyOk = String(cr?.effectiveBody ?? "") === e.body;
    if (!titleOk) problems.push(`creative ${e.creativeId} headline differs from the assembled row`);
    if (!bodyOk) problems.push(`creative ${e.creativeId} body differs from the assembled row`);
    copyMatches.push({ adId: e.adId, creativeId: e.creativeId, titleOk, bodyOk });
  }

  return {
    allShareOneAdSet,
    sharedAdSetId: allShareOneAdSet ? params.adSetId : null,
    adSetBelongsToCampaign,
    allPaused: campaignPaused && adSetPaused && allAdsPaused,
    dailyBudgetMinorUnits,
    copyMatches,
    ok: problems.length === 0,
    problems,
  };
}
