/**
 * multiAdPublish.ts — N ads, ONE campaign, ONE ad set.
 *
 * 🔴 WHY THIS EXISTS. `publishToMeta` builds a COMPLETE hierarchy on every call —
 * `createCampaign` → `createAdSet` → `createAdCreative` → `createAd`. There is no fan-out and
 * no path anywhere that adds an ad to an EXISTING ad set, so four ads today means four
 * campaigns and four ad sets. Meta only compares variants and distributes budget across them
 * INSIDE one ad set; four unrelated campaigns with separate budgets never enter one auction.
 * So the entire distinctness chapter — the gate, the concept stamps, the assembly — buys
 * nothing at all until this exists. It is a server capability, not a UI change.
 *
 * ── THE ORDER IS THE DESIGN ─────────────────────────────────────────────────────────────
 *
 * 1. **SCREEN EVERY AD FIRST, BEFORE ANY OBJECT IS CREATED.** The 2026-08-09 control run was
 *    blocked by our own compliance gate at `meta.ts:316` — before `createCampaign` — and that
 *    ordering is what kept the account clean. Screening after creating the campaign would
 *    leave a shell behind on a fully-blocked push, which is the shape of the orphan class
 *    already visible on the account (five "Auto Campaign Kit" campaigns against two
 *    `meta_published_ads` rows).
 * 2. **IF FEWER THAN `MIN_ADS` SURVIVE, REFUSE — and create nothing.** Not an empty campaign,
 *    not an empty ad set, and not a one-ad campaign either. See THE FLOOR below.
 * 3. **ONE campaign, ONE ad set, then a creative and an ad per surviving assembled ad.**
 * 4. **A FAILURE MID-LOOP KEEPS WHAT LANDED.** The campaign and ad set are real and hold the
 *    ads that succeeded; tearing them down would destroy good ads to tidy up a bad one. The
 *    failure is reported per ad, by index, so which one broke is never a guess.
 *
 * ⚠️ THIS MODULE MAKES NO META CALL OF ITS OWN. Every Graph function is INJECTED. That is
 * what lets the ordering above be proven with fakes — no network, no account, no spend — and
 * it is why this file can exist and be tested while step 4c is still held for its own
 * authorisation. It also writes nothing: it returns what happened and the caller persists.
 *
 * ⚠️ NOT WIRED, NOT INVOKED. Nothing calls this yet. The live multi-ad push is step 4c and
 * needs Arfeen's explicit word on the day, on an account that carries real advertising.
 *
 * ── THE FLOOR ───────────────────────────────────────────────────────────────────────────
 *
 * This module exists to put N ads into ONE ad set so Meta can compare them in one auction.
 * A campaign carrying a SINGLE ad buys none of that: there is nothing to compare, nothing to
 * distribute budget across, and the entire distinctness chapter upstream — the gate, the
 * concept stamps, the assembly — has produced a plain single-ad push that `publishToMeta`
 * already does better. So one surviving ad is not a small success, it is a failed multi-ad
 * push, and it must refuse exactly as zero survivors refuses.
 *
 * `MIN_ADS` is the ONE number, and it means the same thing at all three points a count exists:
 *
 *   · **assembly output** — what the caller handed in (`params.ads`);
 *   · **post-screening survivor count** — what came through the compliance and ad-to-page
 *     screen. This is the load-bearing one: it is the last count taken while nothing exists
 *     on Meta yet, so it is the only one that can still refuse by creating nothing;
 *   · **final published count** — what Meta actually accepted.
 *
 * The first two REFUSE and create nothing. The third cannot: by the time it is known, the
 * campaign, the ad set and the ads that succeeded are real, and this module's standing rule is
 * that a failure mid-loop KEEPS what landed rather than destroying good ads to tidy up a bad
 * one. So the third point REPORTS the shortfall on `belowFloor` instead of hiding it, and the
 * caller decides — the only way to reach it is per-ad Graph failures AFTER creation, since the
 * survivor floor guarantees at least `MIN_ADS` ads entered the loop.
 *
 * It is deliberately a constant and not a parameter. A caller-supplied minimum would be a path
 * back to a one-ad campaign, which is the thing being closed.
 */

/**
 * The floor. Two ads is the smallest set that can prove shared ad-set membership and the
 * smallest that gives Meta anything to compare; below it, nothing is created at all.
 */
