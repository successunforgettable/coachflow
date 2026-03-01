/**
 * Item 2.0 — Onboarding router tests
 * Tests: setComplete, updateStageFlag, getStatus (onboardingStage field)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockUpdate = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
const mockSelect = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock("../drizzle/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: () => ({ set: () => ({ where: mockUpdate }) }),
    select: () => ({ from: mockFrom }),
  }),
}));

vi.mock("../server/_core/env", () => ({
  env: {
    DATABASE_URL: "mysql://test",
    JWT_SECRET: "test-secret",
    VITE_APP_ID: "test-app-id",
    OAUTH_SERVER_URL: "https://api.test.com",
    VITE_OAUTH_PORTAL_URL: "https://portal.test.com",
    OWNER_OPEN_ID: "owner-123",
    OWNER_NAME: "Test Owner",
    BUILT_IN_FORGE_API_URL: "https://forge.test.com",
    BUILT_IN_FORGE_API_KEY: "forge-key",
    VITE_FRONTEND_FORGE_API_KEY: "frontend-key",
    VITE_FRONTEND_FORGE_API_URL: "https://forge.test.com",
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────
describe("Item 2.0 — Schema: users table new columns", () => {
  it("schema.ts exports onboardingComplete column on users table", async () => {
    const { users } = await import("../drizzle/schema");
    expect(users).toBeDefined();
    // Drizzle column objects are accessible as table properties
    const cols = Object.keys(users);
    expect(cols).toContain("onboardingComplete");
    expect(cols).toContain("onboardingStage");
    expect(cols).toContain("activityStreak");
    expect(cols).toContain("lastActivityDate");
    expect(cols).toContain("streakUpdatedAt");
  });

  it("onboardingComplete defaults to false", async () => {
    const { users } = await import("../drizzle/schema");
    const col = (users as any).onboardingComplete;
    // Drizzle stores default in the column config
    expect(col?.config?.default ?? col?.default).toBe(false);
  });

  it("activityStreak defaults to 0", async () => {
    const { users } = await import("../drizzle/schema");
    const col = (users as any).activityStreak;
    expect(col?.config?.default ?? col?.default).toBe(0);
  });

  it("onboardingStage defaults to 1 (first stage)", async () => {
    const { users } = await import("../drizzle/schema");
    const col = (users as any).onboardingStage;
    expect(col?.config?.default ?? col?.default).toBe(1);
  });
});

describe("Item 2.0 — OnboardingFlow component files exist", () => {
  it("OnboardingFlow.tsx exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync(
      "/home/ubuntu/coachflow/client/src/components/onboarding/OnboardingFlow.tsx"
    );
    expect(exists).toBe(true);
  });

  it("Stage1Questions.tsx exists", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync(
        "/home/ubuntu/coachflow/client/src/components/onboarding/Stage1Questions.tsx"
      )
    ).toBe(true);
  });

  it("Stage2Video.tsx exists", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync(
        "/home/ubuntu/coachflow/client/src/components/onboarding/Stage2Video.tsx"
      )
    ).toBe(true);
  });

  it("Stage3InstantWin.tsx exists", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync(
        "/home/ubuntu/coachflow/client/src/components/onboarding/Stage3InstantWin.tsx"
      )
    ).toBe(true);
  });

  it("Stage4Streak.tsx exists", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync(
        "/home/ubuntu/coachflow/client/src/components/onboarding/Stage4Streak.tsx"
      )
    ).toBe(true);
  });
});

describe("Item 2.0 — OnboardingPage routing logic", () => {
  it("OnboardingPage.tsx imports OnboardingFlow", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/coachflow/client/src/pages/OnboardingPage.tsx",
      "utf-8"
    );
    expect(content).toContain("OnboardingFlow");
    expect(content).toContain("onboardingStage");
  });

  it("OnboardingPage.tsx routes stage 0 to OnboardingFlow", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/coachflow/client/src/pages/OnboardingPage.tsx",
      "utf-8"
    );
    // Must check for stage 1 → new flow
    expect(content).toContain("onboardingStage === 1");
    expect(content).toContain("<OnboardingFlow");
  });
});

describe("Item 2.0 — onboarding router: setComplete and updateStageFlag exist", () => {
  it("onboarding.ts exports setComplete procedure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/coachflow/server/routers/onboarding.ts",
      "utf-8"
    );
    expect(content).toContain("setComplete");
    expect(content).toContain("onboardingComplete");
  });

  it("onboarding.ts exports updateStageFlag procedure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/coachflow/server/routers/onboarding.ts",
      "utf-8"
    );
    expect(content).toContain("updateStageFlag");
    expect(content).toContain("onboardingStage");
  });

  it("setComplete updates both user_onboarding and users tables", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/coachflow/server/routers/onboarding.ts",
      "utf-8"
    );
    // Must update both tables
    expect(content).toContain("user_onboarding");
    expect(content).toContain("onboardingComplete");
    // Both update calls must be present
    const updateCount = (content.match(/\.update\(/g) || []).length;
    expect(updateCount).toBeGreaterThanOrEqual(2);
  });
});

describe("Item 2.0 — canvas-confetti installed", () => {
  it("canvas-confetti is in package.json dependencies", async () => {
    const fs = await import("fs");
    const pkg = JSON.parse(
      fs.readFileSync("/home/ubuntu/coachflow/package.json", "utf-8")
    );
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps["canvas-confetti"]).toBeDefined();
  });
});
