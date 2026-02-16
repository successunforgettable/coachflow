import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { stripe } from "../stripe/client";
import { SUBSCRIPTION_TIERS, TRIAL_DAYS, type SubscriptionTier, type BillingInterval } from "../stripe/products";

const createCheckoutSessionSchema = z.object({
  tier: z.enum(["pro", "agency"]),
  interval: z.enum(["monthly", "yearly"]),
});

export const subscriptionRouter = router({
  // Get current user's subscription status
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    // Check if trial has expired
    const now = new Date();
    const trialExpired = user.trialEndsAt && now > user.trialEndsAt;

    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionEndsAt: user.subscriptionEndsAt,
      trialExpired,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    };
  }),

  // Create Stripe checkout session for subscription
  createCheckoutSession: protectedProcedure
    .input(createCheckoutSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tierKey = input.tier.toUpperCase() as SubscriptionTier;
      const tierConfig = SUBSCRIPTION_TIERS[tierKey];

      if (!tierConfig) {
        throw new Error("Invalid subscription tier");
      }

      const priceId =
        input.interval === "monthly"
          ? tierConfig.stripePriceIdMonthly
          : tierConfig.stripePriceIdYearly;

      // Get or create Stripe customer
      let stripeCustomerId = ctx.user.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: ctx.user.email || undefined,
          name: ctx.user.name || undefined,
          metadata: {
            user_id: ctx.user.id.toString(),
          },
        });

        stripeCustomerId = customer.id;

        // Save customer ID to database
        await db
          .update(users)
          .set({ stripeCustomerId: customer.id })
          .where(eq(users.id, ctx.user.id));
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        client_reference_id: ctx.user.id.toString(),
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
          },
        },
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          tier: input.tier,
        },
        allow_promotion_codes: true,
        success_url: `${ctx.req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${ctx.req.headers.origin}/pricing`,
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user || !user.stripeSubscriptionId) {
      throw new Error("No active subscription found");
    }

    // Cancel subscription at period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update database
    await db
      .update(users)
      .set({
        subscriptionStatus: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  // Get pricing information
  getPricing: protectedProcedure.query(async () => {
    return {
      tiers: SUBSCRIPTION_TIERS,
      trialDays: TRIAL_DAYS,
    };
  }),
});