export const MIN_ADS = 2;

/** The four Graph calls, injected. Signatures mirror `server/lib/metaAPI.ts` exactly. */
export type MetaWriteDeps = {
  createCampaign: (userId: number, params: any) => Promise<{ id: string } | null>;
  createAdSet: (userId: number, params: any) => Promise<{ id: string } | null>;
  createAdCreative: (userId: number, params: any) => Promise<{ id: string } | null>;
  createAd: (userId: number, params: any) => Promise<{ id: string } | null>;
};

/** One ad's copy, already assembled and paired. Ids travel so provenance can be persisted. */
export type PublishableAd = {
  conceptId: number | null;
  headline: string;
  body: string;
  headlineAdCopyId: number | null;
  bodyAdCopyId: number | null;
  imageUrl?: string | null;
  verticalImageUrl?: string | null;
};

/** Screening verdict for one ad. `blocked` is fail-closed: a missing verdict never publishes. */
export type ScreenVerdict = { blocked: boolean; classes: string[] };

export type MultiAdPublishParams = {
  userId: number;
  ads: PublishableAd[];
  campaignName: string;
  objective: string;
  linkUrl: string;
  status: "ACTIVE" | "PAUSED";
  dailyBudget?: number;
  lifetimeBudget?: number;
  callToAction?: string;
  targeting?: any;
  startTime?: string;
  endTime?: string;
  /** Screens one ad's RESOLVED copy. Runs on every ad before anything is created. */
  screen: (ad: PublishableAd) => Promise<ScreenVerdict>;
};

export type MultiAdPublishResult = {
  /** Null when the push was refused before any object was created. */
  campaignId: string | null;
  adSetId: string | null;
  published: Array<{
    index: number;
    conceptId: number | null;
    metaAdId: string;
    metaCreativeId: string;
    headlineAdCopyId: number | null;
    bodyAdCopyId: number | null;
  }>;
  blocked: Array<{ index: number; conceptId: number | null; classes: string[] }>;
  failed: Array<{ index: number; conceptId: number | null; stage: "creative" | "ad"; message: string }>;
  /** Set when nothing was created at all. Null when a campaign exists. */
  refusedReason: string | null;
  /**
   * The third floor point. Set when a campaign DOES exist but fewer than `MIN_ADS` ads actually
   * landed — reachable only through per-ad Graph failures after creation, because the survivor
   * floor guarantees at least `MIN_ADS` entered the loop. Nothing is un-created here (a mid-loop
   * failure keeps what landed), so this reports the shortfall rather than hiding it. Null when
   * the floor was met, and null when the push refused before creating anything — in that case
   * `refusedReason` already carries it.
   */
  belowFloor: string | null;
};

