import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Admin Router", () => {
  describe("adminProcedure middleware", () => {
    it("should allow admin users to access admin endpoints", async () => {
      const mockContext: TrpcContext = {
        user: {
          id: 1,
          openId: "admin-open-id",
          name: "Admin User",
          email: "admin@coachflow.com",
          role: "admin",
          subscriptionTier: "agency",
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          powerMode: false,
          createdAt: new Date(),
          usageResetAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(mockContext);

      // Should not throw error for admin user
      await expect(caller.admin.getAnalytics()).resolves.toBeDefined();
    });

    it("should block non-admin users from accessing admin endpoints", async () => {
      const mockContext: TrpcContext = {
        user: {
          id: 2,
          openId: "user-open-id",
          name: "Regular User",
          email: "user@coachflow.com",
          role: "user",
          subscriptionTier: "pro",
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          powerMode: false,
          createdAt: new Date(),
          usageResetAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(mockContext);

      // Should throw FORBIDDEN error for non-admin user
      await expect(caller.admin.getAnalytics()).rejects.toThrow("Admin access required");
    });
  });

  describe("getAnalytics", () => {
    it("should return analytics structure with correct fields", async () => {
      const mockContext: TrpcContext = {
        user: {
          id: 1,
          openId: "admin-open-id",
          name: "Admin User",
          email: "admin@coachflow.com",
          role: "admin",
          subscriptionTier: "agency",
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          powerMode: false,
          createdAt: new Date(),
          usageResetAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(mockContext);
      const analytics = await caller.admin.getAnalytics();

      // Verify structure
      expect(analytics).toHaveProperty("usersByTier");
      expect(analytics).toHaveProperty("popularGenerators");
      expect(analytics).toHaveProperty("totalUsers");

      // Verify usersByTier has all tiers
      expect(analytics.usersByTier).toHaveProperty("trial");
      expect(analytics.usersByTier).toHaveProperty("pro");
      expect(analytics.usersByTier).toHaveProperty("agency");

      // Verify popularGenerators has all 9 generators
      expect(analytics.popularGenerators).toHaveProperty("headlines");
      expect(analytics.popularGenerators).toHaveProperty("hvco");
      expect(analytics.popularGenerators).toHaveProperty("heroMechanisms");
      expect(analytics.popularGenerators).toHaveProperty("icp");
      expect(analytics.popularGenerators).toHaveProperty("adCopy");
      expect(analytics.popularGenerators).toHaveProperty("email");
      expect(analytics.popularGenerators).toHaveProperty("whatsapp");
      expect(analytics.popularGenerators).toHaveProperty("landingPages");
      expect(analytics.popularGenerators).toHaveProperty("offers");
    });
  });

  describe("resetUserQuota", () => {
    it("should accept valid userId input", async () => {
      const mockContext: TrpcContext = {
        user: {
          id: 1,
          openId: "admin-open-id",
          name: "Admin User",
          email: "admin@coachflow.com",
          role: "admin",
          subscriptionTier: "agency",
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          powerMode: false,
          createdAt: new Date(),
          usageResetAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(mockContext);

      // Should return success
      const result = await caller.admin.resetUserQuota({ userId: 1 });
      expect(result).toEqual({ success: true });
    });
  });

  describe("overrideUserTier", () => {
    it("should accept valid tier values", async () => {
      const mockContext: TrpcContext = {
        user: {
          id: 1,
          openId: "admin-open-id",
          name: "Admin User",
          email: "admin@coachflow.com",
          role: "admin",
          subscriptionTier: "agency",
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          powerMode: false,
          createdAt: new Date(),
          usageResetAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(mockContext);

      // Test all valid tiers
      const tiers: Array<"trial" | "pro" | "agency"> = ["trial", "pro", "agency"];

      for (const tier of tiers) {
        const result = await caller.admin.overrideUserTier({
          userId: 1,
          newTier: tier,
        });
        expect(result).toEqual({ success: true });
      }
    });
  });
});
