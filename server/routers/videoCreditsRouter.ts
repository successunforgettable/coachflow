import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { videoCreditsProcedures } from "./videoCredits";

export const videoCreditsRouter = router({
  /**
   * Get user's current credit balance
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    return videoCreditsProcedures.getBalance({ ctx });
  }),

  /**
   * Get user's transaction history
   */
  getTransactions: protectedProcedure.query(async ({ ctx }) => {
    return videoCreditsProcedures.getTransactions({ ctx });
  }),

  /**
   * Get available credit bundles
   */
  getBundles: protectedProcedure.query(async () => {
    return videoCreditsProcedures.getBundles();
  }),

  /**
   * Create Stripe payment intent for credit purchase
   */
  createPaymentIntent: protectedProcedure
    .input(
      z.object({
        bundleId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return videoCreditsProcedures.createPaymentIntent({ input, ctx });
    }),

  /**
   * Deduct credits for video generation (internal use)
   */
  deductCredits: protectedProcedure
    .input(
      z.object({
        videoId: z.number(),
        duration: z.enum(["15", "30", "60", "90"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return videoCreditsProcedures.deductCredits({ input, ctx });
    }),

  /**
   * Refund credits if video generation fails (internal use)
   */
  refundCredits: protectedProcedure
    .input(
      z.object({
        videoId: z.number(),
        creditsToRefund: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return videoCreditsProcedures.refundCredits({ input, ctx });
    }),
});
