import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { users, services, idealCustomerProfiles, headlines, adCopy, landingPages } from "../../drizzle/schema";

export const progressRouter = router({
  /**
   * Get user's onboarding progress for the 30-day tracker
   * Returns progress percentage and milestone completion status
   */
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userId = ctx.user.id;

    // Check if user is within 30 days of signup
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new Error("User not found");

    const signupDate = new Date(user.createdAt);
    const now = new Date();
    const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
    const isWithin30Days = daysSinceSignup <= 30;

    // If past 30 days, return null to hide tracker
    if (!isWithin30Days) {
      return {
        visible: false,
        daysSinceSignup,
        progress: 100,
        milestones: [],
      };
    }

    // Check milestone completion
    const [
      userServices,
      userIcps,
      userHeadlines,
      userAdCopy,
      userLandingPages,
    ] = await Promise.all([
      db.select().from(services).where(eq(services.userId, userId)).limit(1),
      db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.userId, userId)).limit(1),
      db.select().from(headlines).where(eq(headlines.userId, userId)).limit(1),
      db.select().from(adCopy).where(eq(adCopy.userId, userId)).limit(1),
      db.select().from(landingPages).where(eq(landingPages.userId, userId)).limit(1),
    ]);

    const milestones = [
      {
        id: "service",
        label: "Service defined",
        completed: userServices.length > 0,
        route: "/services",
      },
      {
        id: "icp",
        label: "Dream Buyer created",
        completed: userIcps.length > 0,
        route: "/generators/icp",
      },
      {
        id: "headlines",
        label: "Headlines generated",
        completed: userHeadlines.length > 0,
        route: "/generators/headlines",
      },
      {
        id: "adCopy",
        label: "First ad copy created",
        completed: userAdCopy.length > 0,
        route: "/generators/ad-copy",
      },
      {
        id: "landingPage",
        label: "First landing page built",
        completed: userLandingPages.length > 0,
        route: "/generators/landing-pages",
      },
    ];

    const completedCount = milestones.filter(m => m.completed).length;
    const totalCount = milestones.length;

    // Calculate progress: 0%, 30%, 50%, 80%, or 100%
    let progress = 0;
    if (completedCount === 0) progress = 0;
    else if (completedCount === 1) progress = 30;
    else if (completedCount === 2) progress = 50;
    else if (completedCount === 3) progress = 50;
    else if (completedCount === 4) progress = 80;
    else if (completedCount === 5) progress = 100;

    return {
      visible: true,
      daysSinceSignup,
      progress,
      completedCount,
      totalCount,
      milestones,
    };
  }),
});
