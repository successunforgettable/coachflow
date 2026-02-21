import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { users, bannedPhrases, complianceVersions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Compliance Router", () => {
  let adminUserId: number;
  let regularUserId: number;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create admin user
    const [adminResult] = await db.insert(users).values({
      name: "Admin User",
      email: `admin-${Date.now()}@test.com`,
      openId: `admin-${Date.now()}`,
      role: "admin",
      subscriptionTier: "trial",
      powerMode: false,
    });
    adminUserId = adminResult.insertId;

    // Create regular user
    const [regularResult] = await db.insert(users).values({
      name: "Regular User",
      email: `user-${Date.now()}@test.com`,
      openId: `user-${Date.now()}`,
      role: "user",
      subscriptionTier: "trial",
      powerMode: false,
    });
    regularUserId = regularResult.insertId;

    // Create initial compliance version
    await db.insert(complianceVersions).values({
      version: "v1.0",
      lastUpdated: new Date("2026-02-21"),
      nextReviewDue: new Date("2026-05-21"),
      notes: "Initial version",
    });
  });

  describe("adminProcedure middleware", () => {
    it("should allow admin users to access compliance endpoints", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const phrases = await caller.compliance.listPhrases();
      expect(phrases).toBeDefined();
      expect(Array.isArray(phrases)).toBe(true);
    });

    it("should reject non-admin users from accessing compliance endpoints", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [regularUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, regularUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: regularUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(caller.compliance.listPhrases()).rejects.toThrow("Admin access required");
    });
  });

  describe("addPhrase", () => {
    it("should add a new critical banned phrase", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.compliance.addPhrase({
        phrase: "test banned phrase",
        category: "critical",
        description: "Test description",
        suggestion: "Test suggestion",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Verify phrase was added
      const phrases = await caller.compliance.listPhrases();
      const addedPhrase = phrases.find((p) => p.phrase === "test banned phrase");
      expect(addedPhrase).toBeDefined();
      expect(addedPhrase?.category).toBe("critical");
      expect(addedPhrase?.active).toBe(true);
    });

    it("should add a new warning banned phrase", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.compliance.addPhrase({
        phrase: "warning test phrase",
        category: "warning",
        description: "Warning description",
        suggestion: "Warning suggestion",
      });

      expect(result.success).toBe(true);

      // Verify phrase was added
      const phrases = await caller.compliance.listPhrases();
      const addedPhrase = phrases.find((p) => p.phrase === "warning test phrase");
      expect(addedPhrase).toBeDefined();
      expect(addedPhrase?.category).toBe("warning");
    });
  });

  describe("updatePhrase", () => {
    it("should update an existing banned phrase", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      // Add a phrase first
      const addResult = await caller.compliance.addPhrase({
        phrase: "original phrase",
        category: "critical",
        description: "Original description",
        suggestion: "Original suggestion",
      });

      // Update the phrase
      const updateResult = await caller.compliance.updatePhrase({
        id: addResult.id,
        phrase: "updated phrase",
        category: "warning",
        description: "Updated description",
        suggestion: "Updated suggestion",
        active: false,
      });

      expect(updateResult.success).toBe(true);

      // Verify phrase was updated
      const phrases = await caller.compliance.listPhrases();
      const updatedPhrase = phrases.find((p) => p.id === addResult.id);
      expect(updatedPhrase).toBeDefined();
      expect(updatedPhrase?.phrase).toBe("updated phrase");
      expect(updatedPhrase?.category).toBe("warning");
      expect(updatedPhrase?.active).toBe(false);
    });
  });

  describe("deletePhrase", () => {
    it("should delete a banned phrase", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      // Add a phrase first
      const addResult = await caller.compliance.addPhrase({
        phrase: "phrase to delete",
        category: "critical",
        description: "Description",
        suggestion: "Suggestion",
      });

      // Delete the phrase
      const deleteResult = await caller.compliance.deletePhrase({
        id: addResult.id,
      });

      expect(deleteResult.success).toBe(true);

      // Verify phrase was deleted
      const phrases = await caller.compliance.listPhrases();
      const deletedPhrase = phrases.find((p) => p.id === addResult.id);
      expect(deletedPhrase).toBeUndefined();
    });
  });

  describe("getVersion", () => {
    it("should return current compliance version", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const version = await caller.compliance.getVersion();
      expect(version).toBeDefined();
      expect(version?.version).toBe("v1.0");
      expect(version?.notes).toBe("Initial version");
    });
  });

  describe("updateVersion", () => {
    it("should increment compliance version", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, adminUserId))
        .limit(1);

      const caller = appRouter.createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.compliance.updateVersion({
        notes: "Updated for Q2 2026",
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe("v1.1");

      // Verify version was updated
      const version = await caller.compliance.getVersion();
      expect(version?.version).toBe("v1.1");
      expect(version?.notes).toBe("Updated for Q2 2026");
    });
  });
});
