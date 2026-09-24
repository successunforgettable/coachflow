import { describe, it, expect } from "vitest";
// Updated 2026-09-24 to the CURRENT table (Arfeen: quotaLimits.ts is the single source of truth). These 14 tests
// encoded the 2026-02-18 table; eec6641 (03-20) and e8860cc (03-24) changed the table deliberately and never updated
// them. Each changed expectation below cites the table value it now asserts.
import { getQuotaLimit } from "./quotaLimits";
import type { SubscriptionTier } from "./quotaLimits";

describe("Quota Limits Configuration", () => {
  describe("Trial Tier Limits", () => {
    const tier: SubscriptionTier = "trial";

    it("gives trial users unlimited headlines (table: Infinity, eec6641)", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(Infinity);
    });

    it("gives trial users unlimited HVCO titles (table: Infinity, eec6641)", () => {
      expect(getQuotaLimit(tier, "hvco")).toBe(Infinity);
    });

    it("gives trial users unlimited hero mechanisms (table: Infinity, eec6641)", () => {
      expect(getQuotaLimit(tier, "heroMechanisms")).toBe(Infinity);
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

    it("should enforce 50 headlines for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(50);
    });

    it("should enforce 50 HVCO titles for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "hvco")).toBe(50);
    });

    it("should enforce 50 hero mechanisms for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "heroMechanisms")).toBe(50);
    });

    it("should enforce 50 ICP generations for pro users", () => {
      expect(getQuotaLimit(tier, "icp")).toBe(50);
    });

    it("should enforce 100 ad copy generations for pro users", () => {
      expect(getQuotaLimit(tier, "adCopy")).toBe(100);
    });

    it("should enforce 50 email sequences for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "email")).toBe(50);
    });

    it("should enforce 50 WhatsApp sequences for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "whatsapp")).toBe(50);
    });

    it("should enforce 50 landing pages for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "landingPages")).toBe(50);
    });

    it("should enforce 50 offers for pro users (table, e8860cc)", () => {
      expect(getQuotaLimit(tier, "offers")).toBe(50);
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

      // Where the trial is CAPPED it never exceeds pro. Headlines, HVCO titles and hero mechanisms are unlimited for
      // trial by deliberate design (eec6641 "Unblock trial tier") while pro is capped at 50 — the table's own choice.
      const trialUnlimited = new Set(["headlines", "hvco", "heroMechanisms"]);
      generators.forEach((gen) => {
        const trialLimit = getQuotaLimit("trial", gen);
        const proLimit = getQuotaLimit("pro", gen);
        if (trialUnlimited.has(gen)) expect(trialLimit).toBe(Infinity);
        else expect(trialLimit).toBeLessThanOrEqual(proLimit);
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
          // A finite integer cap, or Infinity (unlimited) — never NaN, negative or fractional.
          expect(limit === Infinity || Number.isInteger(limit)).toBe(true);
        });
      });
    });
  });

  describe("Industry Standard Verification", () => {
    it("should match Standard trial tier limits exactly", () => {
      const kongTrialLimits = {
        headlines: Infinity,
        hvco: Infinity,
        heroMechanisms: Infinity,
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
        headlines: 50,
        hvco: 50,
        heroMechanisms: 50,
        icp: 50,
        adCopy: 100,
        email: 50,
        whatsapp: 50,
        landingPages: 50,
        offers: 50,
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
