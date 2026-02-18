import type { Request, Response } from "express";
import { stripe } from "./client";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./products";

/**
 * Detect tier from Stripe price ID
 */
function getTierFromPriceId(priceId: string): "pro" | "agency" | null {
  if (
    priceId === SUBSCRIPTION_TIERS.PRO.stripePriceIdMonthly ||
    priceId === SUBSCRIPTION_TIERS.PRO.stripePriceIdYearly
  ) {
    return "pro";
  }
  if (
    priceId === SUBSCRIPTION_TIERS.AGENCY.stripePriceIdMonthly ||
    priceId === SUBSCRIPTION_TIERS.AGENCY.stripePriceIdYearly
  ) {
    return "agency";
  }
  return null;
}

/**
 * Reset all quota counts to 0 (called when tier changes)
 */
function getQuotaResetFields() {
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1); // Reset in 1 month
  
  return {
    headlineGeneratedCount: 0,
    hvcoGeneratedCount: 0,
    heroMechanismGeneratedCount: 0,
    icpGeneratedCount: 0,
    adCopyGeneratedCount: 0,
    emailSequenceGeneratedCount: 0,
    whatsappSequenceGeneratedCount: 0,
    landingPageGeneratedCount: 0,
    offerGeneratedCount: 0,
    usageResetAt: resetDate,
  };
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Webhook] No signature found");
    return res.status(400).send("No signature");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({
      verified: true,
    });
  }

  console.log(`[Webhook] Received event: ${event.type}`);

  const db = await getDb();
  if (!db) {
    console.error("[Webhook] Database not available");
    return res.status(500).send("Database error");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = parseInt(session.metadata?.user_id || "0");
        const tier = session.metadata?.tier as "pro" | "agency";

        if (!userId || !tier) {
          console.error("[Webhook] Missing user_id or tier in metadata");
          break;
        }

        // Update user with subscription info
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7-day trial

        await db
          .update(users)
          .set({
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionTier: tier,
            subscriptionStatus: "trialing",
            trialEndsAt,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        console.log(`[Webhook] Subscription created for user ${userId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = parseInt(subscription.metadata?.user_id || "0");

        if (!userId) {
          console.error("[Webhook] Missing user_id in subscription metadata");
          break;
        }

        // Detect tier from price ID
        const priceId = (subscription as any).items?.data?.[0]?.price?.id;
        const newTier = priceId ? getTierFromPriceId(priceId) : null;

        // Get current user to check if tier changed
        const [currentUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        // Map Stripe status to our status
        let status: "active" | "canceled" | "past_due" | "trialing" = "active";
        if (subscription.status === "trialing") status = "trialing";
        else if (subscription.status === "past_due") status = "past_due";
        else if (subscription.cancel_at_period_end) status = "canceled";

        const subscriptionEndsAt = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000)
          : null;

        // Build update object
        const updateData: any = {
          subscriptionStatus: status,
          subscriptionEndsAt,
          updatedAt: new Date(),
        };

        // If tier changed, update tier and reset quotas
        if (newTier && currentUser && newTier !== currentUser.subscriptionTier) {
          console.log(`[Webhook] Tier change detected: ${currentUser.subscriptionTier} → ${newTier}`);
          updateData.subscriptionTier = newTier;
          Object.assign(updateData, getQuotaResetFields());
        }

        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId));

        console.log(`[Webhook] Subscription updated for user ${userId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = parseInt(subscription.metadata?.user_id || "0");

        if (!userId) {
          console.error("[Webhook] Missing user_id in subscription metadata");
          break;
        }

        // Downgrade to trial (expired)
        await db
          .update(users)
          .set({
            subscriptionTier: "trial",
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            subscriptionEndsAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        console.log(`[Webhook] Subscription deleted for user ${userId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) break;

        // Find user by subscription ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeSubscriptionId, subscriptionId))
          .limit(1);

        if (!user) {
          console.error("[Webhook] User not found for subscription:", subscriptionId);
          break;
        }

        // Update subscription status to active
        await db
          .update(users)
          .set({
            subscriptionStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        console.log(`[Webhook] Payment succeeded for user ${user.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) break;

        // Find user by subscription ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeSubscriptionId, subscriptionId))
          .limit(1);

        if (!user) {
          console.error("[Webhook] User not found for subscription:", subscriptionId);
          break;
        }

        // Update subscription status to past_due
        await db
          .update(users)
          .set({
            subscriptionStatus: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        console.log(`[Webhook] Payment failed for user ${user.id}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send("Webhook processing error");
  }
}
