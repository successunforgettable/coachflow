import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "./db";
import { metaAccessTokens, metaPublishedAds, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Meta Campaign Management Tests
 * Tests campaign management functionality (pause/resume/delete) and ad status tracking
 */

describe("Meta Campaign Management", () => {
  let testUserId: number;
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeEach(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-campaign-${Date.now()}`,
        name: "Campaign Test User",
        email: "campaign-test@example.com",
      })
      .$returningId();

    testUserId = user.id;
  });

  afterEach(async () => {
    if (!db) return;

    // Clean up test data
    await db.delete(metaPublishedAds).where(eq(metaPublishedAds.userId, testUserId));
    await db.delete(metaAccessTokens).where(eq(metaAccessTokens.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe("Published Ads Tracking", () => {
    it("should store published ad record when publishing to Meta", async () => {
      const publishedAd = {
        userId: testUserId,
        adSetId: "adset_123",
        metaCampaignId: "campaign_456",
        metaAdSetId: "metaadset_789",
        metaAdId: "metaad_101",
        metaCreativeId: "creative_202",
        campaignName: "Test Campaign",
        status: "PAUSED" as const,
        objective: "OUTCOME_LEADS",
        dailyBudget: "10.00",
      };

      await db.insert(metaPublishedAds).values(publishedAd);

      const [stored] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.userId, testUserId))
        .limit(1);

      expect(stored).toBeDefined();
      expect(stored.adSetId).toBe("adset_123");
      expect(stored.metaCampaignId).toBe("campaign_456");
      expect(stored.status).toBe("PAUSED");
      expect(stored.campaignName).toBe("Test Campaign");
    });

    it("should retrieve all published ads for a user", async () => {
      // Insert multiple published ads
      await db.insert(metaPublishedAds).values([
        {
          userId: testUserId,
          adSetId: "adset_1",
          metaCampaignId: "campaign_1",
          metaAdSetId: "metaadset_1",
          metaAdId: "metaad_1",
          metaCreativeId: "creative_1",
          campaignName: "Campaign 1",
          status: "ACTIVE",
        },
        {
          userId: testUserId,
          adSetId: "adset_2",
          metaCampaignId: "campaign_2",
          metaAdSetId: "metaadset_2",
          metaAdId: "metaad_2",
          metaCreativeId: "creative_2",
          campaignName: "Campaign 2",
          status: "PAUSED",
        },
      ]);

      const publishedAds = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.userId, testUserId));

      expect(publishedAds).toHaveLength(2);
      expect(publishedAds[0].status).toBe("ACTIVE");
      expect(publishedAds[1].status).toBe("PAUSED");
    });

    it("should find published ad by adSetId", async () => {
      await db.insert(metaPublishedAds).values({
        userId: testUserId,
        adSetId: "unique_adset_123",
        metaCampaignId: "campaign_456",
        metaAdSetId: "metaadset_789",
        metaAdId: "metaad_101",
        metaCreativeId: "creative_202",
        campaignName: "Test Campaign",
        status: "PAUSED",
      });

      const [found] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.adSetId, "unique_adset_123"))
        .limit(1);

      expect(found).toBeDefined();
      expect(found.adSetId).toBe("unique_adset_123");
      expect(found.metaCampaignId).toBe("campaign_456");
    });
  });

  describe("Campaign Status Updates", () => {
    it("should update campaign status from PAUSED to ACTIVE", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "adset_status_test",
          metaCampaignId: "campaign_status_test",
          metaAdSetId: "metaadset_test",
          metaAdId: "metaad_test",
          metaCreativeId: "creative_test",
          campaignName: "Status Test Campaign",
          status: "PAUSED",
        })
        .$returningId();

      // Update status to ACTIVE
      await db
        .update(metaPublishedAds)
        .set({ status: "ACTIVE", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [updated] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(updated.status).toBe("ACTIVE");
    });

    it("should update campaign status from ACTIVE to PAUSED", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "adset_pause_test",
          metaCampaignId: "campaign_pause_test",
          metaAdSetId: "metaadset_test",
          metaAdId: "metaad_test",
          metaCreativeId: "creative_test",
          campaignName: "Pause Test Campaign",
          status: "ACTIVE",
        })
        .$returningId();

      // Update status to PAUSED
      await db
        .update(metaPublishedAds)
        .set({ status: "PAUSED", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [updated] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(updated.status).toBe("PAUSED");
    });

    it("should mark campaign as DELETED", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "adset_delete_test",
          metaCampaignId: "campaign_delete_test",
          metaAdSetId: "metaadset_test",
          metaAdId: "metaad_test",
          metaCreativeId: "creative_test",
          campaignName: "Delete Test Campaign",
          status: "ACTIVE",
        })
        .$returningId();

      // Mark as DELETED
      await db
        .update(metaPublishedAds)
        .set({ status: "DELETED", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [updated] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(updated.status).toBe("DELETED");
    });
  });

  describe("Campaign Details Updates", () => {
    it("should update campaign name", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "adset_name_test",
          metaCampaignId: "campaign_name_test",
          metaAdSetId: "metaadset_test",
          metaAdId: "metaad_test",
          metaCreativeId: "creative_test",
          campaignName: "Old Campaign Name",
          status: "PAUSED",
        })
        .$returningId();

      // Update campaign name
      await db
        .update(metaPublishedAds)
        .set({ campaignName: "New Campaign Name", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [updated] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(updated.campaignName).toBe("New Campaign Name");
    });

    it("should update daily budget", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "adset_budget_test",
          metaCampaignId: "campaign_budget_test",
          metaAdSetId: "metaadset_test",
          metaAdId: "metaad_test",
          metaCreativeId: "creative_test",
          campaignName: "Budget Test Campaign",
          status: "PAUSED",
          dailyBudget: "10.00",
        })
        .$returningId();

      // Update daily budget
      await db
        .update(metaPublishedAds)
        .set({ dailyBudget: "20.00", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [updated] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(updated.dailyBudget).toBe("20.00");
    });
  });

  describe("Ad Status Badge Logic", () => {
    it("should return null status for unpublished ad (Draft)", async () => {
      // No published ad record exists for this adSetId
      const [found] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.adSetId, "unpublished_adset"))
        .limit(1);

      expect(found).toBeUndefined();
      // In UI, this would show "Draft" badge
    });

    it("should return ACTIVE status for published active ad", async () => {
      await db.insert(metaPublishedAds).values({
        userId: testUserId,
        adSetId: "active_adset",
        metaCampaignId: "campaign_active",
        metaAdSetId: "metaadset_active",
        metaAdId: "metaad_active",
        metaCreativeId: "creative_active",
        campaignName: "Active Campaign",
        status: "ACTIVE",
      });

      const [found] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.adSetId, "active_adset"))
        .limit(1);

      expect(found).toBeDefined();
      expect(found.status).toBe("ACTIVE");
      // In UI, this would show green "ACTIVE" badge with "View in Meta" link
    });

    it("should return PAUSED status for published paused ad", async () => {
      await db.insert(metaPublishedAds).values({
        userId: testUserId,
        adSetId: "paused_adset",
        metaCampaignId: "campaign_paused",
        metaAdSetId: "metaadset_paused",
        metaAdId: "metaad_paused",
        metaCreativeId: "creative_paused",
        campaignName: "Paused Campaign",
        status: "PAUSED",
      });

      const [found] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.adSetId, "paused_adset"))
        .limit(1);

      expect(found).toBeDefined();
      expect(found.status).toBe("PAUSED");
      // In UI, this would show yellow "PAUSED" badge with "View in Meta" link
    });
  });

  describe("Campaign Sync Tracking", () => {
    it("should update lastSyncedAt timestamp on status change", async () => {
      const [inserted] = await db
        .insert(metaPublishedAds)
        .values({
          userId: testUserId,
          adSetId: "sync_test_adset",
          metaCampaignId: "sync_test_campaign",
          metaAdSetId: "metaadset_sync",
          metaAdId: "metaad_sync",
          metaCreativeId: "creative_sync",
          campaignName: "Sync Test Campaign",
          status: "PAUSED",
        })
        .$returningId();

      const [before] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      const originalSyncTime = before.lastSyncedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update status
      await db
        .update(metaPublishedAds)
        .set({ status: "ACTIVE", lastSyncedAt: new Date() })
        .where(eq(metaPublishedAds.id, inserted.id));

      const [after] = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.id, inserted.id))
        .limit(1);

      expect(after.lastSyncedAt.getTime()).toBeGreaterThan(originalSyncTime.getTime());
    });
  });
});
