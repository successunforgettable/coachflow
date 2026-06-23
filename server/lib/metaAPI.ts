import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "../_core/tokenCrypto";

/**
 * Meta Marketing API Client
 * Wrapper for Meta Graph API calls with automatic token management
 */

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  createdTime: string;
  insights?: {
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    ctr: number;
    cpc: number;
  };
}

export interface MetaAdAccount {
  id: string;
  name: string;
  accountStatus: number;
  currency: string;
  balance: number;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  status: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  createdTime: string;
  insights?: {
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
  };
}

export interface MetaAdCreative {
  id: string;
  name: string;
  status?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  body?: string;
  title?: string;
}

/**
 * Get Meta access token for a user
 */
async function getMetaToken(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [token] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!token) return null;

  // Check if token is expired
  if (new Date() >= new Date(token.tokenExpiresAt)) {
    console.error("[Meta API] Token expired for user", userId);
    return null;
  }

  return decryptToken(token.accessToken);
}

/**
 * Fetch ad account details
 */
export async function getAdAccount(userId: number): Promise<MetaAdAccount | null> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return null;

  const db = await getDb();
  if (!db) return null;

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return null;

  // Preconditions above (no token, no DB, no adAccountId) return null and
  // are NOT counted as Meta API failures — they're client-side state issues,
  // not requests Meta ever saw. From here on, HTTP errors and network/parse
  // failures throw, so callers (the daily job's success/failure counter,
  // tRPC wraps in routers/meta.ts) classify them correctly. Pattern is
  // consistent across getCampaigns / getAdSets / getAdCreatives below.
  const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,account_status,currency,balance");

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Meta API getAdAccount HTTP ${response.status}: ${JSON.stringify(data?.error ?? data)}`);
  }

  return {
    id: data.id,
    name: data.name,
    accountStatus: data.account_status,
    currency: data.currency,
    balance: parseFloat(data.balance) / 100, // Convert cents to dollars
  };
}

/**
 * Fetch campaigns for an ad account
 */
export async function getCampaigns(
  userId: number,
  options?: {
    limit?: number;
    status?: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";
    includeInsights?: boolean;
    dateRange?: {
      since?: string; // YYYY-MM-DD format
      until?: string; // YYYY-MM-DD format
    };
  }
): Promise<MetaCampaign[]> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return [];

  const db = await getDb();
  if (!db) return [];

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return [];

  // Preconditions above return []; HTTP errors below throw. See note in getAdAccount.
  const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/campaigns`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", (options?.limit || 25).toString());

  let fields = "id,name,status,objective,daily_budget,lifetime_budget,created_time";
  if (options?.includeInsights) {
    // Add date range parameters to insights if provided
    let insightsParams = "";
    if (options.dateRange?.since && options.dateRange?.until) {
      insightsParams = `.time_range({'since':'${options.dateRange.since}','until':'${options.dateRange.until}'})`;
    } else if (options.dateRange?.since) {
      insightsParams = `.time_range({'since':'${options.dateRange.since}'})`;
    } else if (options.dateRange?.until) {
      insightsParams = `.time_range({'until':'${options.dateRange.until}'})`;
    }
    fields += `,insights${insightsParams}{impressions,clicks,spend,reach,ctr,cpc}`;
  }
  url.searchParams.set("fields", fields);

  if (options?.status) {
    url.searchParams.set("filtering", JSON.stringify([
      { field: "status", operator: "EQUAL", value: options.status }
    ]));
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Meta API getCampaigns HTTP ${response.status}: ${JSON.stringify(data?.error ?? data)}`);
  }

  return (data.data || []).map((campaign: any) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    objective: campaign.objective,
    dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : undefined,
    lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : undefined,
    createdTime: campaign.created_time,
    insights: campaign.insights?.data?.[0] ? {
      impressions: parseInt(campaign.insights.data[0].impressions || "0", 10),
      clicks: parseInt(campaign.insights.data[0].clicks || "0", 10),
      spend: parseFloat(campaign.insights.data[0].spend || "0"),
      reach: parseInt(campaign.insights.data[0].reach || "0", 10),
      ctr: parseFloat(campaign.insights.data[0].ctr || "0"),
      cpc: parseFloat(campaign.insights.data[0].cpc || "0"),
    } : undefined,
  }));
}

/**
 * Fetch ad sets for an ad account. Read-only Marketing API endpoint.
 * Used by the App Review compliance daily job for endpoint diversity.
 */
export async function getAdSets(
  userId: number,
  options?: {
    limit?: number;
    includeInsights?: boolean;
    dateRange?: {
      since?: string;
      until?: string;
    };
  }
): Promise<MetaAdSet[]> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return [];

  const db = await getDb();
  if (!db) return [];

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return [];

  // Preconditions above return []; HTTP errors below throw. See note in getAdAccount.
  const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/adsets`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", (options?.limit || 25).toString());

  let fields = "id,name,campaign_id,status,daily_budget,lifetime_budget,created_time";
  if (options?.includeInsights) {
    let insightsParams = "";
    if (options.dateRange?.since && options.dateRange?.until) {
      insightsParams = `.time_range({'since':'${options.dateRange.since}','until':'${options.dateRange.until}'})`;
    } else if (options.dateRange?.since) {
      insightsParams = `.time_range({'since':'${options.dateRange.since}'})`;
    } else if (options.dateRange?.until) {
      insightsParams = `.time_range({'until':'${options.dateRange.until}'})`;
    }
    fields += `,insights${insightsParams}{impressions,clicks,spend,reach}`;
  }
  url.searchParams.set("fields", fields);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Meta API getAdSets HTTP ${response.status}: ${JSON.stringify(data?.error ?? data)}`);
  }

  return (data.data || []).map((adset: any) => ({
    id: adset.id,
    name: adset.name,
    campaignId: adset.campaign_id,
    status: adset.status,
    dailyBudget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : undefined,
    lifetimeBudget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : undefined,
    createdTime: adset.created_time,
    insights: adset.insights?.data?.[0] ? {
      impressions: parseInt(adset.insights.data[0].impressions || "0", 10),
      clicks: parseInt(adset.insights.data[0].clicks || "0", 10),
      spend: parseFloat(adset.insights.data[0].spend || "0"),
      reach: parseInt(adset.insights.data[0].reach || "0", 10),
    } : undefined,
  }));
}

/**
 * Fetch ad creatives for an ad account. Read-only Marketing API endpoint.
 *
 * @deprecated Removed from the App Review daily job loop on 2026-04-30
 * after Meta returned HTTP 500 with empty body for ~92% of calls against
 * ad account act_1254349025145319 (real Meta-side failures, not our
 * parsing — see commit b462038 for the diagnostic that surfaced this).
 * Function retained for post-launch investigation when the Meta-side
 * issue is understood (could be permissions/scope, could be account
 * state, could be Meta infrastructure on this specific endpoint). Do
 * not re-add to the daily loop until the failure mode is diagnosed.
 */
export async function getAdCreatives(
  userId: number,
  options?: {
    limit?: number;
  }
): Promise<MetaAdCreative[]> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return [];

  const db = await getDb();
  if (!db) return [];

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return [];

  // Preconditions above return []; HTTP errors below throw. See note in getAdAccount.
  //
  // Defensive parsing — the /{ad-account}/adcreatives endpoint observed
  // intermittent HTTP 200 with empty body on the 2026-04-30 boot-time
  // run (55 of 60 calls, 91.7% rate). Empty body breaks `response.json()`
  // with "Unexpected end of JSON input" and surfaces as a failure in our
  // metrics, but Meta records the underlying call as a 200 success on
  // their side. Read body as text first so we can distinguish: empty
  // body on 200 → treat as { data: [] } (success); empty body on
  // non-2xx → throw with explicit status code; non-empty body → parse
  // normally. Pattern is scoped to this endpoint specifically; the other
  // three read functions returned 0% errors and don't need it.
  const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/adcreatives`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", (options?.limit || 25).toString());
  url.searchParams.set("fields", "id,name,status,thumbnail_url,image_url,body,title");

  const response = await fetch(url.toString());
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Meta API getAdCreatives HTTP ${response.status}: ${text || 'empty body'}`);
  }

  if (!text) {
    console.log(`[Meta API] getAdCreatives empty body for user ${userId}, treating as data: [] (HTTP ${response.status})`);
    return [];
  }

  const data = JSON.parse(text);

  return (data.data || []).map((creative: any) => ({
    id: creative.id,
    name: creative.name,
    status: creative.status,
    thumbnailUrl: creative.thumbnail_url,
    imageUrl: creative.image_url,
    body: creative.body,
    title: creative.title,
  }));
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  userId: number,
  params: {
    name: string;
    objective: string;
    status: "ACTIVE" | "PAUSED";
    dailyBudget?: number; // in dollars
    lifetimeBudget?: number; // in dollars
  }
): Promise<{ id: string; name: string } | null> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return null;

  const db = await getDb();
  if (!db) return null;

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return null;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/campaigns`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("name", params.name);
    url.searchParams.set("objective", params.objective);
    url.searchParams.set("status", params.status);
    url.searchParams.set("special_ad_categories", "[]");
    // Phase C C3 follow-on 6: Meta v21 requires explicit budget-model
    // declaration when no campaign-level budget is set (we keep budget at
    // ad-set level — see publishToMeta in routers/meta.ts for the
    // CBO/bid_strategy rationale). Without this field Meta rejects with
    // error_subcode 4834011 ("Must specify True or False in
    // is_adset_budget_sharing_enabled field"). `false` = strict per-ad-set
    // budgets, no cross-ad-set sharing; safer default for single-ad-set
    // pushes (our use case), and the semantic the modal's "Daily budget"
    // field implies.
    url.searchParams.set("is_adset_budget_sharing_enabled", "false");

    if (params.dailyBudget) {
      url.searchParams.set("daily_budget", Math.round(params.dailyBudget * 100).toString());
    }
    if (params.lifetimeBudget) {
      url.searchParams.set("lifetime_budget", Math.round(params.lifetimeBudget * 100).toString());
    }

    // Phase C C3 follow-on 6: symmetric forensic outbound-URL log (token
    // redacted). Closes the 8th planning miss — observability was only on
    // createAdSet (added in c9a35c9). All 4 Meta API calls in the publish
    // chain now log their outbound payload so future failures are
    // diagnosable from a single push attempt.
    const debugUrl = new URL(url.toString());
    debugUrl.searchParams.set("access_token", "<REDACTED>");
    console.log("[Meta API] createCampaign outbound URL:", debugUrl.toString());

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to create campaign:", data);
      return null;
    }

    return {
      id: data.id,
      name: params.name,
    };
  } catch (error) {
    console.error("[Meta API] Error creating campaign:", error);
    return null;
  }
}

