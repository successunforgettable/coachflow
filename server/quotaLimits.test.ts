import { describe, it, expect } from "vitest";
import { getQuotaLimit } from "./quotaLimits";
import type { SubscriptionTier } from "./quotaLimits";

describe("Quota Limits Configuration", () => {
  describe("Trial Tier Limits", () => {
    const tier: SubscriptionTier = "trial";

    it("should enforce 0 headlines for trial users", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(0);
    });

    it("should enforce 0 HVCO titles for trial users", () => {
      expect(getQuotaLimit(tier, "hvco")).toBe(0);
    });

    it("should enforce 0 hero mechanisms for trial users", () => {
      expect(getQuotaLimit(tier, "heroMechanisms")).toBe(0);
    });

    it("should enforce 2 ICP generations for trial users", () => {
      expect(getQuotaLimit(tier, "icp")).toBe(2);
    });

    it("should enforce 5 ad copy generations for trial users", () => {
      expect(getQuotaLimit(tier, "adCopy")).toBe(5);
    });

    it("should enforce 2 email sequences for trial users", () => {
      expect(getQuotaLimit(tier, "email")).toBe(2);
    });

    it("should enforce 2 WhatsApp sequences for trial users", () => {
      expect(getQuotaLimit(tier, "whatsapp")).toBe(2);
    });

    it("should enforce 2 landing pages for trial users", () => {
      expect(getQuotaLimit(tier, "landingPages")).toBe(2);
    });

    it("should enforce 2 offers for trial users", () => {
      expect(getQuotaLimit(tier, "offers")).toBe(2);
    });
  });

  describe("Pro Tier Limits", () => {
    const tier: SubscriptionTier = "pro";

    it("should enforce 6 headlines for pro users", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(6);
    });

    it("should enforce 3 HVCO titles for pro users", () => {
      expect(getQuotaLimit(tier, "hvco")).toBe(3);
    });

    it("should enforce 4 hero mechanisms for pro users", () => {
      expect(getQuotaLimit(tier, "heroMechanisms")).toBe(4);
    });

    it("should enforce 50 ICP generations for pro users", () => {
      expect(getQuotaLimit(tier, "icp")).toBe(50);
    });

    it("should enforce 100 ad copy generations for pro users", () => {
      expect(getQuotaLimit(tier, "adCopy")).toBe(100);
    });

    it("should enforce 20 email sequences for pro users", () => {
      expect(getQuotaLimit(tier, "email")).toBe(20);
    });

    it("should enforce 20 WhatsApp sequences for pro users", () => {
      expect(getQuotaLimit(tier, "whatsapp")).toBe(20);
    });

    it("should enforce 10 landing pages for pro users", () => {
      expect(getQuotaLimit(tier, "landingPages")).toBe(10);
    });

    it("should enforce 10 offers for pro users", () => {
      expect(getQuotaLimit(tier, "offers")).toBe(10);
    });
  });

  describe("Agency Tier Limits", () => {
    const tier: SubscriptionTier = "agency";

    it("should enforce 999 (unlimited) headlines for agency users", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(999);
    });

    it("should enforce 999 (unlimited) HVCO titles for agency users", () => {
      expect(getQuotaLimit(tier, "hvco")).toBe(999);
    });

    it("should enforce 999 (unlimited) hero mechanisms for agency users", () => {
      expect(getQuotaLimit(tier, "heroMechanisms")).toBe(999);
    });

    it("should enforce 999 (unlimited) ICP generations for agency users", () => {
      expect(getQuotaLimit(tier, "icp")).toBe(999);
    });

    it("should enforce 999 (unlimited) ad copy generations for agency users", () => {
      expect(getQuotaLimit(tier, "adCopy")).toBe(999);
    });

    it("should enforce 999 (unlimited) email sequences for agency users", () => {
      expect(getQuotaLimit(tier, "email")).toBe(999);
    });

    it("should enforce 999 (unlimited) WhatsApp sequences for agency users", () => {
      expect(getQuotaLimit(tier, "whatsapp")).toBe(999);
    });

    it("should enforce 999 (unlimited) landing pages for agency users", () => {
      expect(getQuotaLimit(tier, "landingPages")).toBe(999);
    });

    it("should enforce 999 (unlimited) offers for agency users", () => {
      expect(getQuotaLimit(tier, "offers")).toBe(999);
    });
  });

  describe("Quota Limit Consistency", () => {
    it("should have trial limits lower than or equal to pro limits", () => {
      const generators: Array<"headlines" | "hvco" | "heroMechanisms" | "icp" | "adCopy" | "email" | "whatsapp" | "landingPages" | "offers"> = [
        "headlines",
        "hvco",
        "heroMechanisms",
        "icp",
        "adCopy",
        "email",
        "whatsapp",
        "landingPages",
        "offers",
      ];

      generators.forEach((gen) => {
        const trialLimit = getQuotaLimit("trial", gen);
        const proLimit = getQuotaLimit("pro", gen);
        expect(trialLimit).toBeLessThanOrEqual(proLimit);
      });
    });

    it("should have pro limits lower than agency limits", () => {
      const generators: Array<"headlines" | "hvco" | "heroMechanisms" | "icp" | "adCopy" | "email" | "whatsapp" | "landingPages" | "offers"> = [
        "headlines",
        "hvco",
        "heroMechanisms",
        "icp",
        "adCopy",
        "email",
        "whatsapp",
        "landingPages",
        "offers",
      ];

      generators.forEach((gen) => {
        const proLimit = getQuotaLimit("pro", gen);
        const agencyLimit = getQuotaLimit("agency", gen);
        expect(proLimit).toBeLessThan(agencyLimit);
      });
    });

    it("should return valid limits for all tier/generator combinations", () => {
      const tiers: SubscriptionTier[] = ["trial", "pro", "agency"];
      const generators: Array<"headlines" | "hvco" | "heroMechanisms" | "icp" | "adCopy" | "email" | "whatsapp" | "landingPages" | "offers"> = [
        "headlines",
        "hvco",
        "heroMechanisms",
        "icp",
        "adCopy",
        "email",
        "whatsapp",
        "landingPages",
        "offers",
      ];

      tiers.forEach((tier) => {
        generators.forEach((gen) => {
          const limit = getQuotaLimit(tier, gen);
          expect(limit).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(limit)).toBe(true);
        });
      });
    });
  });

  describe("Industry Standard Verification", () => {
    it("should match Standard trial tier limits exactly", () => {
      const kongTrialLimits = {
        headlines: 0,
        hvco: 0,
        heroMechanisms: 0,
        icp: 2,
        adCopy: 5,
        email: 2,
        whatsapp: 2,
        landingPages: 2,
        offers: 2,
      };

      Object.entries(kongTrialLimits).forEach(([gen, expectedLimit]) => {
        const actualLimit = getQuotaLimit("trial", gen as any);
        expect(actualLimit).toBe(expectedLimit);
      });
    });

    it("should match Standard pro tier limits exactly", () => {
      const kongProLimits = {
        headlines: 6,
        hvco: 3,
        heroMechanisms: 4,
        icp: 50,
        adCopy: 100,
        email: 20,
        whatsapp: 20,
        landingPages: 10,
        offers: 10,
      };

      Object.entries(kongProLimits).forEach(([gen, expectedLimit]) => {
        const actualLimit = getQuotaLimit("pro", gen as any);
        expect(actualLimit).toBe(expectedLimit);
      });
    });

    it("should match Standard agency tier limits exactly (999 = unlimited)", () => {
      const kongAgencyLimits = {
        headlines: 999,
        hvco: 999,
        heroMechanisms: 999,
        icp: 999,
        adCopy: 999,
        email: 999,
        whatsapp: 999,
        landingPages: 999,
        offers: 999,
      };

      Object.entries(kongAgencyLimits).forEach(([gen, expectedLimit]) => {
        const actualLimit = getQuotaLimit("agency", gen as any);
        expect(actualLimit).toBe(expectedLimit);
      });
    });
  });
});
