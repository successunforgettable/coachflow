import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { mockLLMResponses, resetLLMMocks } from "./__mocks__/llm";

describe("Quota Enforcement", () => {
  let testUserId: number;
  let testUserOpenId: string;

  beforeAll(async () => {
    // Setup LLM mocks for all tests
    await mockLLMResponses();
  });

  afterAll(() => {
    // Clean up mocks
    resetLLMMocks();
  });

  beforeEach(async () => {
    // Create test user with trial tier
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    testUserOpenId = `test-quota-${Date.now()}`;
    const [user] = await db.insert(users).values({
      openId: testUserOpenId,
      name: "Test Quota User",
      email: `test-quota-${Date.now()}@example.com`,
      subscriptionTier: "trial",
      headlineGeneratedCount: 0,
      hvcoGeneratedCount: 0,
      heroMechanismGeneratedCount: 0,
      icpGeneratedCount: 0,
      adCopyGeneratedCount: 0,
      emailSeqGeneratedCount: 0,
      whatsappSeqGeneratedCount: 0,
      landingPageGeneratedCount: 0,
      offerGeneratedCount: 0,
    }).$returningId();

    testUserId = user.id;
  });

  it("should enforce trial tier quota limits", { timeout: 30000 }, async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Trial tier: Headlines limit = 6
    // Generate 6 headlines (should succeed)
    for (let i = 0; i < 6; i++) {
      // Fetch fresh user data from database to get updated count
      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });
      
      await caller.headlines.generate({
        targetMarket: "Test Market",
        pressingProblem: "Test Problem",
        desiredOutcome: "Test Outcome",
        uniqueMechanism: "Test Mechanism",
      });
    }

    // 7th generation should fail with quota exceeded error
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    const caller = appRouter.createCaller({
      user,
      req: {} as any,
      res: {} as any,
    });
    
    await expect(
      caller.headlines.generate({
        targetMarket: "Test Market",
        pressingProblem: "Test Problem",
        desiredOutcome: "Test Outcome",
        uniqueMechanism: "Test Mechanism",
      })
    ).rejects.toThrow("You've reached your monthly limit");
  });

  it("should allow unlimited generations for agency tier", { timeout: 30000 }, async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Upgrade user to agency tier
    await db.update(users).set({ subscriptionTier: "agency" }).where(eq(users.id, testUserId));

    // Agency tier: Unlimited (999)
    // Generate 10 headlines (should all succeed)
    for (let i = 0; i < 10; i++) {
      // Fetch fresh user data from database to get updated count
      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
        req: {} as any,
        res: {} as any,
      });
      
      await caller.headlines.generate({
        targetMarket: "Test Market",
        pressingProblem: "Test Problem",
        desiredOutcome: "Test Outcome",
        uniqueMechanism: "Test Mechanism",
      });
    }

    // Verify count increased
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.headlineGeneratedCount).toBe(10);
  });

  it("should increment quota count after each generation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Fetch fresh user data from database
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    const caller = appRouter.createCaller({
      user,
      req: {} as any,
      res: {} as any,
    });

    // Generate 1 headline
    await caller.headlines.generate({
      targetMarket: "Test Market",
      pressingProblem: "Test Problem",
      desiredOutcome: "Test Outcome",
      uniqueMechanism: "Test Mechanism",
    });

    // Verify count = 1
    const [updatedUser] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(updatedUser.headlineGeneratedCount).toBe(1);
  });
});