/**
 * Create an ad set within a campaign
 */
export async function createAdSet(
  userId: number,
  params: {
    campaignId: string;
    name: string;
    status: "ACTIVE" | "PAUSED";
    dailyBudget?: number; // in dollars
    lifetimeBudget?: number; // in dollars
    targeting: {
      geoLocations?: { countries?: string[] };
      ageMin?: number;
      ageMax?: number;
      genders?: number[]; // 1=male, 2=female
    };
    startTime?: string; // ISO 8601 format
    endTime?: string; // ISO 8601 format
  }
): Promise<{ id: string; name: string } | null> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return null;

  const db = await getDb();
  if (!db) return null;

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return null;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/adsets`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("name", params.name);
    url.searchParams.set("campaign_id", params.campaignId);
    url.searchParams.set("status", params.status);
    url.searchParams.set("billing_event", "IMPRESSIONS");
    // Phase C C3 follow-on 6: optimization_goal aligned with Meta's ODAX
    // (Outcome-Driven Ad Experiences, post-2023) objective taxonomy.
    // LINK_CLICKS is the canonical website-traffic-leads pairing — it works
    // across OUTCOME_AWARENESS / OUTCOME_TRAFFIC / OUTCOME_ENGAGEMENT /
    // OUTCOME_LEADS / OUTCOME_SALES campaigns when the destination is a
    // landing page (our case — Auto Mode publishes to zapcampaigns.com/p/{slug}
    // via Cloudflare KV in C2). REACH was the legacy AWARENESS-objective
    // pairing and is mismatched for OUTCOME_LEADS in v21. If a future
    // sprint adds Meta Pixel tracking on the LP, OFFSITE_CONVERSIONS becomes
    // available for lead/sale optimization.
    url.searchParams.set("optimization_goal", "LINK_CLICKS");
    // Phase C C3 follow-on 4: explicit auto-bidding strategy. Without this,
    // Meta's Graph API v21 defaults to a bid-cap strategy (LOWEST_COST_WITH_BID_CAP
    // or TARGET_COST) when daily_budget is set, then rejects the request
    // with error_subcode 1815857 ("Bid amount required for bid strategy
    // provided") because we don't pass bid_amount. LOWEST_COST_WITHOUT_CAP
    // forces auto-bidding which requires no bid_amount — canonical default
    // for users who haven't tuned manual bids, matching the modal's
    // "Initial Status: Paused (review first)" safety pattern.
    url.searchParams.set("bid_strategy", "LOWEST_COST_WITHOUT_CAP");

    if (params.dailyBudget) {
      url.searchParams.set("daily_budget", Math.round(params.dailyBudget * 100).toString());
    }
    if (params.lifetimeBudget) {
      url.searchParams.set("lifetime_budget", Math.round(params.lifetimeBudget * 100).toString());
    }

    // Targeting
    const targeting: any = {
      geo_locations: params.targeting.geoLocations || { countries: ["US"] },
    };
    if (params.targeting.ageMin) targeting.age_min = params.targeting.ageMin;
    if (params.targeting.ageMax) targeting.age_max = params.targeting.ageMax;
    if (params.targeting.genders) targeting.genders = params.targeting.genders;

    url.searchParams.set("targeting", JSON.stringify(targeting));

    if (params.startTime) {
      url.searchParams.set("start_time", params.startTime);
    }
    if (params.endTime) {
      url.searchParams.set("end_time", params.endTime);
    }

    // Phase C C3 follow-on 5: permanent forensic outbound-URL log. The
    // access_token query param is redacted before logging — never write
    // bearer credentials to Railway logs. This observability would've
    // caught the CBO/bid_strategy override 90 minutes earlier in the C3
    // verification cycle; making it permanent so future Meta payload
    // issues are diagnosable from the first failure rather than needing
    // a separate instrumentation deploy.
    const debugUrl = new URL(url.toString());
    debugUrl.searchParams.set("access_token", "<REDACTED>");
    console.log("[Meta API] createAdSet outbound URL:", debugUrl.toString());

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to create ad set:", data);
      return null;
    }

    return {
      id: data.id,
      name: params.name,
    };
  } catch (error) {
    console.error("[Meta API] Error creating ad set:", error);
    return null;
  }
}

/**
 * Create an ad creative
 */
export async function createAdCreative(
  userId: number,
  params: {
    name: string;
    headline: string;
    body: string;
    linkUrl: string;
    imageUrl?: string;
    callToAction?: string;
  }
): Promise<{ id: string } | null> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return null;

  const db = await getDb();
  if (!db) return null;

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return null;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/adcreatives`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("name", params.name);

    const objectStorySpec: any = {
      page_id: tokenData.pageId || "", // Will need to add pageId to schema
      link_data: {
        message: params.body,
        link: params.linkUrl,
        name: params.headline,
      },
    };

    if (params.imageUrl) {
      objectStorySpec.link_data.picture = params.imageUrl;
    }

    if (params.callToAction) {
      objectStorySpec.link_data.call_to_action = {
        type: params.callToAction,
        value: {
          link: params.linkUrl,
        },
      };
    }

    url.searchParams.set("object_story_spec", JSON.stringify(objectStorySpec));

    // Phase C C3 follow-on 6: symmetric forensic outbound-URL log (token
    // redacted). Mirrors createCampaign + createAdSet observability for
    // single-cycle byte-level diagnosis on any future creative-layer failure.
    const debugUrl = new URL(url.toString());
    debugUrl.searchParams.set("access_token", "<REDACTED>");
    console.log("[Meta API] createAdCreative outbound URL:", debugUrl.toString());

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to create ad creative:", data);
      return null;
    }

    return {
      id: data.id,
    };
  } catch (error) {
    console.error("[Meta API] Error creating ad creative:", error);
    return null;
  }
}

