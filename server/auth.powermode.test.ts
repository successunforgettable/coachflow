import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Power Mode Toggle", () => {
  let testUserId: number;
  let testUserOpenId: string;

  beforeEach(async () => {
    // Create test user directly in database
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    testUserOpenId = `test-beast-mode-${Date.now()}`;
    const [user] = await db.insert(users).values({
      openId: testUserOpenId,
      name: "Power Mode Test User",
      email: `beastmode-${Date.now()}@test.com`,
      subscriptionTier: "trial",
      powerMode: false,
    }).$returningId();

    testUserId = user.id;
  });

  it("should toggle Power Mode on", async () => {
    // Fetch fresh user from database
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    
    const caller = appRouter.createCaller({
      user,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.auth.toggleBeastMode({ enabled: true });
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it("should toggle Power Mode off", async () => {
    // Fetch fresh user from database
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    
    const caller = appRouter.createCaller({
      user,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.auth.toggleBeastMode({ enabled: false });
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
  });

  it("should require authentication", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      caller.auth.toggleBeastMode({ enabled: true })
    ).rejects.toThrow("Not authenticated");
  });
});
