import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { userOnboarding } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Onboarding Router Tests
 * 
 * Tests for the onboarding wizard system:
 * - getStatus: Retrieve onboarding status for a user (auto-creates with currentStep=1 if not exists)
 * - updateStep: Update current step and save progress data
 * - complete: Mark onboarding as completed
 * - reset: Reset onboarding to initial state
 */

describe("Onboarding Router", () => {
  let testUserId: number;
  let mockUser: any;
  let mockContext: any;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const { users } = await import("../drizzle/schema");
    const userResult: any = await db.insert(users).values({
      openId: `test-onboarding-${Date.now()}`,
      name: "Test Onboarding User",
      email: "test-onboarding@example.com",
    });
    testUserId = userResult[0].insertId;

    mockUser = {
      id: testUserId,
      openId: `test-onboarding-${Date.now()}`,
      name: "Test Onboarding User",
      email: "test-onboarding@example.com",
      role: "user" as const,
      subscriptionTier: "trial" as const,
      subscriptionStatus: "active" as const,
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    mockContext = {
      user: mockUser,
      db,
    };
    
    // Clean up test data
    await db.delete(userOnboarding).where(eq(userOnboarding.userId, mockUser.id));
  });

  const getCaller = () => appRouter.createCaller(mockContext as any);

  describe("getStatus", () => {
    it("should auto-create onboarding record with currentStep=1 for new user", async () => {
      const caller = getCaller();
      const status = await caller.onboarding.getStatus();

      expect(status.completed).toBe(false);
      expect(status.currentStep).toBe(1); // Auto-created with step 1
      expect(status.serviceId).toBe(null);
      expect(status.icpId).toBe(null);
      expect(status.headlineSetId).toBe(null);
    });

    it("should return existing onboarding status", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Create onboarding record
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 3,
        serviceId: 123,
        icpId: "icp-456",
        headlineSetId: null,
      });

      const caller = getCaller();
      const status = await caller.onboarding.getStatus();

      expect(status.completed).toBe(false);
      expect(status.currentStep).toBe(3);
      expect(status.serviceId).toBe(123);
      expect(status.icpId).toBe("icp-456");
    });

    it("should return completed status", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: true,
        currentStep: 5,
        serviceId: 123,
        icpId: "icp-456",
        headlineSetId: "headline-789",
      });

      const caller = getCaller();
      const status = await caller.onboarding.getStatus();

      expect(status.completed).toBe(true);
      expect(status.currentStep).toBe(5);
    });
  });

  describe("updateStep", () => {
    it("should update current step", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Create initial record
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 1,
      });

      const caller = getCaller();
      await caller.onboarding.updateStep({
        step: 2,
        data: {},
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.currentStep).toBe(2);
    });

    it("should update serviceId", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 1,
      });

      const caller = getCaller();
      await caller.onboarding.updateStep({
        step: 2,
        data: {
          serviceId: 456,
        },
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.serviceId).toBe(456);
    });

    it("should update icpId", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 2,
        serviceId: 456,
      });

      const caller = getCaller();
      await caller.onboarding.updateStep({
        step: 3,
        data: {
          icpId: "icp-xyz",
        },
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.icpId).toBe("icp-xyz");
    });

    it("should update headlineSetId", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 3,
        serviceId: 456,
        icpId: "icp-xyz",
      });

      const caller = getCaller();
      await caller.onboarding.updateStep({
        step: 4,
        data: {
          headlineSetId: "headline-123",
        },
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.headlineSetId).toBe("headline-123");
    });

    it("should update multiple fields at once", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 1,
      });

      const caller = getCaller();
      await caller.onboarding.updateStep({
        step: 4,
        data: {
          serviceId: 789,
          icpId: "icp-new",
          headlineSetId: "headline-new",
        },
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.currentStep).toBe(4);
      expect(record?.serviceId).toBe(789);
      expect(record?.icpId).toBe("icp-new");
      expect(record?.headlineSetId).toBe("headline-new");
    });
  });

  describe("complete", () => {
    it("should mark onboarding as completed", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 4,
        serviceId: 123,
        icpId: "icp-456",
        headlineSetId: "headline-789",
      });

      const caller = getCaller();
      await caller.onboarding.complete({});

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.completed).toBe(true);
      expect(record?.completedAt).toBeDefined();
    });

    it("should save final data when completing", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 4,
      });

      const caller = getCaller();
      await caller.onboarding.complete({
        serviceId: 999,
        icpId: "icp-final",
        headlineSetId: "headline-final",
        campaignId: 888,
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.completed).toBe(true);
      expect(record?.serviceId).toBe(999);
      expect(record?.icpId).toBe("icp-final");
      expect(record?.headlineSetId).toBe("headline-final");
      expect(record?.campaignId).toBe(888);
    });

    it("should allow marking as skipped", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: false,
        currentStep: 1,
      });

      const caller = getCaller();
      await caller.onboarding.complete({
        skipped: true,
      });

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.completed).toBe(true);
      expect(record?.skipped).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset onboarding to initial state", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(userOnboarding).values({
        userId: mockUser.id,
        completed: true,
        currentStep: 5,
        serviceId: 123,
        icpId: "icp-456",
        headlineSetId: "headline-789",
        skipped: false,
      });

      const caller = getCaller();
      await caller.onboarding.reset();

      const [record] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, mockUser.id))
        .limit(1);

      expect(record?.completed).toBe(false);
      expect(record?.currentStep).toBe(1);
      expect(record?.serviceId).toBe(null);
      expect(record?.icpId).toBe(null);
      expect(record?.headlineSetId).toBe(null);
      expect(record?.completedAt).toBe(null);
    });
  });

  describe("Integration: Full onboarding flow", () => {
    it("should complete full onboarding wizard flow", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const caller = getCaller();
      
      // Step 1: Get status (auto-creates with step 1)
      let status = await caller.onboarding.getStatus();
      expect(status.completed).toBe(false);
      expect(status.currentStep).toBe(1);

      // Step 2: Create Service (move to step 2)
      await caller.onboarding.updateStep({
        step: 2,
        data: {
          serviceId: 111,
        },
      });

      status = await caller.onboarding.getStatus();
      expect(status.currentStep).toBe(2);
      expect(status.serviceId).toBe(111);

      // Step 3: Generate ICP (move to step 3)
      await caller.onboarding.updateStep({
        step: 3,
        data: {
          icpId: "icp-flow-test",
        },
      });

      status = await caller.onboarding.getStatus();
      expect(status.currentStep).toBe(3);
      expect(status.icpId).toBe("icp-flow-test");

      // Step 4: Generate Headlines (move to step 4)
      await caller.onboarding.updateStep({
        step: 4,
        data: {
          headlineSetId: "headline-flow-test",
        },
      });

      status = await caller.onboarding.getStatus();
      expect(status.currentStep).toBe(4);
      expect(status.headlineSetId).toBe("headline-flow-test");

      // Step 5: Create Campaign (move to step 5)
      await caller.onboarding.updateStep({
        step: 5,
        data: {
          campaignId: 222,
        },
      });

      status = await caller.onboarding.getStatus();
      expect(status.currentStep).toBe(5);
      expect(status.campaignId).toBe(222);

      // Complete onboarding
      await caller.onboarding.complete({});

      status = await caller.onboarding.getStatus();
      expect(status.completed).toBe(true);
      expect(status.serviceId).toBe(111);
      expect(status.icpId).toBe("icp-flow-test");
      expect(status.headlineSetId).toBe("headline-flow-test");
      expect(status.campaignId).toBe(222);
    });
  });
});
