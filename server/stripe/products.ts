/**
 * Stripe Products and Prices Configuration
 *
 * ZAP Campaigns — Confirmed pricing (March 2026):
 *   ZAP Pro Monthly:      $147 / month
 *   ZAP Pro Yearly:       $1,470 / year  (~$122.50/month, 2 months free)
 *   ZAP Pro Plus Monthly: $497 / month
 *   ZAP Pro Plus Yearly:  $4,970 / year  (~$414/month, 2 months free)
 *
 * Price IDs are read from environment variables.
 * Set these in Settings → Secrets before going live:
 *   STRIPE_PRO_MONTHLY_PRICE_ID
 *   STRIPE_PRO_YEARLY_PRICE_ID
 *   STRIPE_AGENCY_MONTHLY_PRICE_ID   (maps to ZAP Pro Plus monthly)
 *   STRIPE_AGENCY_YEARLY_PRICE_ID    (maps to ZAP Pro Plus yearly)
 */

export const SUBSCRIPTION_TIERS = {
  PRO: {
    name: "ZAP Pro",
    priceMonthly: 147,
    priceYearly: 1470, // ~$122.50/month (2 months free)
    features: [
      "3 ICP Profiles",
      "110+ assets across all 9 generators",
      "50–100 generations per tool",
      "Meta Compliance Scoring",
      "1-click GHL and Meta push integration",
      "PDF Export on all generators",
      "10 video credits per month",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly",
  },
  AGENCY: {
    name: "ZAP Pro Plus",
    priceMonthly: 497,
    priceYearly: 4970, // ~$414/month (2 months free)
    features: [
      "Unlimited ICP Profiles",
      "Unlimited Generations",
      "Everything in ZAP Pro",
      "Multi-ICP Campaign Cloning",
      "Kill/Scale Automation",
      "White-Label Reports",
      "25 video credits per month",
      "Priority Support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID || "price_agency_monthly",
    stripePriceIdYearly: process.env.STRIPE_AGENCY_YEARLY_PRICE_ID || "price_agency_yearly",
  },
};

export const TRIAL_DAYS = 7;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
export type BillingInterval = "monthly" | "yearly";