export async function publishAssembledAds(
  deps: MetaWriteDeps,
  params: MultiAdPublishParams,
): Promise<MultiAdPublishResult> {
  const result: MultiAdPublishResult = {
    campaignId: null, adSetId: null, published: [], blocked: [], failed: [],
    refusedReason: null, belowFloor: null,
  };

  // ── 0. FLOOR, point one: what the caller handed in ─────────────────────────
  if (params.ads.length === 0) {
    result.refusedReason = "no assembled ads were supplied; nothing was created";
    return result;
  }
  if (params.ads.length < MIN_ADS) {
    result.refusedReason =
      `only ${params.ads.length} assembled ad(s) were supplied and at least ${MIN_ADS} are ` +
      `required — a single ad shares an ad set with nothing; ` +
      `no campaign, ad set, creative or ad was created`;
    return result;
  }

  // ── 1. Screen everything BEFORE creating anything ──────────────────────────
  const survivors: Array<{ index: number; ad: PublishableAd }> = [];
  for (let i = 0; i < params.ads.length; i++) {
    const ad = params.ads[i];
    let verdict: ScreenVerdict;
    try {
      verdict = await params.screen(ad);
    } catch {
      // Fail closed. A screen that throws is not a pass — the compliance layer is
      // fail-closed by design everywhere else in this codebase and this is no exception.
      verdict = { blocked: true, classes: ["screen_threw"] };
    }
    if (verdict.blocked) {
      result.blocked.push({ index: i, conceptId: ad.conceptId, classes: verdict.classes });
      continue;
    }
    survivors.push({ index: i, ad });
  }

  // ── 2. FLOOR, point two: too few survived → refuse, and leave no shell behind ──
  //
  // This is the last count taken while Meta still holds nothing, so it is the only point that
  // can enforce the floor by creating nothing. A single survivor is NOT a reduced success — it
  // is a multi-ad push that has no second ad to share an ad set with — and it refuses on the
  // same terms as zero, for the same reason: no orphan shell, no spend, nothing to tear down.
  if (survivors.length < MIN_ADS) {
    result.refusedReason = survivors.length === 0
      ? `all ${params.ads.length} assembled ad(s) were blocked by the compliance gate; ` +
        `no campaign, ad set, creative or ad was created`
      : `only ${survivors.length} of ${params.ads.length} assembled ad(s) survived screening and ` +
        `at least ${MIN_ADS} are required — a single ad shares an ad set with nothing; ` +
        `no campaign, ad set, creative or ad was created`;
    return result;
  }

  // ── 3. ONE campaign, ONE ad set ────────────────────────────────────────────
  const campaign = await deps.createCampaign(params.userId, {
    name: params.campaignName,
    objective: params.objective,
    status: params.status,
  });
  if (!campaign) {
    result.refusedReason = "Failed to create Meta campaign";
    return result;
  }
  result.campaignId = campaign.id;

  const adSet = await deps.createAdSet(params.userId, {
    campaignId: campaign.id,
    name: `${params.campaignName} - Ad Set`,
    status: params.status,
    dailyBudget: params.dailyBudget,
    lifetimeBudget: params.lifetimeBudget,
    targeting: params.targeting,
    startTime: params.startTime,
    endTime: params.endTime,
  });
  if (!adSet) {
    // The campaign exists and is empty. Reported rather than hidden — it is the orphan the
    // ordering above is designed to avoid, and a caller must be able to see it happened.
    result.refusedReason =
      `Failed to create Meta ad set; campaign ${campaign.id} was created and is empty`;
    return result;
  }
  result.adSetId = adSet.id;

  // ── 4. A creative and an ad per survivor, ALL into that one ad set ─────────
  for (const { index, ad } of survivors) {
    let creative: { id: string } | null = null;
    try {
      creative = await deps.createAdCreative(params.userId, {
        name: `${params.campaignName} - Creative ${index + 1}`,
        headline: ad.headline,
        body: ad.body,
        linkUrl: params.linkUrl,
        imageUrl: ad.imageUrl ?? undefined,
        verticalImageUrl: ad.verticalImageUrl ?? undefined,
        callToAction: params.callToAction,
      });
    } catch (e: any) {
      result.failed.push({ index, conceptId: ad.conceptId, stage: "creative", message: String(e?.message ?? e) });
      continue;
    }
    if (!creative) {
      result.failed.push({ index, conceptId: ad.conceptId, stage: "creative", message: "Failed to create Meta ad creative" });
      continue;
    }

    let created: { id: string } | null = null;
    try {
      created = await deps.createAd(params.userId, {
        name: `${params.campaignName} - ${index + 1}`,
        adSetId: adSet.id,
        creativeId: creative.id,
        status: params.status,
      });
    } catch (e: any) {
      result.failed.push({ index, conceptId: ad.conceptId, stage: "ad", message: String(e?.message ?? e) });
      continue;
    }
    if (!created) {
      result.failed.push({ index, conceptId: ad.conceptId, stage: "ad", message: "Failed to create Meta ad" });
      continue;
    }

    result.published.push({
      index,
      conceptId: ad.conceptId,
      metaAdId: created.id,
      metaCreativeId: creative.id,
      headlineAdCopyId: ad.headlineAdCopyId,
      bodyAdCopyId: ad.bodyAdCopyId,
    });
  }

  // ── 5. FLOOR, point three: what Meta actually accepted ─────────────────────
  //
  // Reported, not enforced by deletion. The campaign, the ad set and the ads that succeeded are
  // real by now, and the standing rule above is that a mid-loop failure KEEPS what landed. So
  // the shortfall is surfaced for the caller to act on rather than papered over as a success.
  if (result.published.length < MIN_ADS) {
    result.belowFloor =
      `${result.published.length} of ${survivors.length} screened ad(s) landed on Meta and at ` +
      `least ${MIN_ADS} are required; campaign ${result.campaignId} and its ad set exist and are ` +
      `below the floor — nothing was removed, so they need tearing down deliberately`;
  }

  return result;
}
