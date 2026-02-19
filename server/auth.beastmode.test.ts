import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(beastMode = false): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-beast-mode-user",
    email: "beastmode@test.com",
    name: "Beast Mode Test User",
    loginMethod: "test",
    role: "user",
    beastMode,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Beast Mode Toggle", () => {
  it("should toggle Beast Mode on", async () => {
    const ctx = createAuthContext(false);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.toggleBeastMode({ enabled: true });
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it("should toggle Beast Mode off", async () => {
    const ctx = createAuthContext(true);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.toggleBeastMode({ enabled: false });
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
  });

  it("should require authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.toggleBeastMode({ enabled: true })
    ).rejects.toThrow("Not authenticated");
  });
});
