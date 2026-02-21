import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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

  return token.accessToken;
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

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("fields", "id,name,account_status,currency,balance");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("[Meta API] Failed to fetch ad account:", data);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      accountStatus: data.account_status,
      currency: data.currency,
      balance: parseFloat(data.balance) / 100, // Convert cents to dollars
    };
  } catch (error) {
    console.error("[Meta API] Error fetching ad account:", error);
    return null;
  }
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

  try {
    const url = new URL(`https://graph.facebook.com/v21.0/${tokenData.adAccountId}/campaigns`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("limit", (options?.limit || 25).toString());
    
    let fields = "id,name,status,objective,daily_budget,lifetime_budget,created_time";
    if (options?.includeInsights) {
      // Add date range parameters to insights if provided
      let insightsParams = "";
      if (options.dateRange?.since || options.dateRange?.until) {
        const params = [];
        if (options.dateRange.since) params.push(`time_range={'since':'${options.dateRange.since}'}`);
        if (options.dateRange.until) params.push(`time_range={'until':'${options.dateRange.until}'}`);
        if (options.dateRange.since && options.dateRange.until) {
          insightsParams = `.time_range({'since':'${options.dateRange.since}','until':'${options.dateRange.until}'})`;
        } else if (options.dateRange.since) {
          insightsParams = `.time_range({'since':'${options.dateRange.since}'})`;
        } else if (options.dateRange.until) {
          insightsParams = `.time_range({'until':'${options.dateRange.until}'})`;
        }
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
      console.error("[Meta API] Failed to fetch campaigns:", data);
      return [];
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
  } catch (error) {
    console.error("[Meta API] Error fetching campaigns:", error);
    return [];
  }
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

    if (params.dailyBudget) {
      url.searchParams.set("daily_budget", Math.round(params.dailyBudget * 100).toString());
    }
    if (params.lifetimeBudget) {
      url.searchParams.set("lifetime_budget", Math.round(params.lifetimeBudget * 100).toString());
    }

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
    url.searchParams.set("optimization_goal", "REACH");

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
