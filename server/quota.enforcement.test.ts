import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Quota Enforcement", () => {
  let testUserId: number;
  let testUserOpenId: string;

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

  it("should enforce trial tier quota limits", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, subscriptionTier: "trial" },
    } as any);

    // Trial tier: Headlines limit = 6
    // Generate 6 headlines (should succeed)
    for (let i = 0; i < 6; i++) {
      await caller.headlines.generate({
        targetMarket: "Test Market",
        pressingProblem: "Test Problem",
        desiredOutcome: "Test Outcome",
        uniqueMechanism: "Test Mechanism",
      });
    }

    // 7th generation should fail with quota exceeded error
    await expect(
      caller.headlines.generate({
        targetMarket: "Test Market",
        pressingProblem: "Test Problem",
        desiredOutcome: "Test Outcome",
        uniqueMechanism: "Test Mechanism",
      })
    ).rejects.toThrow("Quota exceeded");
  });

  it("should allow unlimited generations for agency tier", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Upgrade user to agency tier
    await db.update(users).set({ subscriptionTier: "agency" }).where(eq(users.id, testUserId));

    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, subscriptionTier: "agency" },
    } as any);

    // Agency tier: Unlimited (999)
    // Generate 10 headlines (should all succeed)
    for (let i = 0; i < 10; i++) {
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

    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, subscriptionTier: "pro" },
    } as any);

    // Generate 1 headline
    await caller.headlines.generate({
      targetMarket: "Test Market",
      pressingProblem: "Test Problem",
      desiredOutcome: "Test Outcome",
      uniqueMechanism: "Test Mechanism",
    });

    // Verify count = 1
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.headlineGeneratedCount).toBe(1);
  });
});
