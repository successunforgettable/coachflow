import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { upsertUser } from "./db";
import type { User } from "../drizzle/schema";

describe("Beast Mode Toggle", () => {
  let testUser: User;

  beforeAll(async () => {
    // Create test user
    testUser = await upsertUser({
      openId: "test-beast-mode-user",
      name: "Beast Mode Test User",
      email: "beastmode@test.com",
      loginMethod: "test",
    });
  });

  it("should toggle Beast Mode on", async () => {
    const caller = appRouter.createCaller({
      user: testUser,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.auth.toggleBeastMode({ enabled: true });
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it("should toggle Beast Mode off", async () => {
    const caller = appRouter.createCaller({
      user: testUser,
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
