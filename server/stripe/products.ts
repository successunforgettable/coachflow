/**
 * Stripe Products and Prices Configuration
 * 
 * Define all subscription tiers and pricing here.
 * These IDs should match your Stripe Dashboard products.
 */

export const SUBSCRIPTION_TIERS = {
  PRO: {
    name: "Pro",
    priceMonthly: 49,
    priceYearly: 490, // ~$41/month (2 months free)
    features: [
      "Unlimited services",
      "6 headline generations/month",
      "3 HVCO title generations/month",
      "4 hero mechanism generations/month",
      "50 ICP generations/month",
      "100 ad copy variations/month",
      "20 email sequences/month",
      "20 WhatsApp sequences/month",
      "10 landing pages/month",
      "10 offers/month",
      "Email support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly",
  },
  AGENCY: {
    name: "Agency",
    priceMonthly: 149,
    priceYearly: 1490, // ~$124/month (2 months free)
    features: [
      "Everything in Pro",
      "Unlimited headlines",
      "Unlimited HVCO titles",
      "Unlimited hero mechanisms",
      "Unlimited ICP generations",
      "Unlimited ad copy variations",
      "Unlimited email sequences",
      "Unlimited WhatsApp sequences",
      "Unlimited landing pages",
      "Unlimited offers",
      "Priority support",
      "White-label option",
      "Team collaboration (5 users)",
    ],
    stripePriceIdMonthly: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID || "price_agency_monthly",
    stripePriceIdYearly: process.env.STRIPE_AGENCY_YEARLY_PRICE_ID || "price_agency_yearly",
  },
};

export const TRIAL_DAYS = 7;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
export type BillingInterval = "monthly" | "yearly";
