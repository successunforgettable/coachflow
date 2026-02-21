import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, campaignAlerts, metaAccessTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Meta Alerts & Sync System", () => {
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const [user] = await db.insert(users).values({
      openId: `test-alerts-${Date.now()}`,
      name: "Test User",
      email: "test@example.com",
    });
    testUserId = user.insertId;
  });

  describe("Campaign Alerts", () => {
    it("should create a new alert", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: null, // Apply to all campaigns
        alertType: "ctr_drop",
        threshold: "2.5",
        enabled: true,
      });

      expect(alert.insertId).toBeGreaterThan(0);

      // Verify alert was created
      const [created] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(created).toBeDefined();
      expect(created.alertType).toBe("ctr_drop");
      expect(created.threshold).toBe("2.50");
      expect(created.enabled).toBe(true);
    });

    it("should create campaign-specific alert", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: "campaign_123",
        alertType: "cpc_exceed",
        threshold: "3.00",
        enabled: true,
      });

      const [created] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(created.metaCampaignId).toBe("campaign_123");
      expect(created.alertType).toBe("cpc_exceed");
    });

    it("should list all user alerts", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const alerts = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.userId, testUserId));

      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });

    it("should update alert enabled status", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: null,
        alertType: "spend_limit",
        threshold: "100.00",
        enabled: true,
      });

      // Disable alert
      await db
        .update(campaignAlerts)
        .set({ enabled: false })
        .where(eq(campaignAlerts.id, alert.insertId));

      const [updated] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(updated.enabled).toBe(false);
    });

    it("should update alert threshold", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: null,
        alertType: "low_impressions",
        threshold: "1000",
        enabled: true,
      });

      // Update threshold
      await db
        .update(campaignAlerts)
        .set({ threshold: "2000" })
        .where(eq(campaignAlerts.id, alert.insertId));

      const [updated] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(updated.threshold).toBe("2000.00");
    });

    it("should delete alert", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: null,
        alertType: "ctr_drop",
        threshold: "1.5",
        enabled: true,
      });

      // Delete alert
      await db.delete(campaignAlerts).where(eq(campaignAlerts.id, alert.insertId));

      const [deleted] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(deleted).toBeUndefined();
    });

    it("should track alert trigger history", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [alert] = await db.insert(campaignAlerts).values({
        userId: testUserId,
        metaCampaignId: null,
        alertType: "ctr_drop",
        threshold: "2.0",
        enabled: true,
      });

      // Simulate alert trigger
      const now = new Date();
      await db
        .update(campaignAlerts)
        .set({
          lastTriggeredAt: now,
          triggerCount: 1,
        })
        .where(eq(campaignAlerts.id, alert.insertId));

      const [updated] = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.id, alert.insertId))
        .limit(1);

      expect(updated.triggerCount).toBe(1);
      expect(updated.lastTriggeredAt).toBeDefined();
    });
  });

  describe("Campaign Status Sync", () => {
    it("should validate sync requires Meta connection", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user has Meta connection
      const [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      // Should not have connection for test user
      expect(connection).toBeUndefined();
    });

    it("should handle sync with no published ads", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { metaPublishedAds } = await import("../drizzle/schema");
      const publishedAds = await db
        .select()
        .from(metaPublishedAds)
        .where(eq(metaPublishedAds.userId, testUserId));

      expect(publishedAds.length).toBe(0);
    });
  });

  describe("Alert Type Validation", () => {
    it("should support all alert types", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const alertTypes = ["ctr_drop", "cpc_exceed", "spend_limit", "low_impressions"] as const;

      for (const type of alertTypes) {
        const [alert] = await db.insert(campaignAlerts).values({
          userId: testUserId,
          metaCampaignId: null,
          alertType: type,
          threshold: "10.00",
          enabled: true,
        });

        expect(alert.insertId).toBeGreaterThan(0);
      }

      const allAlerts = await db
        .select()
        .from(campaignAlerts)
        .where(eq(campaignAlerts.userId, testUserId));

      const types = allAlerts.map((a) => a.alertType);
      expect(types).toContain("ctr_drop");
      expect(types).toContain("cpc_exceed");
      expect(types).toContain("spend_limit");
      expect(types).toContain("low_impressions");
    });
  });
});
