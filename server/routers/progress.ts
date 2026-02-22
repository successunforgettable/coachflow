import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { users, services, idealCustomerProfiles, offers, headlines, hvcoTitles, heroMechanisms, adCopy, landingPages, emailSequences, whatsappSequences, campaigns } from "../../drizzle/schema";

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

    // Check milestone completion for all 11 steps
    const [
      userServices,
      userIcps,
      userOffers,
      userHeadlines,
      userHvco,
      userHeroMechanisms,
      userAdCopy,
      userLandingPages,
      userEmailSequences,
      userWhatsappSequences,
      userCampaigns,
    ] = await Promise.all([
      db.select().from(services).where(eq(services.userId, userId)).limit(1),
      db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.userId, userId)).limit(1),
      db.select().from(offers).where(eq(offers.userId, userId)).limit(1),
      db.select().from(headlines).where(eq(headlines.userId, userId)).limit(1),
      db.select().from(hvcoTitles).where(eq(hvcoTitles.userId, userId)).limit(1),
      db.select().from(heroMechanisms).where(eq(heroMechanisms.userId, userId)).limit(1),
      db.select().from(adCopy).where(eq(adCopy.userId, userId)).limit(1),
      db.select().from(landingPages).where(eq(landingPages.userId, userId)).limit(1),
      db.select().from(emailSequences).where(eq(emailSequences.userId, userId)).limit(1),
      db.select().from(whatsappSequences).where(eq(whatsappSequences.userId, userId)).limit(1),
      db.select().from(campaigns).where(eq(campaigns.userId, userId)).limit(1),
    ]);

    // 11-step milestone sequence (logical flow)
    const milestones = [
      // Phase 1: Foundation (WHO + WHAT)
      {
        id: "service",
        label: "1. Service defined",
        completed: userServices.length > 0,
        route: "/services",
      },
      {
        id: "icp",
        label: "2. Dream Buyer created",
        completed: userIcps.length > 0,
        route: "/generators/icp",
      },
      {
        id: "offer",
        label: "3. Offer crafted",
        completed: userOffers.length > 0,
        route: "/offers",
      },
      // Phase 2: Content Creation (HOW)
      {
        id: "headlines",
        label: "4. Headlines generated",
        completed: userHeadlines.length > 0,
        route: "/headlines",
      },
      {
        id: "hvco",
        label: "5. HVCO titles created",
        completed: userHvco.length > 0,
        route: "/hvco-titles",
      },
      {
        id: "heroMechanism",
        label: "6. Hero mechanism defined",
        completed: userHeroMechanisms.length > 0,
        route: "/hero-mechanisms",
      },
      {
        id: "adCopy",
        label: "7. Ad copy written",
        completed: userAdCopy.length > 0,
        route: "/ad-copy",
      },
      // Phase 3: Campaign Assets (WHERE)
      {
        id: "landingPage",
        label: "8. Landing page built",
        completed: userLandingPages.length > 0,
        route: "/landing-pages",
      },
      {
        id: "emailSequence",
        label: "9. Email sequence created",
        completed: userEmailSequences.length > 0,
        route: "/generators/email",
      },
      {
        id: "whatsappSequence",
        label: "10. WhatsApp sequence created",
        completed: userWhatsappSequences.length > 0,
        route: "/generators/whatsapp",
      },
      // Phase 4: Launch (GO LIVE)
      {
        id: "campaign",
        label: "11. Campaign launched",
        completed: userCampaigns.length > 0,
        route: "/campaigns",
      },
    ];

    const completedCount = milestones.filter(m => m.completed).length;
    const totalCount = milestones.length;

    // Calculate progress percentage based on 11 steps
    const progress = Math.round((completedCount / totalCount) * 100);

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