/**
 * Create an ad
 */
export async function createAd(
  userId: number,
  params: {
    name: string;
    adSetId: string;
    creativeId: string;
    status: "ACTIVE" | "PAUSED";
  }
): Promise<{ id: string; name: string } | null> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return null;

  const db = await getDb();
  if (!db) return null;

  const [tokenData] = await db
    .select()
    .from(metaAccessTokens)
    .where(eq(metaAccessTokens.userId, userId))
    .limit(1);

  if (!tokenData?.adAccountId) return null;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/ads`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("name", params.name);
    url.searchParams.set("adset_id", params.adSetId);
    url.searchParams.set("creative", JSON.stringify({ creative_id: params.creativeId }));
    url.searchParams.set("status", params.status);

    // Phase C C3 follow-on 6: symmetric forensic outbound-URL log (token
    // redacted). Completes the 4-call symmetric observability across the
    // Meta publish chain (campaign + adset + creative + ad).
    const debugUrl = new URL(url.toString());
    debugUrl.searchParams.set("access_token", "<REDACTED>");
    console.log("[Meta API] createAd outbound URL:", debugUrl.toString());

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to create ad:", data);
      return null;
    }

    return {
      id: data.id,
      name: params.name,
    };
  } catch (error) {
    console.error("[Meta API] Error creating ad:", error);
    return null;
  }
}

/**
 * Update campaign status (pause/resume)
 */
export async function updateCampaignStatus(
  userId: number,
  campaignId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<boolean> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return false;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${campaignId}`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("status", status);

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to update campaign status:", data);
      return false;
    }

    return data.success === true;
  } catch (error) {
    console.error("[Meta API] Error updating campaign status:", error);
    return false;
  }
}

