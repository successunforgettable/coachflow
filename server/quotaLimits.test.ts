import { describe, it, expect } from "vitest";
import { getQuotaLimit, QUOTA_LIMITS } from "./quotaLimits";
import type { SubscriptionTier } from "./quotaLimits";

describe("Quota Limits Configuration", () => {
  describe("Trial Tier Limits", () => {
    const tier: SubscriptionTier = "trial";

    // D2 (2026-09-24): headlines are unlimited for trial, matching QUOTA_LIMITS; hvco and methods were already
    // Infinity in the table. The old "0" expectations predate the table and were failing before this change.
    it("gives trial users unlimited headlines, HVCO titles and hero mechanisms", () => {
      expect(getQuotaLimit(tier, "headlines")).toBe(Infinity);
      expect(getQuotaLimit(tier, "hvco")).toBe(Infinity);
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

  // D5 (Arfeen, 2026-09-24): quotas ration TRIAL users only. Pro and agency are never counted or refused, on any
  // path. QUOTA_LIMITS keeps the pro/agency rows as the pricing-page record; getQuotaLimit enforces none of them.
  describe("Pro Tier Limits", () => {
    it.each(["headlines", "hvco", "heroMechanisms", "icp", "adCopy", "email", "whatsapp", "landingPages", "offers"] as const)("never limits pro users: %s", (gen) => {
      expect(getQuotaLimit("pro", gen)).toBe(Infinity);
    });
  });

  describe("Agency Tier Limits", () => {
    it.each(["headlines", "hvco", "heroMechanisms", "icp", "adCopy", "email", "whatsapp", "landingPages", "offers"] as const)("never limits agency users: %s", (gen) => {
      expect(getQuotaLimit("agency", gen)).toBe(Infinity);
    });
  });

  describe("Staff roles", () => {
    it.each(["admin", "superuser"])("never limits %s, even on a trial tier", (role) => {
      expect(getQuotaLimit("trial", "offers", role)).toBe(Infinity);
    });
    it("NEGATIVE CONTROL: an ordinary trial user IS limited", () => {
      expect(getQuotaLimit("trial", "offers", "user")).toBe(2);
      expect(getQuotaLimit(null, "offers")).toBe(2); // a missing tier is trial
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

    it("keeps the pro/agency pricing rows as a record, but enforces none of them (D5)", () => {
      expect(QUOTA_LIMITS.pro.offers).toBe(50);
      expect(QUOTA_LIMITS.agency.offers).toBe(999);
      expect(getQuotaLimit("pro", "offers")).toBe(Infinity);
      expect(getQuotaLimit("agency", "offers")).toBe(Infinity);
    });
  });
});
