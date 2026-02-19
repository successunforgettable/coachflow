import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Mock the LLM API to return valid JSON responses
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async ({ messages }) => {
    const userMessage = messages.find((m: any) => m.role === "user");
    const content = typeof userMessage?.content === "string" ? userMessage.content : "";
    
    // Detect formula type from the prompt
    let mockResponse;
    if (content.includes("eyebrow") || content.includes("Eyebrow")) {
      mockResponse = JSON.stringify([
        { eyebrow: "Test", main: "Mock Headline 1", sub: "Mock Sub 1" },
        { eyebrow: "Test", main: "Mock Headline 2", sub: "Mock Sub 2" },
        { eyebrow: "Test", main: "Mock Headline 3", sub: "Mock Sub 3" },
        { eyebrow: "Test", main: "Mock Headline 4", sub: "Mock Sub 4" },
        { eyebrow: "Test", main: "Mock Headline 5", sub: "Mock Sub 5" },
      ]);
    } else if (content.includes("authority") || content.includes("Authority")) {
      mockResponse = JSON.stringify([
        { main: "Mock Authority Headline 1", sub: "Mock Sub 1" },
        { main: "Mock Authority Headline 2", sub: "Mock Sub 2" },
        { main: "Mock Authority Headline 3", sub: "Mock Sub 3" },
        { main: "Mock Authority Headline 4", sub: "Mock Sub 4" },
        { main: "Mock Authority Headline 5", sub: "Mock Sub 5" },
      ]);
    } else {
      // Default: simple string array for story, urgency, etc.
      mockResponse = JSON.stringify([
        "Mock Headline 1",
        "Mock Headline 2",
        "Mock Headline 3",
        "Mock Headline 4",
        "Mock Headline 5",
      ]);
    }
    
    return {
      choices: [
        {
          message: {
            role: "assistant" as const,
            content: mockResponse,
          },
        },
      ],
    };
  }),
}));

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

  it("should enforce trial tier quota limits", { timeout: 30000 }, async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Trial tier: Headlines limit = 6
    // Generate 6 headlines (should succeed)
    for (let i = 0; i < 6; i++) {
      // Fetch fresh user from database to get updated count
      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      const caller = appRouter.createCaller({
        user,
      } as any);
      
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
    } as any);
    
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
