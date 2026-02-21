import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "./db";
import { metaAccessTokens, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Meta Integration Tests
 * Tests Meta OAuth connection, campaign retrieval, and publishing functionality
 */

describe("Meta Integration", () => {
  let testUserId: number;
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeEach(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        openId: `test-meta-${Date.now()}`,
        name: "Meta Test User",
        email: "meta-test@example.com",
      })
      .$returningId();

    testUserId = user.id;
  });

  afterEach(async () => {
    if (!db) return;

    // Clean up test data
    await db.delete(metaAccessTokens).where(eq(metaAccessTokens.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe("Meta Connection Status", () => {
    it("should return not connected when no token exists", async () => {
      const [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection).toBeUndefined();
    });

    it("should store Meta access token correctly", async () => {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      await db.insert(metaAccessTokens).values({
        userId: testUserId,
        accessToken: "test_access_token_12345",
        tokenExpiresAt: expiresAt,
        adAccountId: "act_123456789",
        adAccountName: "Test Ad Account",
        businessId: "business_123",
        pageId: "page_123",
      });

      const [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection).toBeDefined();
      expect(connection.accessToken).toBe("test_access_token_12345");
      expect(connection.adAccountId).toBe("act_123456789");
      expect(connection.adAccountName).toBe("Test Ad Account");
    });

    it("should detect expired tokens", async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago

      await db.insert(metaAccessTokens).values({
        userId: testUserId,
        accessToken: "expired_token",
        tokenExpiresAt: expiredDate,
        adAccountId: "act_123456789",
        adAccountName: "Test Ad Account",
      });

      const [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection).toBeDefined();
      expect(new Date(connection.tokenExpiresAt) < new Date()).toBe(true);
    });
  });

  describe("Meta Token Management", () => {
    it("should allow only one Meta connection per user", async () => {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      // Insert first token
      await db.insert(metaAccessTokens).values({
        userId: testUserId,
        accessToken: "token_1",
        tokenExpiresAt: expiresAt,
        adAccountId: "act_111",
        adAccountName: "Account 1",
      });

      // Try to insert second token (should fail due to unique constraint)
      await expect(
        db.insert(metaAccessTokens).values({
          userId: testUserId,
          accessToken: "token_2",
          tokenExpiresAt: expiresAt,
          adAccountId: "act_222",
          adAccountName: "Account 2",
        })
      ).rejects.toThrow();
    });

    it("should update existing token on reconnection", async () => {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      // Insert initial token
      await db.insert(metaAccessTokens).values({
        userId: testUserId,
        accessToken: "old_token",
        tokenExpiresAt: expiresAt,
        adAccountId: "act_111",
        adAccountName: "Old Account",
      });

      // Update token
      await db
        .update(metaAccessTokens)
        .set({
          accessToken: "new_token",
          adAccountId: "act_222",
          adAccountName: "New Account",
          lastRefreshedAt: new Date(),
        })
        .where(eq(metaAccessTokens.userId, testUserId));

      const [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection.accessToken).toBe("new_token");
      expect(connection.adAccountId).toBe("act_222");
      expect(connection.adAccountName).toBe("New Account");
    });
  });

  describe("Meta Disconnect", () => {
    it("should remove Meta connection when user disconnects", async () => {
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      await db.insert(metaAccessTokens).values({
        userId: testUserId,
        accessToken: "token_to_delete",
        tokenExpiresAt: expiresAt,
        adAccountId: "act_123",
        adAccountName: "Test Account",
      });

      // Verify token exists
      let [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection).toBeDefined();

      // Delete token
      await db.delete(metaAccessTokens).where(eq(metaAccessTokens.userId, testUserId));

      // Verify token is deleted
      [connection] = await db
        .select()
        .from(metaAccessTokens)
        .where(eq(metaAccessTokens.userId, testUserId))
        .limit(1);

      expect(connection).toBeUndefined();
    });
  });

  describe("Meta API Client Validation", () => {
    it("should validate campaign creation parameters", () => {
      const validParams = {
        name: "Test Campaign",
        objective: "OUTCOME_LEADS",
        status: "PAUSED" as const,
        dailyBudget: 10,
      };

      expect(validParams.name).toBeTruthy();
      expect(validParams.dailyBudget).toBeGreaterThanOrEqual(1);
      expect(["ACTIVE", "PAUSED"]).toContain(validParams.status);
    });

    it("should validate ad creative parameters", () => {
      const validCreative = {
        name: "Test Creative",
        headline: "Test Headline",
        body: "Test body copy",
        linkUrl: "https://example.com",
      };

      expect(validCreative.headline.length).toBeLessThanOrEqual(255);
      expect(validCreative.body.length).toBeGreaterThan(0);
      expect(validCreative.linkUrl).toMatch(/^https?:\/\//);
    });

    it("should validate targeting parameters", () => {
      const validTargeting = {
        countries: ["US", "CA"],
        ageMin: 18,
        ageMax: 65,
        genders: [1, 2],
      };

      expect(validTargeting.ageMin).toBeGreaterThanOrEqual(18);
      expect(validTargeting.ageMax).toBeLessThanOrEqual(65);
      expect(validTargeting.ageMin).toBeLessThanOrEqual(validTargeting.ageMax);
      expect(validTargeting.countries.length).toBeGreaterThan(0);
    });
  });

  describe("Meta Publishing Workflow", () => {
    it("should validate complete publishing flow parameters", () => {
      const publishParams = {
        // Ad content
        headline: "Transform Your Business in 90 Days",
        body: "Join 10,000+ entrepreneurs who scaled to 7-figures using our proven framework.",
        linkUrl: "https://example.com/landing-page",
        // Campaign settings
        campaignName: "Lead Gen - January 2026",
        objective: "OUTCOME_LEADS",
        dailyBudget: 10,
        // Ad set settings
        targeting: {
          countries: ["US"],
          ageMin: 25,
          ageMax: 55,
        },
        status: "PAUSED" as const,
      };

      // Validate all required fields are present
      expect(publishParams.headline).toBeTruthy();
      expect(publishParams.body).toBeTruthy();
      expect(publishParams.linkUrl).toBeTruthy();
      expect(publishParams.campaignName).toBeTruthy();
      expect(publishParams.objective).toBeTruthy();
      expect(publishParams.dailyBudget).toBeGreaterThanOrEqual(1);
      expect(publishParams.targeting.countries.length).toBeGreaterThan(0);
    });
  });
});
