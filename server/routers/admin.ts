import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, services, idealCustomerProfiles, offers, heroMechanisms, hvcoTitles, headlines, adCopy, landingPages, emailSequences, whatsappSequences, metaPublishedAds, campaignKits, jobs } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import Stripe from "stripe";
import { auditedAdminProcedure } from "../_core/auditedAdminProcedure";

const stripe = new Stripe((process.env.CUSTOM_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)!, { apiVersion: "2026-01-28.clover" });

// Pricing constants
const TIER_PRICES = {
  trial: 0,
  pro: 147,
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
  /**
   * Get all test campaign data for the /admin/test-campaigns report page
   */
  getTestCampaigns: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const TEST_EMAILS = [
      'test-fitness@zapcampaigns.com',
      'test-realestate@zapcampaigns.com',
      'test-mindset@zapcampaigns.com',
      'test-relationships@zapcampaigns.com',
      'test-business@zapcampaigns.com',
    ];
    const testUsers = await db.select().from(users).where(
      sql`${users.email} IN (${sql.join(TEST_EMAILS.map(e => sql`${e}`), sql`, `)})`
    );
    const campaigns = await Promise.all(testUsers.map(async (u) => {
      const [svc] = await db.select().from(services).where(eq(services.userId, u.id)).limit(1);
      if (!svc) return { user: u, service: null, nodes: {} };
      const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.userId, u.id)).limit(1);
      const [offer] = await db.select().from(offers).where(eq(offers.userId, u.id)).limit(1);
      const mechanisms = await db.select().from(heroMechanisms).where(eq(heroMechanisms.userId, u.id)).limit(3);
      const hvcos = await db.select().from(hvcoTitles).where(eq(hvcoTitles.userId, u.id)).limit(5);
      const hdlines = await db.select().from(headlines).where(eq(headlines.userId, u.id)).limit(5);
      const ads = await db.select().from(adCopy).where(eq(adCopy.userId, u.id)).limit(9);
      const [lp] = await db.select().from(landingPages).where(eq(landingPages.userId, u.id)).limit(1);
      const [email] = await db.select().from(emailSequences).where(eq(emailSequences.userId, u.id)).limit(1);
      const [whatsapp] = await db.select().from(whatsappSequences).where(eq(whatsappSequences.userId, u.id)).limit(1);
      const [meta] = await db.select().from(metaPublishedAds).where(eq(metaPublishedAds.userId, u.id)).limit(1);
      return {
        user: u,
        service: svc,
        nodes: { icp, offer, mechanisms, hvcos, headlines: hdlines, adCopy: ads, landingPage: lp, emailSequence: email, whatsappSequence: whatsapp, metaPublished: meta },
      };
    }));
    return campaigns;
  }),

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

    // Calculate MRR from Stripe active subscriptions
    let mrr = 0;
    try {
      const { stripe } = await import("../stripe/client");
      const subscriptions = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        expand: ["data.items.data.price"],
      });
      mrr = subscriptions.data.reduce((sum, sub) => {
        const itemTotal = sub.items.data.reduce((s, item) => {
          const price = item.price;
          if (!price || !price.unit_amount) return s;
          // Convert to monthly: if yearly, divide by 12
          const monthly = price.recurring?.interval === "year"
            ? price.unit_amount / 12
            : price.unit_amount;
          return s + monthly * (item.quantity || 1);
        }, 0);
        return sum + itemTotal;
      }, 0) / 100; // cents to dollars
    } catch (e) {
      console.warn("[admin] Stripe MRR query failed, falling back to DB estimate:", e);
      // Fallback to DB-based estimate if Stripe fails
      mrr = activeUsers.reduce((sum, u) => {
        const tierPrice = TIER_PRICES[u.subscriptionTier || "trial"];
        return sum + tierPrice;
      }, 0);
    }

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

    // ARPU = MRR / pro+agency user count
    const proUserCount = allUsers.filter(u => u.subscriptionTier === "pro" || u.subscriptionTier === "agency").length;
    const arpu = proUserCount > 0 ? Number((mrr / proUserCount).toFixed(2)) : 0;

    // Trial to Pro conversion rate
    const trialToProRate = allUsers.length > 0
      ? Number(((proUserCount / allUsers.length) * 100).toFixed(1))
      : 0;

    // Churned this month
    const churnedThisMonth = churnedUsers.length;

    // New MRR this month (new pro/agency subs in last 30 days)
    const newProThisMonth = allUsers.filter(u => {
      const created = new Date(u.createdAt);
      return created >= thirtyDaysAgo && (u.subscriptionTier === "pro" || u.subscriptionTier === "agency");
    });
    const newMrrThisMonth = newProThisMonth.reduce((sum, u) => {
      return sum + TIER_PRICES[u.subscriptionTier || "trial"];
    }, 0);

    return {
      mrr,
      arr,
      churnRate: Number(churnRate.toFixed(2)),
      activeSubscriptions: activeUsers.length,
      mrrGrowth,
      arpu,
      trialToProRate,
      churnedThisMonth,
      newMrrThisMonth,
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

      const allUsers = await db.select().from(users);
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (input.days - 1));

      // Build a day-by-day array using real user data
      const data = [];
      for (let i = input.days - 1; i >= 0; i--) {
        const dayStart = new Date(today);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        // New subscriptions created on this day (createdAt falls within the day)
        const newSubs = allUsers.filter((u) => {
          const created = new Date(u.createdAt);
          return created >= dayStart && created <= dayEnd &&
            (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing");
        }).length;

        // Churned subscriptions: canceled status and updatedAt falls within the day
        const churnedSubs = allUsers.filter((u) => {
          const updated = new Date(u.updatedAt);
          return u.subscriptionStatus === "canceled" && updated >= dayStart && updated <= dayEnd;
        }).length;

        // MRR as of this day: users who were active/trialing and created on or before this day
        const activeThatDay = allUsers.filter((u) => {
          const created = new Date(u.createdAt);
          return (
            created <= dayEnd &&
            (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing")
          );
        });
        const mrr = activeThatDay.reduce((sum, u) => {
          return sum + TIER_PRICES[u.subscriptionTier || "trial"];
        }, 0);

        data.push({
          date: dayStart.toISOString().split("T")[0],
          mrr,
          newSubs,
          churnedSubs,
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
    // Only flag users whose usage has reached or exceeded their tier limit for at least one generator
    const TRIAL_LIMITS: Record<string, number> = { icp: 2, adCopy: 5, email: 2, whatsapp: 2, landingPages: 2, offers: 2 };
    const PRO_LIMITS: Record<string, number> = { headlines: 6, hvco: 3, heroMechanisms: 4, icp: 50, adCopy: 100, email: 20, whatsapp: 20, landingPages: 10, offers: 10 };

    const quotaLimitUsers = allUsers.filter((u) => {
      const tier = u.subscriptionTier || "trial";
      if (tier === "agency") return false;
      const limits = tier === "pro" ? PRO_LIMITS : TRIAL_LIMITS;
      return (
        (limits.icp > 0 && u.icpGeneratedCount >= limits.icp) ||
        (limits.adCopy > 0 && u.adCopyGeneratedCount >= limits.adCopy) ||
        (limits.email > 0 && u.emailSeqGeneratedCount >= limits.email) ||
        (limits.whatsapp > 0 && u.whatsappSeqGeneratedCount >= limits.whatsapp) ||
        (limits.landingPages > 0 && u.landingPageGeneratedCount >= limits.landingPages) ||
        (limits.offers > 0 && u.offerGeneratedCount >= limits.offers) ||
        (limits.headlines > 0 && u.headlineGeneratedCount >= limits.headlines) ||
        (limits.hvco > 0 && u.hvcoGeneratedCount >= limits.hvco) ||
        (limits.heroMechanisms > 0 && u.heroMechanismGeneratedCount >= limits.heroMechanisms)
      );
    });

    const enrichedQuotaUsers = quotaLimitUsers.map((u) => {
      const tier = u.subscriptionTier || "trial";
      const limits = tier === "pro" ? PRO_LIMITS : TRIAL_LIMITS;
      const exhaustedGenerators: Array<{ type: string; used: number; limit: number }> = [];
      if (limits.icp > 0 && u.icpGeneratedCount >= limits.icp) exhaustedGenerators.push({ type: "ICP", used: u.icpGeneratedCount, limit: limits.icp });
      if (limits.adCopy > 0 && u.adCopyGeneratedCount >= limits.adCopy) exhaustedGenerators.push({ type: "Ad Copy", used: u.adCopyGeneratedCount, limit: limits.adCopy });
      if (limits.email > 0 && u.emailSeqGeneratedCount >= limits.email) exhaustedGenerators.push({ type: "Email", used: u.emailSeqGeneratedCount, limit: limits.email });
      if (limits.whatsapp > 0 && u.whatsappSeqGeneratedCount >= limits.whatsapp) exhaustedGenerators.push({ type: "WhatsApp", used: u.whatsappSeqGeneratedCount, limit: limits.whatsapp });
      if (limits.landingPages > 0 && u.landingPageGeneratedCount >= limits.landingPages) exhaustedGenerators.push({ type: "Landing Pages", used: u.landingPageGeneratedCount, limit: limits.landingPages });
      if (limits.offers > 0 && u.offerGeneratedCount >= limits.offers) exhaustedGenerators.push({ type: "Offers", used: u.offerGeneratedCount, limit: limits.offers });
      if (limits.headlines > 0 && u.headlineGeneratedCount >= limits.headlines) exhaustedGenerators.push({ type: "Headlines", used: u.headlineGeneratedCount, limit: limits.headlines });
      if (limits.hvco > 0 && u.hvcoGeneratedCount >= limits.hvco) exhaustedGenerators.push({ type: "HVCO", used: u.hvcoGeneratedCount, limit: limits.hvco });
      if (limits.heroMechanisms > 0 && u.heroMechanismGeneratedCount >= limits.heroMechanisms) exhaustedGenerators.push({ type: "Hero Mechanisms", used: u.heroMechanismGeneratedCount, limit: limits.heroMechanisms });
      const daysSinceActive = u.lastSignedIn
        ? Math.floor((Date.now() - new Date(u.lastSignedIn).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return { ...u, exhaustedGenerators, daysSinceActive };
    });

    return {
      inactiveUsers,
      quotaLimitUsers: enrichedQuotaUsers,
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

  // ── Part 2: Engagement Metrics ──
  getEngagementMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allUsers = await db.select().from(users);
    let allKits: any[] = [];
    try {
      allKits = await db.select().from(campaignKits);
    } catch { /* campaignKits table may not exist yet */ }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dau = allUsers.filter(u => u.lastSignedIn && new Date(u.lastSignedIn) > oneDayAgo).length;
    const wau = allUsers.filter(u => u.lastSignedIn && new Date(u.lastSignedIn) > sevenDaysAgo).length;

    const SLOT_FIELDS = ["selectedOfferId", "selectedMechanismId", "selectedHvcoId", "selectedHeadlineId", "selectedAdCopyId", "selectedLandingPageId", "selectedEmailSequenceId", "selectedWhatsAppSequenceId"];
    const avgNodes = allKits.length > 0
      ? allKits.reduce((sum: number, kit: any) => sum + SLOT_FIELDS.filter(f => kit[f] != null).length, 0) / allKits.length
      : 0;

    const completedKits = allKits.filter((k: any) => k.status === "complete").length;
    const completionRate = allKits.length > 0 ? (completedKits / allKits.length) * 100 : 0;

    const activatedUsers = allUsers.filter((u: any) => (u.icpGeneratedCount || 0) > 0).length;
    const activationRate = allUsers.length > 0 ? (activatedUsers / allUsers.length) * 100 : 0;

    return {
      dau,
      wau,
      avgNodes: Number(avgNodes.toFixed(1)),
      completionRate: Number(completionRate.toFixed(1)),
      activationRate: Number(activationRate.toFixed(1)),
    };
  }),

  // ── Part 3: Node Drop-Off ──
  getNodeDropOff: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    let allKits: any[] = [];
    try {
      allKits = await db.select().from(campaignKits);
    } catch { /* campaignKits table may not exist yet */ }
    const total = allKits.length || 1;

    const nodes = [
      { name: "Offer", field: "selectedOfferId" },
      { name: "Method", field: "selectedMechanismId" },
      { name: "Lead Magnet", field: "selectedHvcoId" },
      { name: "Headline", field: "selectedHeadlineId" },
      { name: "Ad Copy", field: "selectedAdCopyId" },
      { name: "Landing Page", field: "selectedLandingPageId" },
      { name: "Email", field: "selectedEmailSequenceId" },
      { name: "WhatsApp", field: "selectedWhatsAppSequenceId" },
    ];

    return nodes.map((n, i) => {
      const completed = allKits.filter((k: any) => k[n.field] != null).length;
      const prevCompleted = i === 0 ? total : allKits.filter((k: any) => k[nodes[i - 1].field] != null).length;
      const dropOff = prevCompleted > 0 ? ((prevCompleted - completed) / prevCompleted) * 100 : 0;
      return {
        name: n.name,
        completed,
        total,
        percentage: Number(((completed / total) * 100).toFixed(1)),
        dropOff: Number(dropOff.toFixed(1)),
      };
    });
  }),

  // ── Part 4: Extend Trial ──
  extendTrial: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const currentExpiry = user.trialEndsAt ? new Date(user.trialEndsAt) : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + 7 * 24 * 60 * 60 * 1000);
    await db.update(users).set({ trialEndsAt: newExpiry }).where(eq(users.id, input.userId));
    return { success: true, newTrialEndsAt: newExpiry };
  }),

  // ── Part 4: Send Magic Link ──
  sendMagicLink: adminProcedure.input(z.object({ email: z.string() })).mutation(async ({ input }) => {
    // Trigger the magic link request flow via internal HTTP call
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { getDb: getDatabase } = await import("../db");
    const { emailVerificationTokens } = await import("../../drizzle/schema");
    const crypto = await import("crypto");

    const database = await getDatabase();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [userRow] = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    // Delete old tokens
    await database.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userRow.id));

    // Create new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await database.insert(emailVerificationTokens).values({
      userId: userRow.id,
      token,
      expiresAt,
    });

    const baseUrl = (process.env.APP_URL || "https://zapcampaigns.com").replace(/\/$/, "");
    const magicUrl = `${baseUrl}/api/auth/magic?token=${token}`;

    await resend.emails.send({
      from: "ZAP <noreply@zapcampaigns.com>",
      to: input.email,
      subject: "Your ZAP sign-in link",
      html: `<p>Click <a href="${magicUrl}">here</a> to sign in to ZAP. This link expires in 15 minutes.</p>`,
    });

    return { success: true };
  }),

  // ── Part 4: Update User Notes ──
  updateUserNotes: adminProcedure.input(z.object({ userId: z.number(), notes: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(users).set({ notes: input.notes } as any).where(eq(users.id, input.userId));
    return { success: true };
  }),

  // ── Part 5: Impersonate User ──
  impersonateUser: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.email !== "arfeen@arfeenkhan.com") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new TRPCError({ code: "NOT_FOUND" });
    const { sdk } = await import("../_core/sdk");
    const token = await sdk.createSessionToken(target.openId, { name: target.name || "" });
    return { token, email: target.email, name: target.name };
  }),

  // ── Part 6: System Health v2 ──
  getSystemHealthV2: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { serverStatus: "offline" as const, recentErrors: [], totalCompletedJobs: 0 };

    let recentErrors: any[] = [];
    let completedJobCount = 0;
    try {
      recentErrors = await db.select().from(jobs)
        .where(eq(jobs.status, "failed"))
        .orderBy(desc(jobs.created_at))
        .limit(10);
      const completedJobs = await db.select().from(jobs)
        .where(eq(jobs.status, "complete"))
        .orderBy(desc(jobs.created_at))
        .limit(100);
      completedJobCount = completedJobs.length;
    } catch {
      // jobs table may not exist
    }

    return {
      serverStatus: "online" as const,
      recentErrors: recentErrors.map((e: any) => ({
        id: e.id,
        userId: e.userId,
        error: e.error,
        createdAt: e.created_at,
      })),
      totalCompletedJobs: completedJobCount,
    };
  }),
});