/**
 * Update campaign details (name, budget)
 */
export async function updateCampaign(
  userId: number,
  campaignId: string,
  params: {
    name?: string;
    dailyBudget?: number; // in dollars
    lifetimeBudget?: number; // in dollars
  }
): Promise<boolean> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return false;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${campaignId}`);
    url.searchParams.set("access_token", accessToken);

    if (params.name) {
      url.searchParams.set("name", params.name);
    }
    if (params.dailyBudget) {
      url.searchParams.set("daily_budget", Math.round(params.dailyBudget * 100).toString());
    }
    if (params.lifetimeBudget) {
      url.searchParams.set("lifetime_budget", Math.round(params.lifetimeBudget * 100).toString());
    }

    const response = await fetch(url.toString(), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to update campaign:", data);
      return false;
    }

    return data.success === true;
  } catch (error) {
    console.error("[Meta API] Error updating campaign:", error);
    return false;
  }
}

/**
 * Delete campaign
 */
export async function deleteCampaign(
  userId: number,
  campaignId: string
): Promise<boolean> {
  const accessToken = await getMetaToken(userId);
  if (!accessToken) return false;

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${campaignId}`);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to delete campaign:", data);
      return false;
    }

    return data.success === true;
  } catch (error) {
    console.error("[Meta API] Error deleting campaign:", error);
    return false;
  }
}


/**
 * Get campaign status from Meta
 */
export async function getCampaignStatus(accessToken: string, campaignId: string): Promise<string> {
  const url = `https://graph.facebook.com/v21.0/${campaignId}?fields=status&access_token=${accessToken}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch campaign status");
  }
  
  const data = await response.json();
  return data.status;
}
