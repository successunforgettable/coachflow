import { describe, it, expect, beforeAll, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import { 
  trackAnalyticsEvent,
  getCampaignMetrics,
  getOverallMetrics,
  calculateCampaignROI,
  getAssetPerformance 
} from "./db";

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    trackAnalyticsEvent: vi.fn(),
    getCampaignMetrics: vi.fn(),
    getOverallMetrics: vi.fn(),
    calculateCampaignROI: vi.fn(),
    getAssetPerformance: vi.fn(),
  };
});

describe("Analytics Router", () => {
  const testUser = {
    id: 1,
    openId: "test-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus" as const,
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    headlineGeneratedCount: 0,
    hvcoGeneratedCount: 0,
    heroMechanismGeneratedCount: 0,
    icpGeneratedCount: 0,
    adCopyGeneratedCount: 0,
    emailSequenceGeneratedCount: 0,
    whatsappSequenceGeneratedCount: 0,
    landingPageGeneratedCount: 0,
    offerGeneratedCount: 0,
    subscriptionTier: "trial" as const,
    powerMode: false,
  };

  const createCaller = (user: typeof testUser | null = testUser) => {
    const ctx: Context = {
      user,
      req: {} as any,
      res: {} as any,
    };
    return appRouter.createCaller(ctx);
  };

  beforeAll(() => {
    // Setup mocks
    vi.mocked(trackAnalyticsEvent).mockResolvedValue(1);
    vi.mocked(getCampaignMetrics).mockResolvedValue([]);
    vi.mocked(getOverallMetrics).mockResolvedValue({
      totalCampaigns: 5,
      totalRevenue: 10000,
      totalConversions: 50,
      totalEmailOpens: 500,
      totalEmailClicks: 100,
      avgConversionRate: 10,
      totalROI: 150,
    });
    vi.mocked(calculateCampaignROI).mockResolvedValue({
      revenue: 5000,
      spend: 2000,
      roi: 150,
    });
    vi.mocked(getAssetPerformance).mockResolvedValue([
      {
        assetId: "test-asset-1",
        assetType: "headline",
        emailOpens: 100,
        emailClicks: 20,
        conversions: 5,
        revenue: 500,
      },
    ]);
  });

  describe("trackEvent", () => {
    it("should track analytics event (public procedure)", async () => {
      const caller = createCaller(null); // Public procedure, no auth needed
      
      const result = await caller.analytics.trackEvent({
        campaignId: 1,
        eventType: "email_open",
        assetId: "test-asset",
        assetType: "email",
        userIdentifier: "user@example.com",
        metadata: { source: "test" },
      });

      expect(result.eventId).toBe(1);
      expect(trackAnalyticsEvent).toHaveBeenCalledWith({
        campaignId: 1,
        eventType: "email_open",
        assetId: "test-asset",
        assetType: "email",
        userIdentifier: "user@example.com",
        metadata: { source: "test" },
      });
    });

    it("should track purchase event with revenue", async () => {
      const caller = createCaller(null);
      
      await caller.analytics.trackEvent({
        campaignId: 1,
        eventType: "purchase",
        revenue: 99.99,
      });

      expect(trackAnalyticsEvent).toHaveBeenCalledWith({
        campaignId: 1,
        eventType: "purchase",
        revenue: 99.99,
      });
    });
  });

  describe("getCampaignMetrics", () => {
    it("should get campaign metrics for date range", async () => {
      const caller = createCaller();
      
      const result = await caller.analytics.getCampaignMetrics({
        campaignId: 1,
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(result).toEqual([]);
      expect(getCampaignMetrics).toHaveBeenCalledWith(
        1,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );
    });
  });

  describe("getOverallMetrics", () => {
    it("should get overall metrics for user", async () => {
      const caller = createCaller();
      
      const result = await caller.analytics.getOverallMetrics({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(result.totalCampaigns).toBe(5);
      expect(result.totalRevenue).toBe(10000);
      expect(result.totalConversions).toBe(50);
      expect(result.avgConversionRate).toBe(10);
      expect(result.totalROI).toBe(150);
      expect(getOverallMetrics).toHaveBeenCalledWith(
        testUser.id,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );
    });
  });

  describe("calculateROI", () => {
    it("should calculate ROI for campaign", async () => {
      const caller = createCaller();
      
      const result = await caller.analytics.calculateROI({
        campaignId: 1,
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(result.revenue).toBe(5000);
      expect(result.spend).toBe(2000);
      expect(result.roi).toBe(150);
      expect(calculateCampaignROI).toHaveBeenCalledWith(
        1,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );
    });
  });

  describe("getAssetPerformance", () => {
    it("should get asset performance for campaign", async () => {
      const caller = createCaller();
      
      const result = await caller.analytics.getAssetPerformance({
        campaignId: 1,
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      expect(result).toHaveLength(1);
      expect(result[0].assetId).toBe("test-asset-1");
      expect(result[0].emailOpens).toBe(100);
      expect(result[0].conversions).toBe(5);
      expect(result[0].revenue).toBe(500);
      expect(getAssetPerformance).toHaveBeenCalledWith(
        1,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );
    });
  });
});
