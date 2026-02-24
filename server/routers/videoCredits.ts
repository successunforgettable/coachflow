import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { videoCredits, videoCreditTransactions, users } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/**
 * Credit bundle definitions with tiered pricing
 * Margins: 63-79% based on $0.37/video cost
 */
export const CREDIT_BUNDLES = [
  {
    id: "bundle_5",
    name: "Starter Pack",
    credits: 5,
    price: 900, // $9.00 in cents
    priceDisplay: "$9",
    perVideoPrice: "$1.80",
    savings: null,
  },
  {
    id: "bundle_20",
    name: "Pro Pack",
    credits: 20,
    price: 2900, // $29.00 in cents
    priceDisplay: "$29",
    perVideoPrice: "$1.45",
    savings: "Save 19%",
  },
  {
    id: "bundle_50",
    name: "Business Pack",
    credits: 50,
    price: 5900, // $59.00 in cents
    priceDisplay: "$59",
    perVideoPrice: "$1.18",
    savings: "Save 34%",
    popular: true,
  },
  {
    id: "bundle_100",
    name: "Agency Pack",
    credits: 100,
    price: 9900, // $99.00 in cents
    priceDisplay: "$99",
    perVideoPrice: "$0.99",
    savings: "Save 45%",
  },
] as const;

/**
 * Credit cost calculation based on video duration
 * 15-30s = 1 credit, 60s = 2 credits, 90s = 3 credits
 */
export function calculateCreditCost(duration: "15" | "30" | "60" | "90"): number {
  if (duration === "15" || duration === "30") return 1;
  if (duration === "60") return 2;
  if (duration === "90") return 3;
  throw new Error(`Invalid duration: ${duration}`);
}

export const videoCreditsProcedures = {
  /**
   * Get user's current credit balance
   */
  getBalance: async ({ ctx }: { ctx: any }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [creditRecord] = await db
      .select()
      .from(videoCredits)
      .where(eq(videoCredits.userId, ctx.user.id))
      .limit(1);

    // Create record with 2 free credits if doesn't exist
    if (!creditRecord) {
      await db.insert(videoCredits).values({
        userId: ctx.user.id,
        balance: 2,
      });

      await db.insert(videoCreditTransactions).values({
        userId: ctx.user.id,
        type: "free_grant",
        amount: 2,
        balanceAfter: 2,
        description: "Welcome bonus: 2 free video credits",
      });

      const [newRecord] = await db
        .select()
        .from(videoCredits)
        .where(eq(videoCredits.userId, ctx.user.id))
        .limit(1);
      
      return newRecord;
    }

    return creditRecord || null;
  },

  /**
   * Get user's transaction history
   */
  getTransactions: async ({ ctx }: { ctx: any }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const transactions = await db
      .select()
      .from(videoCreditTransactions)
      .where(eq(videoCreditTransactions.userId, ctx.user.id))
      .orderBy(desc(videoCreditTransactions.createdAt))
      .limit(50);

    return transactions;
  },

  /**
   * Get available credit bundles
   */
  getBundles: async () => {
    return CREDIT_BUNDLES;
  },

  /**
   * Create Stripe payment intent for credit purchase
   */
  createPaymentIntent: async ({
    input,
    ctx,
  }: {
    input: { bundleId: string };
    ctx: any;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const bundle = CREDIT_BUNDLES.find((b) => b.id === input.bundleId);
    if (!bundle) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid bundle ID",
      });
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId = ctx.user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        name: ctx.user.name,
        metadata: {
          userId: ctx.user.id.toString(),
        },
      });
      stripeCustomerId = customer.id;

      // Update user record with Stripe customer ID
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db
        .update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, ctx.user.id));
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: bundle.price,
      currency: "usd",
      customer: stripeCustomerId,
      metadata: {
        userId: ctx.user.id.toString(),
        bundleId: bundle.id,
        credits: bundle.credits.toString(),
        type: "video_credits",
      },
      description: `${bundle.name} - ${bundle.credits} video credits`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      bundleId: bundle.id,
      credits: bundle.credits,
      price: bundle.price,
    };
  },

  /**
   * Deduct credits for video generation
   * Called before rendering starts
   */
  deductCredits: async ({
    input,
    ctx,
  }: {
    input: { videoId: number; duration: "15" | "30" | "60" | "90" };
    ctx: any;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const creditCost = calculateCreditCost(input.duration);

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get current balance
    const [creditRecord] = await db
      .select()
      .from(videoCredits)
      .where(eq(videoCredits.userId, ctx.user.id))
      .limit(1);

    if (!creditRecord || creditRecord.balance < creditCost) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Insufficient credits. Need ${creditCost}, have ${creditRecord?.balance || 0}`,
      });
    }

    // Deduct credits
    const newBalance = creditRecord.balance - creditCost;
    await db
      .update(videoCredits)
      .set({ balance: newBalance })
      .where(eq(videoCredits.userId, ctx.user.id));

    // Record transaction
    await db.insert(videoCreditTransactions).values({
      userId: ctx.user.id,
      type: "deduction",
      amount: -creditCost,
      balanceAfter: newBalance,
      videoId: input.videoId,
      description: `Video generation (${input.duration}s)`,
    });

    return { success: true, newBalance, creditsUsed: creditCost };
  },

  /**
   * Refund credits if video generation fails
   * Called when Creatomate render fails
   */
  refundCredits: async ({
    input,
    ctx,
  }: {
    input: { videoId: number; creditsToRefund: number };
    ctx: any;
  }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get current balance
    const [creditRecord] = await db
      .select()
      .from(videoCredits)
      .where(eq(videoCredits.userId, ctx.user.id))
      .limit(1);

    if (!creditRecord) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Credit record not found",
      });
    }

    // Refund credits
    const newBalance = creditRecord.balance + input.creditsToRefund;
    await db
      .update(videoCredits)
      .set({ balance: newBalance })
      .where(eq(videoCredits.userId, ctx.user.id));

    // Record transaction
    await db.insert(videoCreditTransactions).values({
      userId: ctx.user.id,
      type: "refund",
      amount: input.creditsToRefund,
      balanceAfter: newBalance,
      videoId: input.videoId,
      description: `Refund: Video generation failed`,
    });

    return { success: true, newBalance, creditsRefunded: input.creditsToRefund };
  },
};
