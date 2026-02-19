import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, campaigns, campaignAssets, campaignLinks } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { mockLLMResponses } from "./__mocks__/llm";

describe("Campaigns Router", () => {
  let testUserId: number;
  let testCampaignId: number;

  beforeEach(async () => {
    await mockLLMResponses();

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const [result] = await db.insert(users).values({
      openId: `test-campaigns-${Date.now()}`,
      email: "test-campaigns@example.com",
      name: "Test Campaigns User",
      loginMethod: "email",
      subscriptionTier: "pro",
    });

    testUserId = result.insertId;
  });

  describe("Campaign CRUD", () => {
    it("should create a new campaign", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.campaigns.create({
        name: "Test Campaign",
        description: "Test Description",
        status: "draft",
      });

      expect(result.id).toBeTypeOf("number");
      testCampaignId = result.id;

      // Verify in database
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId));

      expect(campaign.name).toBe("Test Campaign");
      expect(campaign.description).toBe("Test Description");
      expect(campaign.status).toBe("draft");
    });

    it("should list user campaigns", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create test campaign
      const [result] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Test Campaign 1",
        status: "draft",
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const list = await caller.campaigns.list();

      expect(list.length).toBeGreaterThan(0);
      expect(list[0].name).toBe("Test Campaign 1");
    });

    it("should get campaign by ID with assets and links", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create campaign
      const [campaignResult] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Test Campaign",
        status: "draft",
      });

      testCampaignId = campaignResult.insertId;

      // Add asset
      await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "test-headline-set-id",
        position: 0,
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const campaign = await caller.campaigns.getById({ id: testCampaignId });

      expect(campaign.name).toBe("Test Campaign");
      expect(campaign.assets.length).toBe(1);
      expect(campaign.assets[0].assetType).toBe("headline");
    });

    it("should update campaign", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create campaign
      const [campaignResult] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Original Name",
        status: "draft",
      });

      testCampaignId = campaignResult.insertId;

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      await caller.campaigns.update({
        id: testCampaignId,
        name: "Updated Name",
        status: "active",
      });

      // Verify update
      const [updated] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId));

      expect(updated.name).toBe("Updated Name");
      expect(updated.status).toBe("active");
    });

    it("should delete campaign with assets and links", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create campaign
      const [campaignResult] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "To Delete",
        status: "draft",
      });

      testCampaignId = campaignResult.insertId;

      // Add asset
      const [assetResult] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "test-headline",
        position: 0,
      });

      // Add link
      await db.insert(campaignLinks).values({
        campaignId: testCampaignId,
        sourceAssetId: assetResult.insertId,
        targetAssetId: assetResult.insertId,
        linkType: "leads_to",
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      await caller.campaigns.delete({ id: testCampaignId });

      // Verify deletion
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, testCampaignId));

      expect(campaign).toBeUndefined();

      // Verify assets deleted
      const assets = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.campaignId, testCampaignId));

      expect(assets.length).toBe(0);

      // Verify links deleted
      const links = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.campaignId, testCampaignId));

      expect(links.length).toBe(0);
    });

    it("should duplicate campaign with assets and links", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create campaign
      const [campaignResult] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Original Campaign",
        description: "Original Description",
        status: "active",
      });

      testCampaignId = campaignResult.insertId;

      // Add 2 assets
      const [asset1] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "headline-1",
        position: 0,
      });

      const [asset2] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "ad_copy",
        assetId: "ad-copy-1",
        position: 1,
      });

      // Add link between assets
      await db.insert(campaignLinks).values({
        campaignId: testCampaignId,
        sourceAssetId: asset1.insertId,
        targetAssetId: asset2.insertId,
        linkType: "leads_to",
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.campaigns.duplicate({ id: testCampaignId });

      // Verify new campaign created
      const [newCampaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, result.id));

      expect(newCampaign.name).toBe("Original Campaign (Copy)");
      expect(newCampaign.description).toBe("Original Description");
      expect(newCampaign.status).toBe("draft");

      // Verify assets copied
      const newAssets = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.campaignId, result.id));

      expect(newAssets.length).toBe(2);

      // Verify links copied
      const newLinks = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.campaignId, result.id));

      expect(newLinks.length).toBe(1);
    });
  });

  describe("Asset Management", () => {
    beforeEach(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create test campaign
      const [result] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Test Campaign",
        status: "draft",
      });

      testCampaignId = result.insertId;
    });

    it("should add asset to campaign", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.campaigns.addAsset({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "test-headline-set",
        position: 0,
        notes: "Test notes",
      });

      expect(result.assetId).toBeTypeOf("number");

      // Verify in database
      const [asset] = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.id, result.assetId));

      expect(asset.assetType).toBe("headline");
      expect(asset.assetId).toBe("test-headline-set");
      expect(asset.notes).toBe("Test notes");
    });

    it("should remove asset from campaign", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Add asset
      const [assetResult] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "test-headline",
        position: 0,
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      await caller.campaigns.removeAsset({ assetId: assetResult.insertId });

      // Verify deletion
      const [asset] = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.id, assetResult.insertId));

      expect(asset).toBeUndefined();
    });

    it("should reorder assets", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Add 3 assets
      const [asset1] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "headline-1",
        position: 0,
      });

      const [asset2] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "ad_copy",
        assetId: "ad-copy-1",
        position: 1,
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      // Swap positions
      await caller.campaigns.reorderAssets({
        updates: [
          { assetId: asset1.insertId, position: 1 },
          { assetId: asset2.insertId, position: 0 },
        ],
      });

      // Verify new positions
      const [updatedAsset1] = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.id, asset1.insertId));

      const [updatedAsset2] = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.id, asset2.insertId));

      expect(updatedAsset1.position).toBe(1);
      expect(updatedAsset2.position).toBe(0);
    });
  });

  describe("Link Management", () => {
    let asset1Id: number;
    let asset2Id: number;

    beforeEach(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create campaign
      const [campaignResult] = await db.insert(campaigns).values({
        userId: testUserId,
        name: "Test Campaign",
        status: "draft",
      });

      testCampaignId = campaignResult.insertId;

      // Add 2 assets
      const [asset1] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "headline",
        assetId: "headline-1",
        position: 0,
      });

      const [asset2] = await db.insert(campaignAssets).values({
        campaignId: testCampaignId,
        assetType: "ad_copy",
        assetId: "ad-copy-1",
        position: 1,
      });

      asset1Id = asset1.insertId;
      asset2Id = asset2.insertId;
    });

    it("should create link between assets", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.campaigns.linkAssets({
        campaignId: testCampaignId,
        sourceAssetId: asset1Id,
        targetAssetId: asset2Id,
        linkType: "leads_to",
      });

      expect(result.linkId).toBeTypeOf("number");

      // Verify in database
      const [link] = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.id, result.linkId));

      expect(link.sourceAssetId).toBe(asset1Id);
      expect(link.targetAssetId).toBe(asset2Id);
      expect(link.linkType).toBe("leads_to");
    });

    it("should delete link between assets", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create link
      const [linkResult] = await db.insert(campaignLinks).values({
        campaignId: testCampaignId,
        sourceAssetId: asset1Id,
        targetAssetId: asset2Id,
        linkType: "leads_to",
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      await caller.campaigns.unlinkAssets({ linkId: linkResult.insertId });

      // Verify deletion
      const [link] = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.id, linkResult.insertId));

      expect(link).toBeUndefined();
    });

    it("should delete links when asset is removed", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Create link
      await db.insert(campaignLinks).values({
        campaignId: testCampaignId,
        sourceAssetId: asset1Id,
        targetAssetId: asset2Id,
        linkType: "leads_to",
      });

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });

      // Remove asset
      await caller.campaigns.removeAsset({ assetId: asset1Id });

      // Verify link deleted
      const links = await db
        .select()
        .from(campaignLinks)
        .where(eq(campaignLinks.campaignId, testCampaignId));

      expect(links.length).toBe(0);
    });
  });
});
