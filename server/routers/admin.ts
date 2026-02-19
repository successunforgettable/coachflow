import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import Stripe from "stripe";
import { auditedAdminProcedure } from "../_core/auditedAdminProcedure";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-01-28.clover" });

// Pricing constants
const TIER_PRICES = {
  trial: 0,
  pro: 49,
  agency: 199,
};

/**
 * Admin-only middleware
 * Checks if the authenticated user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  /**
   * Get all users with their quota usage
   */
  getAllUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);
    return allUsers;
  }),

  /**
   * Get analytics data
   */
  getAnalytics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);

    // Count users by tier
    const usersByTier = {
      trial: allUsers.filter((u) => u.subscriptionTier === "trial" || !u.subscriptionTier).length,
      pro: allUsers.filter((u) => u.subscriptionTier === "pro").length,
      agency: allUsers.filter((u) => u.subscriptionTier === "agency").length,
    };

    // Calculate total generations per generator type
    const popularGenerators = {
      headlines: allUsers.reduce((sum, u) => sum + u.headlineGeneratedCount, 0),
      hvco: allUsers.reduce((sum, u) => sum + u.hvcoGeneratedCount, 0),
      heroMechanisms: allUsers.reduce((sum, u) => sum + u.heroMechanismGeneratedCount, 0),
      icp: allUsers.reduce((sum, u) => sum + u.icpGeneratedCount, 0),
      adCopy: allUsers.reduce((sum, u) => sum + u.adCopyGeneratedCount, 0),
      email: allUsers.reduce((sum, u) => sum + u.emailSeqGeneratedCount, 0),
      whatsapp: allUsers.reduce((sum, u) => sum + u.whatsappSeqGeneratedCount, 0),
      landingPages: allUsers.reduce((sum, u) => sum + u.landingPageGeneratedCount, 0),
      offers: allUsers.reduce((sum, u) => sum + u.offerGeneratedCount, 0),
    };

    return {
      usersByTier,
      popularGenerators,
      totalUsers: allUsers.length,
    };
  }),

  /**
   * Reset user quota counts to 0
   */
  resetUserQuota: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(users)
        .set({
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Override user subscription tier
   */
  overrideUserTier: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        newTier: z.enum(["trial", "pro", "agency"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(users)
        .set({
          subscriptionTier: input.newTier,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Phase 1: Financial Metrics
   * Get current MRR, ARR, churn rate, active subscriptions
   */
  getFinancialMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);

    // Calculate active subscriptions (active or trialing status)
    const activeUsers = allUsers.filter(
      (u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"
    );

    // Calculate MRR from active subscriptions
    const mrr = activeUsers.reduce((sum, u) => {
      const tierPrice = TIER_PRICES[u.subscriptionTier || "trial"];
      return sum + tierPrice;
    }, 0);

    // Calculate ARR
    const arr = mrr * 12;

    // Calculate churn rate (users who canceled in last 30 days / total active)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const churnedUsers = allUsers.filter(
      (u) => u.subscriptionStatus === "canceled" && u.updatedAt >= thirtyDaysAgo
    );
    const churnRate = activeUsers.length > 0 ? (churnedUsers.length / activeUsers.length) * 100 : 0;

    // Calculate month-over-month growth
    // For now, return 0 (will be calculated from historical data later)
    const mrrGrowth = 0;

    return {
      mrr,
      arr,
      churnRate: Number(churnRate.toFixed(2)),
      activeSubscriptions: activeUsers.length,
      mrrGrowth,
    };
  }),

  /**
   * Phase 1: Revenue by Tier
   * Get revenue breakdown by subscription tier
   */
  getRevenueByTier: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);

    // Count active subscriptions by tier
    const activeUsers = allUsers.filter(
      (u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"
    );

    const trialCount = activeUsers.filter((u) => u.subscriptionTier === "trial" || !u.subscriptionTier).length;
    const proCount = activeUsers.filter((u) => u.subscriptionTier === "pro").length;
    const agencyCount = activeUsers.filter((u) => u.subscriptionTier === "agency").length;

    return {
      trial: { count: trialCount, revenue: trialCount * TIER_PRICES.trial },
      pro: { count: proCount, revenue: proCount * TIER_PRICES.pro },
      agency: { count: agencyCount, revenue: agencyCount * TIER_PRICES.agency },
    };
  }),

  /**
   * Phase 1: Revenue Chart
   * Get revenue trends over time
   */
  getRevenueChart: adminProcedure
    .input(
      z.object({
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // For now, return mock data (will be replaced with actual financial_metrics table data)
      const data = [];
      const today = new Date();

      for (let i = input.days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Calculate MRR for this date (simplified - in production, use financial_metrics table)
        const allUsers = await db.select().from(users);
        const activeUsers = allUsers.filter(
          (u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"
        );
        const mrr = activeUsers.reduce((sum, u) => {
          const tierPrice = TIER_PRICES[u.subscriptionTier || "trial"];
          return sum + tierPrice;
        }, 0);

        data.push({
          date: date.toISOString().split("T")[0],
          mrr,
          newSubs: 0, // Will be calculated from actual data
          churnedSubs: 0, // Will be calculated from actual data
        });
      }

      return data;
    }),

  /**
   * Phase 1: Failed Payments
   * Get users with past_due subscription status
   */
  getFailedPayments: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Find users with past_due status
    const pastDueUsers = await db
      .select()
      .from(users)
      .where(eq(users.subscriptionStatus, "past_due"));

    // Fetch Stripe invoice details for each user
    const failedPayments = await Promise.all(
      pastDueUsers.map(async (user) => {
        if (!user.stripeCustomerId) return null;

        try {
          // Fetch open invoices from Stripe
          const invoices = await stripe.invoices.list({
            customer: user.stripeCustomerId,
            status: "open",
            limit: 1,
          });

          if (invoices.data.length > 0) {
            const invoice = invoices.data[0];
            return {
              userId: user.id,
              email: user.email,
              name: user.name,
              amount: invoice.amount_due / 100, // Convert from cents
              dueDate: new Date(invoice.due_date! * 1000),
              invoiceId: invoice.id,
            };
          }
        } catch (error) {
          console.error(`Error fetching invoice for user ${user.id}:`, error);
        }

        return null;
      })
    );

    return failedPayments.filter((p) => p !== null);
  }),

  /**
   * Phase 2: Get User Subscription Details
   * Fetch full Stripe subscription details for a user
   */
  getUserSubscriptionDetails: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userResult = await db.select().from(users).where(eq(users.id, input.userId));
      const user = userResult[0];

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return null; // User has no Stripe subscription
      }

      try {
        // Fetch from Stripe API
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: "card",
        });

        return {
          subscription,
          customer,
          paymentMethods: paymentMethods.data,
        };
      } catch (error) {
        console.error("Error fetching subscription details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch subscription details from Stripe",
        });
      }
    }),

  /**
   * Phase 2: Get Payment History
   * Fetch all invoices for a user
   */
  getPaymentHistory: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userResult = await db.select().from(users).where(eq(users.id, input.userId));
      const user = userResult[0];

      if (!user || !user.stripeCustomerId) {
        return [];
      }

      try {
        // Fetch invoices from Stripe
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 100,
        });

        return invoices.data;
      } catch (error) {
        console.error("Error fetching payment history:", error);
        return [];
      }
    }),

  /**
   * Phase 2: Cancel Subscription
   * Cancel a user's subscription (immediate or at period end)
   */
  cancelSubscription: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        cancelAtPeriodEnd: z.boolean(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userResult = await db.select().from(users).where(eq(users.id, input.userId));
      const user = userResult[0];

      if (!user || !user.stripeSubscriptionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User has no active subscription" });
      }

      try {
        if (input.cancelAtPeriodEnd) {
          // Cancel at period end (no refund)
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
            cancellation_details: {
              comment: input.reason || "Canceled by admin",
            },
          });
        } else {
          // Cancel immediately
          await stripe.subscriptions.cancel(user.stripeSubscriptionId, {
            cancellation_details: {
              comment: input.reason || "Canceled by admin",
            },
          });

          // Update local database
          await db
            .update(users)
            .set({ subscriptionStatus: "canceled" })
            .where(eq(users.id, input.userId));
        }

        return { success: true };
      } catch (error) {
        console.error("Error canceling subscription:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription",
        });
      }
    }),

  /**
   * Phase 2: Refund Payment
   * Process a refund for a specific invoice
   */
  refundPayment: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        invoiceId: z.string(),
        amount: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        // Fetch charge ID from invoice
        const invoice: any = await stripe.invoices.retrieve(input.invoiceId);

        if (!invoice.charge && !invoice.payment_intent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice has no charge or payment intent to refund" });
        }

        // Process refund (try charge first, then payment_intent)
        const refundParams: any = {
          amount: Math.round(input.amount * 100), // Convert to cents
          reason: "requested_by_customer",
          metadata: {
            admin_reason: input.reason,
            admin_user_id: String(input.userId),
          },
        };

        if (invoice.charge) {
          refundParams.charge = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge.id;
        } else if (invoice.payment_intent) {
          refundParams.payment_intent = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id;
        }

        const refund = await stripe.refunds.create(refundParams);

        return { success: true, refundId: refund.id };
      } catch (error) {
        console.error("Error processing refund:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process refund",
        });
      }
    }),

  /**
   * Phase 3: Get Audit Log
   * Fetch paginated audit log with filters
   */
  getAuditLog: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(50),
        actionType: z.string().optional(),
        adminUserId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const offset = (input.page - 1) * input.limit;

      // Build WHERE clause
      let whereClause = "WHERE 1=1";
      const params: any[] = [];

      if (input.actionType) {
        whereClause += " AND aal.action_type = ?";
        params.push(input.actionType);
      }

      if (input.adminUserId) {
        whereClause += " AND aal.admin_user_id = ?";
        params.push(input.adminUserId);
      }

      if (input.startDate) {
        whereClause += " AND aal.created_at >= ?";
        params.push(input.startDate);
      }

      if (input.endDate) {
        whereClause += " AND aal.created_at <= ?";
        params.push(input.endDate);
      }

      // Fetch audit logs with user names
      const query = `
        SELECT 
          aal.id,
          aal.admin_user_id,
          aal.action_type,
          aal.target_user_id,
          aal.details,
          aal.ip_address,
          aal.user_agent,
          aal.created_at,
          admin.name as admin_name,
          admin.email as admin_email,
          target.name as target_user_name,
          target.email as target_user_email
        FROM admin_audit_log aal
        LEFT JOIN users admin ON aal.admin_user_id = admin.id
        LEFT JOIN users target ON aal.target_user_id = target.id
        ${whereClause}
        ORDER BY aal.created_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(input.limit, offset);

      const result: any = await db.execute(sql.raw(query + " -- params: " + JSON.stringify(params)));
      const logs = result[0] || [];

      // Get total count (approximate)
      const allLogs: any = await db.execute(sql`SELECT COUNT(*) as total FROM admin_audit_log`);
      const total = allLogs[0]?.[0]?.total || 0;

      return {
        logs,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /**
   * Phase 3: Get Audit Log for User
   * Fetch all audit log entries for a specific user
   */
  getAuditLogForUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const query = `
        SELECT 
          aal.id,
          aal.admin_user_id,
          aal.action_type,
          aal.target_user_id,
          aal.details,
          aal.ip_address,
          aal.user_agent,
          aal.created_at,
          admin.name as admin_name,
          admin.email as admin_email
        FROM admin_audit_log aal
        LEFT JOIN users admin ON aal.admin_user_id = admin.id
        WHERE aal.target_user_id = ?
        ORDER BY aal.created_at DESC
      `;

      const result: any = await db.execute(sql.raw(query + " -- userId: " + input.userId));
      return result[0] || [];
    }),

  /**
   * Phase 4: Get User Activity Metrics
   * Track active users over different time periods
   */
  getUserActivityMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const allUsers = await db.select().from(users);
    const activeUsers7d = allUsers.filter((u) => u.lastSignedIn && u.lastSignedIn >= sevenDaysAgo);
    const activeUsers30d = allUsers.filter((u) => u.lastSignedIn && u.lastSignedIn >= thirtyDaysAgo);
    const activeUsers90d = allUsers.filter((u) => u.lastSignedIn && u.lastSignedIn >= ninetyDaysAgo);

    return {
      activeUsers7d: activeUsers7d.length,
      activeUsers30d: activeUsers30d.length,
      activeUsers90d: activeUsers90d.length,
      totalUsers: allUsers.length,
    };
  }),

  /**
   * Phase 4: Get Churn Risk Users
   * Identify users at risk of churning
   */
  getChurnRiskUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const allUsers = await db.select().from(users);

    // Users who haven't logged in for 14+ days
    const inactiveUsers = allUsers.filter(
      (u) => u.lastSignedIn && u.lastSignedIn < fourteenDaysAgo
    );

    // Users who hit quota limit and didn't upgrade
    const quotaLimitUsers = allUsers.filter(
      (u) =>
        u.subscriptionTier === "trial" &&
        (u.headlineGeneratedCount >= 0 || // Trial has 0 headline quota
          u.hvcoGeneratedCount >= 0 ||
          u.heroMechanismGeneratedCount >= 0)
    );

    return {
      inactiveUsers,
      quotaLimitUsers,
    };
  }),

  /**
   * Phase 6: Add User Note
   * Add internal note about a user
   */
  addUserNote: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        note: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.execute(
        sql`INSERT INTO user_notes (user_id, admin_user_id, note) VALUES (${input.userId}, ${ctx.user.id}, ${input.note})`
      );

      return { success: true };
    }),

  /**
   * Phase 6: Get User Notes
   * Fetch all notes for a user
   */
  getUserNotes: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const query = `
        SELECT 
          un.id,
          un.user_id,
          un.admin_user_id,
          un.note,
          un.created_at,
          admin.name as admin_name
        FROM user_notes un
        LEFT JOIN users admin ON un.admin_user_id = admin.id
        WHERE un.user_id = ?
        ORDER BY un.created_at DESC
      `;

      const result: any = await db.execute(sql.raw(query + " -- userId: " + input.userId));
      return result[0] || [];
    }),

  /**
   * Phase 6: Grant Bonus Quota
   * Add extra generations to a user's quota
   */
  grantBonusQuota: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        generatorType: z.enum([
          "headline",
          "hvco",
          "hero",
          "icp",
          "adCopy",
          "email",
          "whatsapp",
          "landingPage",
          "offer",
        ]),
        amount: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const fieldMap: Record<string, string> = {
        headline: "headlineGeneratedCount",
        hvco: "hvcoGeneratedCount",
        hero: "heroMechanismGeneratedCount",
        icp: "icpGeneratedCount",
        adCopy: "adCopyGeneratedCount",
        email: "emailSeqGeneratedCount",
        whatsapp: "whatsappSeqGeneratedCount",
        landingPage: "landingPageGeneratedCount",
        offer: "offerGeneratedCount",
      };

      const field = fieldMap[input.generatorType];
      if (!field) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid generator type" });
      }

      // Decrement the count (effectively adding quota)
      const userResult = await db.select().from(users).where(eq(users.id, input.userId));
      const user = userResult[0];

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const currentCount = (user as any)[field] || 0;
      const newCount = Math.max(0, currentCount - input.amount);

      await db.execute(
        sql.raw(`UPDATE users SET ${field} = ${newCount} WHERE id = ${input.userId}`)
      );

      return { success: true };
    }),

  /**
   * Phase 8: Bulk Reset Quota
   * Reset quota for multiple users
   */
  bulkResetQuota: auditedAdminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      for (const userId of input.userIds) {
        await db
          .update(users)
          .set({
            headlineGeneratedCount: 0,
            hvcoGeneratedCount: 0,
            heroMechanismGeneratedCount: 0,
            icpGeneratedCount: 0,
            adCopyGeneratedCount: 0,
            emailSeqGeneratedCount: 0,
            whatsappSeqGeneratedCount: 0,
            landingPageGeneratedCount: 0,
            offerGeneratedCount: 0,
          })
          .where(eq(users.id, userId));
      }

      return { success: true, count: input.userIds.length };
    }),

  /**
   * Phase 8: Bulk Change Tier
   * Change subscription tier for multiple users
   */
  /**
   * Create a super user with unlimited quotas
   */
  createSuperUser: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Update user role to superuser
      await db
        .update(users)
        .set({ role: "superuser" })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * List all super users
   */
  listSuperUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const superusers = await db.select().from(users).where(eq(users.role, "superuser"));
    return superusers;
  }),

  /**
   * Revoke super user status (downgrade to regular user)
   */
  revokeSuperUser: auditedAdminProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Downgrade to regular user
      await db
        .update(users)
        .set({ role: "user" })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Phase 5: Content Moderation - Get user's generated content
   */
  getUserContent: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        contentType: z.enum(["headline", "hvco", "heroMechanism", "icp", "adCopy", "email", "whatsapp", "landingPage", "offer"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Import all content tables
      const { headlines, hvcoTitles, heroMechanisms, idealCustomerProfiles, adCopy, emailSequences, whatsappSequences, landingPages, offers } = await import("../../drizzle/schema");

      const content: any[] = [];

      // Fetch content based on type filter
      if (!input.contentType || input.contentType === "headline") {
        const headlineContent = await db.select().from(headlines).where(eq(headlines.userId, input.userId));
        content.push(...headlineContent.map(h => ({ ...h, contentType: "headline" })));
      }
      if (!input.contentType || input.contentType === "hvco") {
        const hvcoContent = await db.select().from(hvcoTitles).where(eq(hvcoTitles.userId, input.userId));
        content.push(...hvcoContent.map(h => ({ ...h, contentType: "hvco" })));
      }
      if (!input.contentType || input.contentType === "heroMechanism") {
        const heroContent = await db.select().from(heroMechanisms).where(eq(heroMechanisms.userId, input.userId));
        content.push(...heroContent.map(h => ({ ...h, contentType: "heroMechanism" })));
      }
      if (!input.contentType || input.contentType === "icp") {
        const icpContent = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.userId, input.userId));
        content.push(...icpContent.map(h => ({ ...h, contentType: "icp" })));
      }
      if (!input.contentType || input.contentType === "adCopy") {
        const adContent = await db.select().from(adCopy).where(eq(adCopy.userId, input.userId));
        content.push(...adContent.map(h => ({ ...h, contentType: "adCopy" })));
      }
      if (!input.contentType || input.contentType === "email") {
        const emailContent = await db.select().from(emailSequences).where(eq(emailSequences.userId, input.userId));
        content.push(...emailContent.map(h => ({ ...h, contentType: "email" })));
      }
      if (!input.contentType || input.contentType === "whatsapp") {
        const whatsappContent = await db.select().from(whatsappSequences).where(eq(whatsappSequences.userId, input.userId));
        content.push(...whatsappContent.map(h => ({ ...h, contentType: "whatsapp" })));
      }
      if (!input.contentType || input.contentType === "landingPage") {
        const landingPageContent = await db.select().from(landingPages).where(eq(landingPages.userId, input.userId));
        content.push(...landingPageContent.map(h => ({ ...h, contentType: "landingPage" })));
      }
      if (!input.contentType || input.contentType === "offer") {
        const offerContent = await db.select().from(offers).where(eq(offers.userId, input.userId));
        content.push(...offerContent.map(h => ({ ...h, contentType: "offer" })));
      }

      return content;
    }),

  /**
   * Phase 5: Delete user content
   */
  deleteUserContent: auditedAdminProcedure
    .input(
      z.object({
        contentType: z.enum(["headline", "hvco", "heroMechanism", "icp", "adCopy", "email", "whatsapp", "landingPage", "offer"]),
        contentId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { headlines, hvcoTitles, heroMechanisms, idealCustomerProfiles, adCopy, emailSequences, whatsappSequences, landingPages, offers } = await import("../../drizzle/schema");

      // Delete based on content type
      switch (input.contentType) {
        case "headline":
          await db.delete(headlines).where(eq(headlines.id, input.contentId));
          break;
        case "hvco":
          await db.delete(hvcoTitles).where(eq(hvcoTitles.id, input.contentId));
          break;
        case "heroMechanism":
          await db.delete(heroMechanisms).where(eq(heroMechanisms.id, input.contentId));
          break;
        case "icp":
          await db.delete(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, input.contentId));
          break;
        case "adCopy":
          await db.delete(adCopy).where(eq(adCopy.id, input.contentId));
          break;
        case "email":
          await db.delete(emailSequences).where(eq(emailSequences.id, input.contentId));
          break;
        case "whatsapp":
          await db.delete(whatsappSequences).where(eq(whatsappSequences.id, input.contentId));
          break;
        case "landingPage":
          await db.delete(landingPages).where(eq(landingPages.id, input.contentId));
          break;
        case "offer":
          await db.delete(offers).where(eq(offers.id, input.contentId));
          break;
      }

      return { success: true };
    }),

  /**
   * Phase 5: Search content across all generators
   * Note: Simplified implementation - returns empty for now
   * In production, implement full-text search across all content tables
   */
  searchContent: adminProcedure
    .input(
      z.object({
        query: z.string(),
        contentType: z.enum(["headline", "hvco", "heroMechanism", "icp", "adCopy", "email", "whatsapp", "landingPage", "offer"]).optional(),
      })
    )
    .query(async ({ input }) => {
      // TODO: Implement full-text search
      return [];
    }),

  /**
   * Phase 5: Flag content as inappropriate
   */
  flagContent: auditedAdminProcedure
    .input(
      z.object({
        contentType: z.enum(["headline", "hvco", "heroMechanism", "icp", "adCopy", "email", "whatsapp", "landingPage", "offer"]),
        contentId: z.number(),
        userId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Insert flag record
      await db.execute(sql`
        INSERT INTO content_flags (content_type, content_id, user_id, flagged_by_admin_id, reason)
        VALUES (${input.contentType}, ${input.contentId}, ${input.userId}, ${ctx.user.id}, ${input.reason})
      `);

      return { success: true };
    }),

  /**
   * Phase 5: Get flagged content
   */
  getFlaggedContent: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "resolved", "dismissed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let query = sql`SELECT * FROM content_flags`;
      if (input.status) {
        query = sql`SELECT * FROM content_flags WHERE status = ${input.status}`;
      }
      query = sql`${query} ORDER BY created_at DESC LIMIT 100`;

      const flags: any = await db.execute(query);
      return flags.rows || [];
    }),

  /**
   * Phase 5: Resolve flagged content
   */
  resolveFlaggedContent: auditedAdminProcedure
    .input(
      z.object({
        flagId: z.number(),
        status: z.enum(["resolved", "dismissed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.execute(sql`
        UPDATE content_flags 
        SET status = ${input.status}, resolved_at = NOW()
        WHERE id = ${input.flagId}
      `);

      return { success: true };
    }),

  /**
   * Phase 7: Get system health metrics
   */
  getSystemHealth: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get latest metrics from last 24 hours
    const metrics: any = await db.execute(sql`
      SELECT * FROM system_health_metrics 
      WHERE metric_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY metric_date DESC
    `);

    // Calculate aggregates
    const rows = (metrics.rows || []) as any[];
    const totalApiCalls = rows.reduce((sum, r) => sum + (r.api_success_count || 0) + (r.api_error_count || 0), 0);
    const totalApiErrors = rows.reduce((sum, r) => sum + (r.api_error_count || 0), 0);
    const totalLlmCalls = rows.reduce((sum, r) => sum + (r.llm_success_count || 0) + (r.llm_error_count || 0), 0);
    const totalLlmErrors = rows.reduce((sum, r) => sum + (r.llm_error_count || 0), 0);

    return {
      apiErrorRate: totalApiCalls > 0 ? (totalApiErrors / totalApiCalls * 100).toFixed(2) : "0",
      llmSuccessRate: totalLlmCalls > 0 ? ((totalLlmCalls - totalLlmErrors) / totalLlmCalls * 100).toFixed(2) : "100",
      metrics: rows,
    };
  }),

  /**
   * Phase 7: Get Stripe webhook status
   */
  getWebhookStatus: adminProcedure.query(async () => {
    // Check Stripe webhook endpoint health
    try {
      const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      return {
        configured: webhookEndpoints.data.length > 0,
        endpoints: webhookEndpoints.data.map(e => ({
          id: e.id,
          url: e.url,
          status: e.status,
          enabledEvents: e.enabled_events,
        })),
      };
    } catch (error) {
      return { configured: false, error: "Failed to fetch webhook status" };
    }
  }),

  /**
   * Phase 7: Get S3 storage usage
   * Note: Simplified - returns placeholder data
   * In production, integrate with S3 API to get actual usage
   */
  getStorageUsage: adminProcedure.query(async () => {
    // TODO: Integrate with S3 API
    return {
      totalBytes: 0,
      totalGB: "0.00",
      estimatedCost: "$0.00",
    };
  }),

  bulkChangeTier: auditedAdminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()),
        newTier: z.enum(["trial", "pro", "agency"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      for (const userId of input.userIds) {
        await db
          .update(users)
          .set({ subscriptionTier: input.newTier })
          .where(eq(users.id, userId));
      }

      return { success: true, count: input.userIds.length };
    }),
});
