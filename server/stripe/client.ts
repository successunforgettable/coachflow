import Stripe from "stripe";

// CUSTOM_STRIPE_SECRET_KEY takes precedence over the built-in STRIPE_SECRET_KEY.
// This allows the live mode key to be supplied without overriding the system-managed variable.
const stripeKey = process.env.CUSTOM_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error("Neither CUSTOM_STRIPE_SECRET_KEY nor STRIPE_SECRET_KEY is set");
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});
