/**
 * Validates that all four Stripe subscription price IDs are set and
 * can be retrieved from the Stripe API without error.
 *
 * Run with: pnpm test -- stripe.prices
 */
import { describe, it, expect } from "vitest";
import Stripe from "stripe";

const stripe = new Stripe((process.env.CUSTOM_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY) as string, {
  apiVersion: "2024-06-20",
});

const PRICE_VARS = [
  { env: "STRIPE_PRO_MONTHLY_PRICE_ID", label: "ZAP Pro Monthly" },
  { env: "STRIPE_PRO_YEARLY_PRICE_ID", label: "ZAP Pro Yearly" },
  { env: "STRIPE_AGENCY_MONTHLY_PRICE_ID", label: "ZAP Pro Plus Monthly" },
  { env: "STRIPE_AGENCY_YEARLY_PRICE_ID", label: "ZAP Pro Plus Yearly" },
];

describe("Stripe price IDs", () => {
  for (const { env, label } of PRICE_VARS) {
    it(`${label} (${env}) is set and retrievable`, async () => {
      const priceId = process.env[env];
      expect(priceId, `${env} env var is missing`).toBeTruthy();
      expect(priceId).not.toBe("price_pro_monthly");
      expect(priceId).not.toBe("price_pro_yearly");
      expect(priceId).not.toBe("price_agency_monthly");
      expect(priceId).not.toBe("price_agency_yearly");

      const price = await stripe.prices.retrieve(priceId as string);
      expect(price.id).toBe(priceId);
      expect(price.active).toBe(true);
    }, 15000);
  }
});
