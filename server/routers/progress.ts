import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import {
  services,
  idealCustomerProfiles,
  offers,
  heroMechanisms,
  hvcoTitles,
  headlines,
  adCopy,
  landingPages,
  emailSequences,
  whatsappSequences,
  metaPublishedAds,
  nodeSkips,
} from "../../drizzle/schema";

export const progressRouter = router({
  /**
   * Get user's campaign path completion for the 11-step V2 winding path.
   * Returns real completion booleans for each node — no time gate.
   * Node order matches V2Dashboard MILESTONE_TO_NODE mapping exactly:
   *   0 service → 1 icp → 2 offer → 3 heroMechanism → 4 hvco →
   *   5 headlines → 6 adCopy → 7 landingPage → 8 emailSequence →
   *   9 whatsappSequence → 10 campaign (metaPublishedAds)
   */
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userId = ctx.user.id;

    // Parallel queries — one per node, read-only, no schema changes
    const [
      userServices,
      userIcps,
      userOffers,
      userHeroMechanisms,
      userHvco,
      userHeadlines,
      userAdCopy,
      userLandingPages,
      userEmailSequences,
      userWhatsappSequences,
      userMetaPublished,
    ] = await Promise.all([
      // Node 1 — Service
      db.select({ id: services.id }).from(services).where(eq(services.userId, userId)).limit(1),
      // Node 2 — ICP
      db.select({ id: idealCustomerProfiles.id }).from(idealCustomerProfiles).where(eq(idealCustomerProfiles.userId, userId)).limit(1),
      // Node 3 — Offer
      db.select({ id: offers.id }).from(offers).where(eq(offers.userId, userId)).limit(1),
      // Node 4 — Unique Method (heroMechanism)
      db.select({ id: heroMechanisms.id }).from(heroMechanisms).where(eq(heroMechanisms.userId, userId)).limit(1),
      // Node 5 — Free Opt-In (hvcoTitles)
      db.select({ id: hvcoTitles.id }).from(hvcoTitles).where(eq(hvcoTitles.userId, userId)).limit(1),
      // Node 6 — Headlines
      db.select({ id: headlines.id }).from(headlines).where(eq(headlines.userId, userId)).limit(1),
      // Node 7 — Ad Copy
      db.select({ id: adCopy.id }).from(adCopy).where(eq(adCopy.userId, userId)).limit(1),
      // Node 8 — Landing Page
      db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.userId, userId)).limit(1),
      // Node 9 — Email Sequence
      db.select({ id: emailSequences.id }).from(emailSequences).where(eq(emailSequences.userId, userId)).limit(1),
      // Node 10 — WhatsApp Sequence
      db.select({ id: whatsappSequences.id }).from(whatsappSequences).where(eq(whatsappSequences.userId, userId)).limit(1),
      // Node 11 — Push to Meta / GoHighLevel (metaPublishedAds)
      db.select({ id: metaPublishedAds.id }).from(metaPublishedAds).where(eq(metaPublishedAds.userId, userId)).limit(1),
    ]);

    // Skipped nodes — per service, so we need the service id first
    const skippedRows = userServices.length > 0
      ? await db.select({ nodeType: nodeSkips.nodeType }).from(nodeSkips)
          .where(and(eq(nodeSkips.userId, userId), eq(nodeSkips.serviceId, userServices[0].id)))
      : [];
    const skippedSet = new Set(skippedRows.map(r => r.nodeType));

    // Milestone array — IDs must match MILESTONE_TO_NODE keys in V2Dashboard exactly
    const milestones = [
      { id: "service",          label: "Service defined",           completed: userServices.length > 0 },
      { id: "icp",              label: "Dream Buyer created",       completed: userIcps.length > 0 || skippedSet.has("icp") },
      { id: "offer",            label: "Offer crafted",             completed: userOffers.length > 0 || skippedSet.has("offer") },
      { id: "heroMechanism",    label: "Unique Method defined",     completed: userHeroMechanisms.length > 0 || skippedSet.has("heroMechanism") },
      { id: "hvco",             label: "Free Opt-In created",       completed: userHvco.length > 0 || skippedSet.has("hvco") },
      { id: "headlines",        label: "Headlines generated",       completed: userHeadlines.length > 0 || skippedSet.has("headlines") },
      { id: "adCopy",           label: "Ad Copy written",           completed: userAdCopy.length > 0 || skippedSet.has("adCopy") },
      { id: "landingPage",      label: "Landing Page built",        completed: userLandingPages.length > 0 || skippedSet.has("landingPage") },
      { id: "emailSequence",    label: "Email Sequence created",    completed: userEmailSequences.length > 0 || skippedSet.has("emailSequence") },
      { id: "whatsappSequence", label: "WhatsApp Sequence created", completed: userWhatsappSequences.length > 0 || skippedSet.has("whatsappSequence") },
      { id: "campaign",         label: "Pushed to Meta / GoHighLevel", completed: userMetaPublished.length > 0 },
    ];

    const completedCount = milestones.filter(m => m.completed).length;
    const totalCount = milestones.length;
    const progress = Math.round((completedCount / totalCount) * 100);

    return {
      visible: true,
      progress,
      completedCount,
      totalCount,
      milestones,
    };
  }),
});
