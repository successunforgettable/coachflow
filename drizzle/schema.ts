import { bigint, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean, uniqueIndex, index, unique } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Native email/password auth
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  role: mysqlEnum("role", ["user", "admin", "superuser"]).default("user").notNull(),
  // Subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["trial", "pro", "agency"]).default("trial"),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "trialing"]).default("trialing"),
  trialEndsAt: timestamp("trialEndsAt"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  // Usage tracking fields
  icpGeneratedCount: int("icpGeneratedCount").default(0).notNull(),
  adCopyGeneratedCount: int("adCopyGeneratedCount").default(0).notNull(),
  emailSeqGeneratedCount: int("emailSeqGeneratedCount").default(0).notNull(),
  whatsappSeqGeneratedCount: int("whatsappSeqGeneratedCount").default(0).notNull(),
  landingPageGeneratedCount: int("landingPageGeneratedCount").default(0).notNull(),
  offerGeneratedCount: int("offerGeneratedCount").default(0).notNull(),
  headlineGeneratedCount: int("headlineGeneratedCount").default(0).notNull(),
  hvcoGeneratedCount: int("hvcoGeneratedCount").default(0).notNull(),
  heroMechanismGeneratedCount: int("heroMechanismGeneratedCount").default(0).notNull(),
  usageResetAt: timestamp("usageResetAt").defaultNow().notNull(),
  // Power Mode toggle
  powerMode: boolean("powerMode").default(false).notNull(),
  // User preferences
  dismissedWelcomeBanner: boolean("dismissedWelcomeBanner").default(false).notNull(),
  // Onboarding (Item 2.0)
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  onboardingStage: int("onboardingStage").default(1).notNull(),
  // Campaign Momentum Score (Item 2.0 — Duolingo streak equivalent)
  activityStreak: int("activityStreak").default(0).notNull(),
  lastActivityDate: date("lastActivityDate"),
  streakUpdatedAt: timestamp("streakUpdatedAt"),
  // Coach profile fields
  coachName: varchar("coach_name", { length: 255 }),
  coachGender: varchar("coach_gender", { length: 50 }),
  coachBackground: text("coach_background"),
  // Per-coach booking/calendar URL (migration 0086, APPLIED). Backs the discovery LP CTA
  // and the email/whatsapp [INSERT_BOOKING_URL] fallback. Promoted to a typed column now
  // 0086 is applied (was read via a guarded raw query pre-migration — see coachBookingUrl.ts).
  bookingUrl: varchar("booking_url", { length: 500 }),
  // Per-coach webinar/masterclass video URL (migration 0087, APPLIED). Powers the webinar
  // template hero media; ZAP never fabricates video. Promoted to a typed column now 0087 is
  // applied (was read via a guarded raw query pre-migration — see coachVideoUrl.ts).
  videoUrl: varchar("video_url", { length: 500 }),
  // Per-coach external checkout/enrolment URL (migration 0088, APPLIED). Backs the sales LP
  // CTA (ZAP has no payment integration); when NULL the sales page falls back to an email
  // capture. Promoted to a typed column now 0088 is applied (was read via a guarded raw query
  // pre-migration — see coachCheckoutUrl.ts).
  checkoutUrl: varchar("checkout_url", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Email verification tokens for native auth signup flow
 */
export const emailVerificationTokens = mysqlTable("emailVerificationTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Password reset tokens for forgot-password flow
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// CoachFlow Tables

/**
 * Source of Truth table - AI-generated comprehensive service profile
 * User fills in basic info → AI generates complete profile → User can edit
 */
export const sourceOfTruth = mysqlTable("sourceOfTruth", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  programName: varchar("programName", { length: 255 }).notNull(),
  coreOffer: text("coreOffer").notNull(),
  targetAudience: text("targetAudience").notNull(),
  mainPainPoint: text("mainPainPoint").notNull(),
  priceRange: varchar("priceRange", { length: 100 }),
  // AI-generated fields (editable)
  description: text("description"),
  targetCustomer: text("targetCustomer"),
  mainBenefits: text("mainBenefits"),
  painPoints: text("painPoints"),
  uniqueValue: text("uniqueValue"),
  idealCustomerAvatar: text("idealCustomerAvatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_sourceOfTruth_userId").on(table.userId),
}));

export type SourceOfTruth = typeof sourceOfTruth.$inferSelect;
export type InsertSourceOfTruth = typeof sourceOfTruth.$inferInsert;

/**
 * Services table - simplified vs Kong's products (6 fields vs 15)
 * Central hub for coach/speaker/consultant offerings
 */
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["coaching", "speaking", "consulting"]).notNull(),
  description: text("description").notNull(),
  targetCustomer: varchar("targetCustomer", { length: 500 }).notNull(),
  mainBenefit: varchar("mainBenefit", { length: 500 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  // Social proof fields (optional - for compliant marketing)
  totalCustomers: int("totalCustomers"), // Real customer count
  averageRating: decimal("averageRating", { precision: 3, scale: 2 }), // e.g., 4.85
  totalReviews: int("totalReviews"), // Number of reviews
  testimonial1Name: varchar("testimonial1Name", { length: 255 }),
  testimonial1Title: varchar("testimonial1Title", { length: 255 }),
  testimonial1Quote: text("testimonial1Quote"),
  testimonial2Name: varchar("testimonial2Name", { length: 255 }),
  testimonial2Title: varchar("testimonial2Title", { length: 255 }),
  testimonial2Quote: text("testimonial2Quote"),
  testimonial3Name: varchar("testimonial3Name", { length: 255 }),
  testimonial3Title: varchar("testimonial3Title", { length: 255 }),
  testimonial3Quote: text("testimonial3Quote"),
  pressFeatures: text("pressFeatures"), // Comma-separated list: "Forbes, Inc, TechCrunch"
  // Social proof stat for video authority badge (e.g., "900,000 STUDENTS TRAINED")
  socialProofStat: varchar("socialProofStat", { length: 255 }),
  // AutoPop fields (Phase 39 FIX 2)
  whyProblemExists: text("whyProblemExists"), // Root cause explanation
  hvcoTopic: varchar("hvcoTopic", { length: 300 }), // High-value content offer topic
  mechanismDescriptor: mysqlEnum("mechanismDescriptor", ["AI", "System", "Framework", "Method", "Blueprint", "Process"]), // How to describe the mechanism
  applicationMethod: varchar("applicationMethod", { length: 150 }), // How the mechanism is applied
  avatarName: varchar("avatarName", { length: 100 }), // Ideal customer name
  avatarTitle: varchar("avatarTitle", { length: 100 }), // Ideal customer title/role
  // AI-expanded onboarding fields (Item 1.1 — Build Plan March 1 2026)
  painPoints: text("painPoints"), // 3-5 specific pain points the ideal customer feels daily
  falseBeliefsVsRealReasons: text("falseBeliefsVsRealReasons"), // What they think is stopping them vs what really is
  failedSolutions: text("failedSolutions"), // What they have tried before and why it failed
  hiddenReasons: text("hiddenReasons"), // Real reasons behind their problem they would never admit
  riskReversal: text("riskReversal"), // Guarantee suggestion
  uniqueMechanismSuggestion: text("uniqueMechanismSuggestion"), // Proprietary method name suggestion
  // Program Vault fields (W0 sprint)
  bonuses: text("bonuses"), // JSON array: [{name, value, description}]
  guaranteeDuration: varchar("guaranteeDuration", { length: 100 }), // e.g. "90 days"
  guaranteeType: varchar("guaranteeType", { length: 255 }), // e.g. "Full refund"
  deliveryFormat: mysqlEnum("deliveryFormat", ["live", "online", "hybrid"]), // nullable
  deliveryDuration: varchar("deliveryDuration", { length: 100 }), // e.g. "12 weeks"
  paymentPlan: varchar("paymentPlan", { length: 255 }), // e.g. "3 x £1,000"
  earlyBirdPrice: decimal("earlyBirdPrice", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_services_userId").on(table.userId),
}));

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

/**
 * Campaigns table - organize all marketing assets
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Workstream commit 2 — extend campaignType enum from 4 → 7 values to
  // match prod DB (migration 0066 / db8c86e). Closes the commit-1→commit-2
  // drift window. Three new values (discovery_call / lead_magnet /
  // in_person_event) widen the inferred Campaign.campaignType TS type from
  // 4 to 7 string literals. No V1 cascade: the V1 hand-written CampaignType
  // literal in Stage1Questions.tsx + OnboardingFlow.tsx + campaignTemplates
  // .ts is TS-isolated, NOT derived from Drizzle inference.
  campaignType: mysqlEnum("campaignType", ["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"]),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed"]).default("draft").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  icpId: int("icp_id"), // Item 1.1b: campaign-specific ICP (FK to idealCustomerProfiles.id — declared without .references() to break circular TS cycle; constraint applied in migration SQL)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_campaigns_userId").on(table.userId),
  serviceIdIdx: index("idx_campaigns_serviceId").on(table.serviceId),
}));

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// Campaign Assets - Links generator outputs to campaigns
export const campaignAssets = mysqlTable("campaign_assets", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  assetType: mysqlEnum("assetType", [
    "headline",
    "hvco",
    "hero_mechanism",
    "ad_copy",
    "email_sequence",
    "whatsapp_sequence",
    "landing_page",
    "offer",
    "icp",
  ]).notNull(),
  assetId: varchar("assetId", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  campaignIdIdx: index("idx_campaign_assets_campaignId").on(table.campaignId),
  assetTypeIdx: index("idx_campaign_assets_assetType").on(table.assetType),
}));

export type CampaignAsset = typeof campaignAssets.$inferSelect;
export type InsertCampaignAsset = typeof campaignAssets.$inferInsert;

// Campaign Links - Visual connections between assets
export const campaignLinks = mysqlTable("campaign_links", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  sourceAssetId: int("sourceAssetId").notNull().references(() => campaignAssets.id, { onDelete: "cascade" }),
  targetAssetId: int("targetAssetId").notNull().references(() => campaignAssets.id, { onDelete: "cascade" }),
  linkType: mysqlEnum("linkType", ["leads_to", "supports", "requires"]).default("leads_to").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  campaignIdIdx: index("idx_campaign_links_campaignId").on(table.campaignId),
  sourceAssetIdIdx: index("idx_campaign_links_sourceAssetId").on(table.sourceAssetId),
  targetAssetIdIdx: index("idx_campaign_links_targetAssetId").on(table.targetAssetId),
}));

export type CampaignLink = typeof campaignLinks.$inferSelect;
export type InsertCampaignLink = typeof campaignLinks.$inferInsert;

/**
 * Ideal Customer Profiles - FULL Kong parity with 17 tabs
 * Expanded from 5 sections to match Kong's Dream Buyers exactly
 */
export const idealCustomerProfiles = mysqlTable("idealCustomerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  angleName: varchar("angle_name", { length: 255 }), // Item 1.1b: populated when ICP is generated from an angle suggestion
  
  // 17 Kong Tabs - Complete Parity
  introduction: text("introduction"), // Tab 1: Overview/intro
  fears: text("fears"), // Tab 2: What they're afraid of
  hopesDreams: text("hopesDreams"), // Tab 3: Aspirations
  // Tab 4 — snake_case is what every generator has always WRITTEN and what every
  // stored row holds. The prior camelCase $type was a lie the export formatter
  // believed, so the demographics table rendered empty for generated ICPs.
  // Read through normalizeDemographics() rather than indexing raw.
  demographics: json("demographics").$type<{ age_range?: string; gender?: string; income_level?: string; education?: string; occupation?: string; location?: string; family_status?: string; summary?: string }>(), // Tab 4
  psychographics: text("psychographics"), // Tab 5: Personality, lifestyle, attitudes
  pains: text("pains"), // Tab 6: Pain points (renamed from painPoints for clarity)
  frustrations: text("frustrations"), // Tab 7: Daily frustrations
  goals: text("goals"), // Tab 8: What they want to achieve
  values: text("values"), // Tab 9: Core values (split from valuesMotivations)
  objections: text("objections"), // Tab 10: Common objections to buying
  buyingTriggers: text("buyingTriggers"), // Tab 11: What makes them buy
  mediaConsumption: text("mediaConsumption"), // Tab 12: Where they consume content
  influencers: text("influencers"), // Tab 13: Who they follow/trust
  communicationStyle: text("communicationStyle"), // Tab 14: How they prefer to communicate
  decisionMaking: text("decisionMaking"), // Tab 15: How they make decisions
  successMetrics: text("successMetrics"), // Tab 16: How they measure success
  implementationBarriers: text("implementationBarriers"), // Tab 17: What stops them from taking action
  
  // Legacy fields for backward compatibility (will be migrated)
  painPoints: text("painPoints"), // Old field, will migrate to 'pains'
  desiredOutcomes: text("desiredOutcomes"), // Old field, will migrate to 'goals'
  valuesMotivations: text("valuesMotivations"), // Old field, will split to 'values' and 'goals'
  
  rating: int("rating").default(0),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),

  /**
   * Grounding provenance — OUT OF BAND (migration 0096).
   * Per-section stated / partial / inferred labels, which laddered follow-ups the
   * coach answered, and the R3 hits recorded at generation time. Deliberately NOT
   * inline in the 17 text fields: every downstream generator interpolates those
   * fields straight into its own prompt, so an inline marker would reach ad copy
   * and published landing pages. NULL on every pre-grounding row; no consumer
   * reads it, so it is additive to the field contract.
   */
  groundingMeta: json("groundingMeta").$type<Record<string, unknown>>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_icp_userId").on(table.userId),
  serviceIdIdx: index("idx_icp_serviceId").on(table.serviceId),
}));

export type IdealCustomerProfile = typeof idealCustomerProfiles.$inferSelect;
export type InsertIdealCustomerProfile = typeof idealCustomerProfiles.$inferInsert;

/**
 * Ad Copy - Facebook/social media ads (Kong parity: 15 variations per content type)
 * Grouped by adSetId with 3 content types: headline, body, link
 */
export const adCopy = mysqlTable("adCopy", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  adSetId: varchar("adSetId", { length: 21 }).notNull(), // nanoid for grouping
  adType: mysqlEnum("adType", ["lead_gen", "ecommerce"]).notNull(), // Kong: Lead Gen / Ecommerce
  adStyle: text("adStyle"), // Hero Ad, Weird Authority Ad, Secret Info, Commitment & Consistency
  adCallToAction: text("adCallToAction"), // Download free report, Watch free video, Book free call
  // `image_hook` (migration 0098) is the SHORT line baked into the picture. It exists so the
  // image surface stops carrying a 140-character truncation of a body's opening — the same
  // words on two of the three surfaces Meta fuses, which is the collapse case the copy
  // research names. Generated in Node 7 so it carries the same P.D.A.F. axes as the headline
  // and body it ships beside.
  contentType: mysqlEnum("contentType", ["headline", "body", "link", "image_hook"]).notNull(),
  bodyAngle: varchar("bodyAngle", { length: 50 }), // Angle type for body variations (Issue 3)
  content: text("content").notNull(), // The actual headline/body/link text
  // Generation parameters for regeneration - 17 Kong fields (expanded to text to handle AI-generated content)
  targetMarket: text("targetMarket"),
  productCategory: text("productCategory"),
  specificProductName: text("specificProductName"),
  pressingProblem: text("pressingProblem"),
  desiredOutcome: text("desiredOutcome"),
  uniqueMechanism: text("uniqueMechanism"),
  listBenefits: text("listBenefits"),
  specificTechnology: text("specificTechnology"),
  scientificStudies: text("scientificStudies"),
  credibleAuthority: text("credibleAuthority"),
  featuredIn: text("featuredIn"),
  numberOfReviews: text("numberOfReviews"),
  averageReviewRating: text("averageReviewRating"),
  totalCustomers: text("totalCustomers"),
  testimonials: text("testimonials"), // Kong: 511 char limit
  rating: int("rating").default(0),
  // Meta Compliance fields
  complianceScore: int("complianceScore"),
  complianceVersion: varchar("complianceVersion", { length: 20 }),
  complianceCheckedAt: timestamp("complianceCheckedAt"),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  // W5 Phase 2 — JSON array of plain-English violation reasons from
  // checkCompliance (issues[].reason). Lets the warning panel show the
  // actual issue count + reasons and feeds the "prefer stored over live"
  // path in complianceRewrites.generateMore. Nullable for legacy rows.
  violationReasons: json("violationReasons"),
  // ── 0097 — P.D.A.F. distinctness axes, recorded AT GENERATION TIME ─────────
  // See the matching block on `headlines`. On this table `format` reuses the
  // bodyAngle for body rows; headline and link rows carry whatever format label
  // the generator assigns them, and NULL where none is assigned yet.
  persona: text("persona"),
  desire: text("desire"),
  awareness: varchar("awareness", { length: 32 }),
  format: varchar("format", { length: 64 }),
  // ── Which CONCEPT supplied this row's desire (migration 0101) ──────────────
  // Step 4 pairs an ad's four surfaces so they descend from ONE concept. That join must
  // be on an integer: two concepts can share an awareness stage, `desire` is long free
  // text a generator may rephrase, and a silent mispair yields a plausible-looking but
  // internally incoherent ad with nothing anywhere to detect it.
  //
  // ⚠️ SCOPE: this records WHICH CONCEPT SUPPLIED THE DESIRE, and nothing more. Awareness
  // still comes from the cold-weighted `awarenessPlanForCount` allocation, deliberately
  // unchanged — making awareness concept-derived moves the deck's stage mix and needs its
  // own live re-proof. NULL on every row predating this, and on any row whose ICP had no
  // concepts; assembly must read NULL as "not concept-keyed", never as a default concept.
  conceptId: int("conceptId").references(() => campaignConcepts.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_adCopy_userId").on(table.userId),
  campaignIdIdx: index("idx_adCopy_campaignId").on(table.campaignId),
  adSetIdIdx: index("idx_adCopy_adSetId").on(table.adSetId),
}));

export type AdCopy = typeof adCopy.$inferSelect;
export type InsertAdCopy = typeof adCopy.$inferInsert;

/**
 * Email Sequences - NEW (Kong missing)
 */
export const emailSequences = mysqlTable("emailSequences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // Email Sequence wire commit 2 — extended from 3 → 6 values to match prod
  // DB enum (migration 0065). Closes the commit-1→commit-2 drift window:
  // commit 1 shipped only the SQL ALTER and intentionally deferred this
  // schema.ts edit to avoid V1 callsite cascade. Now widened simultaneously
  // with the server Zod schemas in routers/emailSequences.ts so the inferred
  // TS type and the runtime Zod parser stay in lockstep.
  // Workstream commit 3b — extend sequenceType enum from 6 → 10 values to
  // match prod DB (migration 0068 / 6c1ae5b). Closes the 3a → 3b drift
  // window. The 4 new values (discovery_call_confirmation /
  // discovery_call_reminder / event_logistics / replay_for_no_shows) are
  // wired via 4 net-new prompt builders + dispatcher refactor in this
  // commit. No V1 cascade — V1's EmailSequenceGenerator.tsx hardcodes a
  // 3-value TS literal independent of Drizzle inference.
  sequenceType: mysqlEnum("sequenceType", ["welcome", "engagement", "sales", "nurture", "launch", "re-engagement", "discovery_call_confirmation", "discovery_call_reminder", "event_logistics", "replay_for_no_shows"]),
  name: varchar("name", { length: 255 }).notNull(),
  emails: json("emails").$type<Array<{ day: number; subject: string; body: string; timing: string }>>().notNull(),
  automationEnabled: boolean("automationEnabled").default(false),
  rating: int("rating").default(0),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_emailSequences_userId").on(table.userId),
  campaignIdIdx: index("idx_emailSequences_campaignId").on(table.campaignId),
}));

export type EmailSequence = typeof emailSequences.$inferSelect;
export type InsertEmailSequence = typeof emailSequences.$inferInsert;

/**
 * WhatsApp Sequences - NEW (Kong missing)
 */
export const whatsappSequences = mysqlTable("whatsappSequences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // Workstream commit 4b — extend sequenceType from 2 → 6 values to match
  // prod DB (migration 0069 / f785392). Closes 4a → 4b drift window.
  // Channel-adjusted vs email's 10-value enum: WhatsApp omits launch (9-msg
  // spam-complaint risk), re-engagement, replay_for_no_shows (replay isn't
  // a WhatsApp channel), welcome (not standard for this channel). The 4
  // shared net-new types (discovery_call_confirmation / discovery_call_
  // reminder / nurture / event_logistics) are wired via 4 net-new prompt
  // builders + dispatcher refactor (ternary → 6-way switch) in this commit.
  // Zero V1 cascade — V1's WhatsAppSequenceGenerator.tsx hardcodes a 2-value
  // TS literal independent of Drizzle inference.
  sequenceType: mysqlEnum("sequenceType", ["engagement", "sales", "discovery_call_confirmation", "discovery_call_reminder", "nurture", "event_logistics"]),
  // Migration 0064 — user-selected tone for the generated sequence.
  // NULLable: rows generated before the tone wire (commit 2) carry NULL.
  tone: mysqlEnum("tone", ["conversational", "professional", "urgent", "authoritative"]),
  name: varchar("name", { length: 255 }).notNull(),
  messages: json("messages").$type<Array<{ day: number; message: string; timing: string; emojis: string[] }>>().notNull(),
  automationEnabled: boolean("automationEnabled").default(false),
  rating: int("rating").default(0),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_whatsappSequences_userId").on(table.userId),
  campaignIdIdx: index("idx_whatsappSequences_campaignId").on(table.campaignId),
}));

export type WhatsappSequence = typeof whatsappSequences.$inferSelect;
export type InsertWhatsappSequence = typeof whatsappSequences.$inferInsert;

/**
 * Landing Pages
 */
// Landing Page Content Type (all 16 sections)
export type LandingPageContent = {
  eyebrowHeadline: string;
  mainHeadline: string;
  subheadline: string;
  primaryCta: string;
  asSeenIn: string[]; // Logo names
  quizSection: {
    question: string;
    options: string[];
    answer: string;
  };
  problemAgitation: string;
  solutionIntro: string;
  whyOldFail: string;
  uniqueMechanism: string;
  testimonials: Array<{
    headline: string;
    quote: string;
    name: string;
    location: string;
  }>;
  // OFFER proof for THIS service (testimonials scoped to serviceId = this page's service). Additive
  // partition (2026-07-17): `testimonials` above now carries OFFER proof; `coachTestimonials` below
  // carries portable COACH proof (the coach's testimonials NOT scoped to this service — global or
  // another program). Both real-or-nothing, populated by realTestimonials.ts at publish. Optional so
  // every non-partitioned reader is unaffected.
  coachTestimonials?: Array<{
    headline: string;
    quote: string;
    name: string;
    location: string;
  }>;
  insiderAdvantages: string;
  scarcityUrgency: string;
  shockingStat: string;
  timeSavingBenefit: string;
  consultationOutline: Array<{
    title: string;
    description: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  guarantee: string;
  // Optional (additive). Lead-magnet "what's inside" feature tiles — up to 8 short,
  // qualitative, NON-numeric lines. Populated only by the lead_magnet_download cascade;
  // absent (undefined) for every other page type.
  featureHighlights?: string[];

  // ── Additive per-reference template fields (templates 2–9) ──────────────────
  // All OPTIONAL. Each template reads only what it needs and OMITS gracefully when a
  // field is absent (real-or-nothing — numeric proof and price are NEVER fabricated;
  // Burchard's `trustCount: null` precedent). Declared here as a stable READ SURFACE so
  // templates 2–9 never stall a build on a missing field. Structured GENERATION of these
  // is wired per-template when that template is built and gate-judged (the strict
  // json_schema in landingPageGenerator.ts is extended alongside each template so
  // existing lead-magnet generation is not changed under this infra sprint).
  eventSchedule?: {
    date?: string; time?: string; timezone?: string;
    durationMins?: number; endDate?: string; venue?: string; language?: string;
  };
  proofMetrics?: Array<{ label: string; value: string; icon?: string }>;
  caseStudies?: Array<{ name: string; quote: string; metrics?: string[]; portraitUrl?: string; chartUrl?: string }>;
  curriculum?: Array<{ title: string; emoji?: string }>;
  // Sales-page "build systems for" tile grid — up to 8 short, qualitative, NON-numeric
  // "how it helps" lines. Populated only by the sales_page cascade; absent for every other
  // page type. Deliberately SEPARATE from `featureHighlights` (which the Burchard lead-magnet
  // template reads) so activating sales generation never changes the shipped Burchard output.
  systemTiles?: string[];
  bonuses?: Array<{ title: string; description: string; value?: string; coverUrl?: string }>;
  // Operator-captured REAL price — never LLM-generated/fabricated. Absent → pricing omitted.
  price?: { amount: string; currency?: string; installments?: string };
};

export const landingPages = mysqlTable("landingPages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  
  // Product & Avatar Info
  productName: text("productName").notNull(),
  productDescription: text("productDescription").notNull(),
  avatarName: text("avatarName"), // e.g., "Amir from Abu Dhabi"
  avatarDescription: text("avatarDescription"), // e.g., "Expat Professional"
  
  // 4 Angle Variations (each contains all 16 sections)
  originalAngle: json("originalAngle").$type<LandingPageContent>(),
  godfatherAngle: json("godfatherAngle").$type<LandingPageContent>(),
  freeAngle: json("freeAngle").$type<LandingPageContent>(),
  dollarAngle: json("dollarAngle").$type<LandingPageContent>(),
  
  // Active angle (for display)
  activeAngle: mysqlEnum("activeAngle", ["original", "godfather", "free", "dollar"]).default("original"),

  // Workstream commit 5b — pageType drives prompt copy emphasis + intentional
  // section blanks within the existing 16-section LandingPageContent shape.
  // 5 values matching prod DB (migration 0070 / 78c3cce). Path A architecture:
  // sales_page = current behavior (all 16 sections); 4 new types use the
  // same shape with intentional blanks in non-relevant sections (renderer
  // already handles empty sections via ok(content.X) checks). NOT NULL
  // DEFAULT 'sales_page' — every existing row + every new row that omits
  // pageType continues to render as a long-form sales page. Zero V1 cascade
  // — V1 reads landingPages columns as string display, no narrowing.
  pageType: mysqlEnum("pageType", ["sales_page", "webinar_registration", "discovery_call_booking", "lead_magnet_download", "event_registration"]).notNull().default("sales_page"),

  // D4: Cloudflare Workers public URL
  publicSlug: varchar("publicSlug", { length: 255 }).unique(),
  publicUrl: varchar("publicUrl", { length: 500 }),
  // The 5 legacy render-only styles (executive/energetic/clinical/warm/bold) are kept in
  // the TS enum as a SUPERSET so the legacy renderTemplate path still type-checks, but they
  // are intentionally NOT in migration 0085's prod target — they must never persist as a
  // published style (that would re-ship the rejected energetic design). The 8 per-reference
  // template styles for templates 2–9 are additive; their builders land per-template.
  publishedStyle: mysqlEnum("publishedStyle", [
    "text", "visual", "executive", "energetic", "clinical", "warm", "bold",
    "lead_magnet_burchard",
    "discovery_burchard_performance",
    "webinar_rajsekar_coaching", "webinar_rajsekar_light", "webinar_rajsekar_marketing",
    "event_iman_gadzhi", "event_hormozi",
    "sales_ali_abdaal", "sales_ali_abdaal_light", "sales_jenna_kutcher",
    "lead_magnet_jeff_walker",
  ]).default("text"),

  rating: int("rating").default(0),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_landingPages_userId").on(table.userId),
  campaignIdIdx: index("idx_landingPages_campaignId").on(table.campaignId),
}));

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;

/**
 * Offers - Kong parity with 3 angle variations
 */
// Offer Content Type (all 7 sections)
export type OfferContent = {
  offerName: string;
  valueProposition: string;
  pricing: string;
  bonuses: string;
  guarantee: string;
  urgency: string;
  cta: string;
};

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  
  // Product Info
  productName: text("productName").notNull(),
  offerType: mysqlEnum("offerType", ["standard", "premium", "vip"]),
  
  // 3 Angle Variations (each contains all 7 sections)
  godfatherAngle: json("godfatherAngle").$type<OfferContent>(),
  freeAngle: json("freeAngle").$type<OfferContent>(),
  dollarAngle: json("dollarAngle").$type<OfferContent>(),
  
  // Active angle (for display)
  activeAngle: mysqlEnum("activeAngle", ["godfather", "free", "dollar"]).default("godfather"),
  
  rating: int("rating").default(0),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_offers_userId").on(table.userId),
  campaignIdIdx: index("idx_offers_campaignId").on(table.campaignId),
}));

export type Offer = typeof offers.$inferSelect;

/**
 * Bonuses (forward-sequence step 2, Layer 1) — the 3 generated bonuses per kit.
 * A DISTINCT entity: never services.bonuses (coach Program Vault) and never hvcoTitles
 * (would pollute the lead-magnet deck). One row per bonus, grouped by bonusSetId.
 * `value` is coach-supplied ONLY (never LLM-generated). assetBody + magnet URLs are Layer 2.
 */
export const bonuses = mysqlTable("bonuses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId"),
  campaignId: int("campaignId"),
  campaignKitId: int("campaignKitId"),
  bonusSetId: varchar("bonusSetId", { length: 191 }).notNull(),
  bonusType: mysqlEnum("bonusType", ["accelerator", "gap_filler", "objection_crusher"]).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(), // full buyer-facing copy → LP + Layer-2 PDF
  shortLine: varchar("shortLine", { length: 255 }).notNull(), // ~12-18 word outcome line → offer + email
  value: varchar("value", { length: 255 }), // coach-supplied £ figure only; NULL → no value line
  derivedFromObstacle: text("derivedFromObstacle").notNull(),
  format: varchar("format", { length: 50 }).notNull(), // checklist | template | script | sop | swipe | cheatsheet
  assetBody: json("assetBody"), // Layer 2: LeadMagnetBody for the hosted PDF
  magnetHtmlUrl: varchar("magnetHtmlUrl", { length: 500 }), // Layer 2
  magnetPdfUrl: varchar("magnetPdfUrl", { length: 500 }), // Layer 2
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_bonuses_userId").on(table.userId),
  kitIdx: index("idx_bonuses_kit").on(table.campaignKitId),
  setIdx: index("idx_bonuses_set").on(table.bonusSetId),
}));

export type Bonus = typeof bonuses.$inferSelect;
export type BonusType = "accelerator" | "gap_filler" | "objection_crusher";
export type InsertOffer = typeof offers.$inferInsert;

/**
 * Direct Response Headlines - Kong parity
 * 5 formula types: story, eyebrow, question, authority, urgency
 * Each generation creates 25 headlines (5 per formula type)
 */
export const headlines = mysqlTable("headlines", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // Headline set ID - groups 25 headlines from one generation
  headlineSetId: varchar("headlineSetId", { length: 50 }).notNull(),
  // Formula type determines structure
  formulaType: mysqlEnum("formulaType", ["story", "eyebrow", "question", "authority", "urgency"]).notNull(),
  // All headlines have main headline
  headline: text("headline").notNull(),
  // Optional fields depending on formula type
  subheadline: text("subheadline"), // Used by: eyebrow, authority
  eyebrow: varchar("eyebrow", { length: 255 }), // Used by: eyebrow
  // Input data used to generate (stored for regeneration)
  targetMarket: varchar("targetMarket", { length: 500 }).notNull(), // Increased from 255 to 500 (Phase 39 FIX 1)
  pressingProblem: text("pressingProblem").notNull(),
  desiredOutcome: text("desiredOutcome").notNull(),
  uniqueMechanism: text("uniqueMechanism").notNull(),
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
  // Meta compliance fields
  complianceScore: int("complianceScore").default(100),
  complianceVersion: varchar("complianceVersion", { length: 20 }),
  complianceCheckedAt: timestamp("complianceCheckedAt"),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  // W5 Phase 1 R2 — JSON array of plain-English violation reasons from
  // checkCompliance (issues[].reason). Lets the warning panel show actual
  // issue count and the exact reasons without re-running the checker on
  // every render. Nullable for legacy rows predating the column.
  violationReasons: json("violationReasons"),
  // ── 0097 — P.D.A.F. distinctness axes, recorded AT GENERATION TIME ─────────
  // The four dimensions that decide whether two pieces of copy are one Entity ID
  // or two. Written when the piece is generated so the distinctness gate compares
  // what was ASSIGNED, never a score inferred from the finished text.
  // `format` reuses the formula this headline was written to (formulaType) — it is
  // denormalised here so one gate reads one axis across headlines and adCopy alike.
  // NULL == generated before the axes were recorded.
  persona: text("persona"),
  desire: text("desire"),
  awareness: varchar("awareness", { length: 32 }),
  format: varchar("format", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_headlines_userId").on(table.userId),
  campaignIdIdx: index("idx_headlines_campaignId").on(table.campaignId),
  headlineSetIdIdx: index("idx_headlines_headlineSetId").on(table.headlineSetId),
}));

export type Headline = typeof headlines.$inferSelect;
export type InsertHeadline = typeof headlines.$inferInsert;

/**
 * HVCO Titles - Kong parity
 * 4 tabs: Long Titles, Short Titles, Beast Mode Titles, Subheadlines
 * Each generation creates ~20 title variations per tab
 * Titles use alliteration pattern: [Action/Benefit] [Crypto/Money Word] [Blueprint/Formula/Method]
 */
export const hvcoTitles = mysqlTable("hvcoTitles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // HVCO set ID - groups all titles from one generation
  hvcoSetId: varchar("hvcoSetId", { length: 50 }).notNull(),
  // Tab type determines title style
  tabType: mysqlEnum("tabType", ["long", "short", "beast_mode", "subheadlines"]).notNull(),
  // Title text
  title: varchar("title", { length: 500 }).notNull(),
  // Input data used to generate (stored for regeneration)
  targetMarket: varchar("targetMarket", { length: 500 }).notNull(), // Increased from 100 to 500 (Phase 39 FIX 1)
  hvcoTopic: text("hvcoTopic").notNull(), // 800 chars
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
  isFavorite: boolean("isFavorite").default(false),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  // Generated lead-magnet BODY (the actual deliverable content), stored as
  // structured JSON {format, title, ...}. Populated only for the SELECTED title
  // of a lead_magnet_download campaign (sparse — NULL for every other row and for
  // imported titles). Content only; hosting/PDF/delivery is a follow-on sprint.
  assetBody: json("assetBody"),
  // Delivery layer (Lead-Magnet Delivery sprint): the published deliverable's
  // stable URLs. magnetHtmlUrl = branded hosted page on Cloudflare KV (/p/{slug},
  // the source of truth); magnetPdfUrl = PDF rendered from that same page via
  // Cloudflare Browser Rendering, stored on Cloudinary. Sparse — populated only
  // for the selected title of a lead_magnet_download campaign, alongside assetBody.
  magnetHtmlUrl: varchar("magnetHtmlUrl", { length: 500 }),
  magnetPdfUrl: varchar("magnetPdfUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_hvcoTitles_userId").on(table.userId),
  campaignIdIdx: index("idx_hvcoTitles_campaignId").on(table.campaignId),
  hvcoSetIdIdx: index("idx_hvcoTitles_hvcoSetId").on(table.hvcoSetId),
}));

export type HvcoTitle = typeof hvcoTitles.$inferSelect;
export type InsertHvcoTitle = typeof hvcoTitles.$inferInsert;

/**
 * capturedLeads — ZAP-owned lead capture for the Lead-Magnet Delivery sprint.
 *
 * When a visitor opts in on a hosted magnet page, ZAP captures the lead HERE
 * (its own DB) and delivers the magnet instantly on-page. This holds the locked
 * GHL line: capture stays in ZAP; contacts.write stays dormant; the customer's
 * GHL only ever receives the magnet URL as a Custom Value (their follow-up layer).
 *
 * Data-handling is first-class (ZAP is now a processor of end-user PII):
 *  - email/name are ENCRYPTED at rest (AES-256-GCM via server/lib/piiCrypto, its
 *    own PII_ENCRYPTION_KEY — blast-radius-separate from OAuth token crypto).
 *  - emailHash is a keyed one-way HMAC used ONLY for dedup/lookup (the encrypted
 *    email is not queryable); it is never reversible to the address.
 *  - ipHash is hashed, never the raw IP (abuse/audit only).
 *  - consentText/privacyPolicyUrl store proof of the exact consent shown.
 *  - purgeAfter drives a retention reaper (24 months); onDelete cascade from
 *    users gives per-customer purge on account deletion; per-lead delete +
 *    per-customer export are exposed via the capturedLeads tRPC router.
 */
export const capturedLeads = mysqlTable("capturedLeads", {
  id: int("id").autoincrement().primaryKey(),
  // The ZAP customer who owns this lead.
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Campaign context (nullable — kept even if the service/campaign is later removed).
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  hvcoId: int("hvcoId").references(() => hvcoTitles.id, { onDelete: "set null" }),
  // PII — encrypted at rest ("enc:1:<iv>:<tag>:<ciphertext>").
  emailEncrypted: varchar("emailEncrypted", { length: 512 }).notNull(),
  // Keyed HMAC of the normalized email — dedup/lookup only, never reversible.
  emailHash: varchar("emailHash", { length: 64 }).notNull(),
  nameEncrypted: varchar("nameEncrypted", { length: 512 }),
  // Consent proof.
  consentGiven: boolean("consentGiven").default(false).notNull(),
  consentText: text("consentText"),
  privacyPolicyUrl: varchar("privacyPolicyUrl", { length: 500 }),
  // Provenance / abuse audit.
  sourceSlug: varchar("sourceSlug", { length: 255 }),
  ipHash: varchar("ipHash", { length: 64 }),
  userAgent: varchar("userAgent", { length: 500 }),
  // What was delivered.
  magnetHtmlUrl: varchar("magnetHtmlUrl", { length: 500 }),
  magnetPdfUrl: varchar("magnetPdfUrl", { length: 500 }),
  // Quiz forward-compat (built now, quiz itself is the next sprint): a quiz
  // opt-in persists the taken answers + the scored result band here. NULL for the
  // three static formats. No re-migration needed when quiz ships.
  submissionData: json("submissionData"),
  resultBand: varchar("resultBand", { length: 120 }),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // Retention: row is eligible for the purge reaper after this timestamp.
  purgeAfter: timestamp("purgeAfter"),
}, (table) => ({
  ownerIdx: index("idx_capturedLeads_userId").on(table.userId),
  purgeIdx: index("idx_capturedLeads_purgeAfter").on(table.purgeAfter),
  // Dedup a repeat opt-in for the same magnet by the same person.
  dedupUq: uniqueIndex("uq_capturedLeads_dedup").on(table.userId, table.emailHash, table.hvcoId),
}));

export type CapturedLead = typeof capturedLeads.$inferSelect;
export type InsertCapturedLead = typeof capturedLeads.$inferInsert;

/**
 * Hero Mechanisms - Kong parity
 * 3 tabs: Hero Mechanisms, Headline Ideas, Beast Mode
 * Each generation creates 5 mechanism variations per tab
 * Mechanisms have creative names + descriptors + full paragraph explanations
 */
export const heroMechanisms = mysqlTable("heroMechanisms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // Mechanism set ID - groups all mechanisms from one generation
  mechanismSetId: varchar("mechanismSetId", { length: 50 }).notNull(),
  // Tab type determines content style
  tabType: mysqlEnum("tabType", ["hero_mechanisms", "headline_ideas", "beast_mode"]).notNull(),
  // Mechanism content
  mechanismName: varchar("mechanismName", { length: 255 }).notNull(), // e.g., "Breakthrough Neural Nexus System"
  mechanismDescription: text("mechanismDescription").notNull(), // Full paragraph explanation
  // Input data used to generate (stored for regeneration)
  targetMarket: text("targetMarket").notNull(), // Expanded to text for AI-generated content
  pressingProblem: text("pressingProblem").notNull(), // Expanded to text for AI-generated content
  whyProblem: text("whyProblem").notNull(), // 300 chars
  whatTried: text("whatTried").notNull(), // 300 chars
  whyExistingNotWork: text("whyExistingNotWork").notNull(), // 300 chars
  descriptor: varchar("descriptor", { length: 50 }), // Strategy, Framework, Method, System, etc.
  application: varchar("application", { length: 100 }), // How it's applied
  desiredOutcome: text("desiredOutcome").notNull(), // Expanded to text for AI-generated content
  credibility: text("credibility").notNull(), // Expanded to text for AI-generated content
  socialProof: text("socialProof").notNull(), // Expanded to text for AI-generated content
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
  isFavorite: boolean("isFavorite").default(false),
  selectionScore: decimal("selectionScore", { precision: 5, scale: 2 }),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_heroMechanisms_userId").on(table.userId),
  campaignIdIdx: index("idx_heroMechanisms_campaignId").on(table.campaignId),
  mechanismSetIdIdx: index("idx_heroMechanisms_mechanismSetId").on(table.mechanismSetId),
}));

export type HeroMechanism = typeof heroMechanisms.$inferSelect;
export type InsertHeroMechanism = typeof heroMechanisms.$inferInsert;

/**
 * Analytics Events - Track individual user interactions
 * Supports email opens, clicks, conversions, and purchases
 */
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 255 }),
  assetType: varchar("assetType", { length: 50 }),
  eventType: mysqlEnum("eventType", ["email_open", "email_click", "link_click", "conversion", "purchase"]).notNull(),
  userIdentifier: varchar("userIdentifier", { length: 255 }), // email or user ID
  metadata: json("metadata"), // additional event data
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index("idx_analytics_campaign").on(table.campaignId),
  assetIdx: index("idx_analytics_asset").on(table.assetId),
  eventTypeIdx: index("idx_analytics_eventType").on(table.eventType),
  createdAtIdx: index("idx_analytics_createdAt").on(table.createdAt),
}));

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * Campaign Metrics - Aggregated daily metrics for faster queries
 * Updated nightly or on-demand for dashboard display
 */
export const campaignMetrics = mysqlTable("campaign_metrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  metricDate: date("metricDate").notNull(),
  emailOpens: int("emailOpens").default(0),
  emailClicks: int("emailClicks").default(0),
  linkClicks: int("linkClicks").default(0),
  conversions: int("conversions").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"),
  spend: decimal("spend", { precision: 10, scale: 2 }).default("0"), // ad spend for ROI
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueCampaignDate: unique("unique_campaign_date").on(table.campaignId, table.metricDate),
  metricDateIdx: index("idx_campaignMetrics_date").on(table.metricDate),
}));

export type CampaignMetric = typeof campaignMetrics.$inferSelect;
export type InsertCampaignMetric = typeof campaignMetrics.$inferInsert;

/**
 * User Onboarding - Track onboarding wizard progress
 * Helps new users complete their first workflow
 */
export const userOnboarding = mysqlTable("user_onboarding", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  currentStep: int("currentStep").default(1).notNull(), // 1-5
  completed: boolean("completed").default(false).notNull(),
  serviceId: int("serviceId"), // Step 1: Created service ID
  icpId: varchar("icpId", { length: 255 }), // Step 2: Generated ICP ID
  offerId: int("offerId"), // Step 3: Generated offer ID
  headlineSetId: varchar("headlineSetId", { length: 255 }), // Step 4: Generated headline set ID
  campaignId: int("campaignId"), // Step 5: Created campaign ID
  skipped: boolean("skipped").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  userIdx: index("idx_onboarding_user").on(table.userId),
}));

export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;

/**
 * Banned Phrases - Meta advertising compliance checker
 * Admin-editable list of phrases that violate Meta's ad policies
 */
export const bannedPhrases = mysqlTable("banned_phrases", {
  id: int("id").autoincrement().primaryKey(),
  phrase: varchar("phrase", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["critical", "warning"]).notNull(),
  description: text("description"), // Why this phrase is banned
  suggestion: text("suggestion"), // Alternative phrasing suggestion
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("idx_bannedPhrases_category").on(table.category),
  activeIdx: index("idx_bannedPhrases_active").on(table.active),
}));

export type BannedPhrase = typeof bannedPhrases.$inferSelect;
export type InsertBannedPhrase = typeof bannedPhrases.$inferInsert;

/**
 * Compliance Versions - Track Meta policy updates
 * Single row table storing current version and dates
 */
export const complianceVersions = mysqlTable("compliance_versions", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 50 }).notNull(), // e.g., "v1.0", "v1.1"
  lastUpdated: date("lastUpdated").notNull(),
  nextReviewDue: date("nextReviewDue").notNull(),
  notes: text("notes"), // What changed in this version
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComplianceVersion = typeof complianceVersions.$inferSelect;
export type InsertComplianceVersion = typeof complianceVersions.$inferInsert;

/**
 * Compliance History - Audit log for all compliance rule changes
 * Tracks who made changes, what changed, and when
 */
export const complianceHistory = mysqlTable("compliance_history", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(), // User who made the change
  adminUserName: varchar("adminUserName", { length: 255 }).notNull(),
  adminUserEmail: varchar("adminUserEmail", { length: 320 }).notNull(),
  action: mysqlEnum("action", ["add", "update", "delete", "import", "version_update"]).notNull(),
  phraseId: int("phraseId"), // NULL for imports and version updates
  phraseBefore: text("phraseBefore"), // JSON snapshot before change
  phraseAfter: text("phraseAfter"), // JSON snapshot after change
  details: text("details"), // Additional context (e.g., "Imported 50 phrases", "Updated to v1.2")
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComplianceHistory = typeof complianceHistory.$inferSelect;
export type InsertComplianceHistory = typeof complianceHistory.$inferInsert;

/**
 * Phrase Usage Stats - Track how often each banned phrase is caught
 * Used for analytics and identifying common compliance issues
 */
export const phraseUsageStats = mysqlTable("phrase_usage_stats", {
  id: int("id").autoincrement().primaryKey(),
  phraseId: int("phraseId").notNull(), // Reference to bannedPhrases
  phrase: varchar("phrase", { length: 255 }).notNull(), // Denormalized for performance
  category: mysqlEnum("category", ["critical", "warning"]).notNull(),
  userId: int("userId").notNull(), // User who triggered the check
  generatorType: varchar("generatorType", { length: 50 }).notNull(), // e.g., "adCopy", "headline", "email"
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PhraseUsageStats = typeof phraseUsageStats.$inferSelect;
export type InsertPhraseUsageStats = typeof phraseUsageStats.$inferInsert;

/**
 * Meta Access Tokens - Store Meta (Facebook) OAuth tokens for Ads Manager integration
 * Allows users to publish ads directly to Meta from CoachFlow
 */
export const metaAccessTokens = mysqlTable("meta_access_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One Meta connection per user
  accessToken: text("accessToken").notNull(), // Long-lived access token from Meta OAuth
  tokenExpiresAt: timestamp("tokenExpiresAt").notNull(), // When token expires
  adAccountId: varchar("adAccountId", { length: 255 }), // Selected Meta ad account ID
  adAccountName: varchar("adAccountName", { length: 255 }), // Human-readable ad account name
  businessId: varchar("businessId", { length: 255 }), // Meta Business Manager ID
  pageId: varchar("pageId", { length: 255 }), // Facebook Page ID for ad creatives
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  lastRefreshedAt: timestamp("lastRefreshedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MetaAccessToken = typeof metaAccessTokens.$inferSelect;
export type InsertMetaAccessToken = typeof metaAccessTokens.$inferInsert;

/**
 * GoHighLevel Access Tokens — mirrors Meta pattern
 */
export const ghlAccessTokens = mysqlTable("ghl_access_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt").notNull(),
  locationId: varchar("locationId", { length: 255 }),
  locationName: varchar("locationName", { length: 255 }),
  companyId: varchar("companyId", { length: 255 }),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GhlAccessToken = typeof ghlAccessTokens.$inferSelect;
export type InsertGhlAccessToken = typeof ghlAccessTokens.$inferInsert;

/**
 * Meta Published Ads - Links CoachFlow ad sets to Meta campaigns
 * Tracks which ads have been published to Meta and their current status
 */
export const metaPublishedAds = mysqlTable("meta_published_ads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  adSetId: varchar("adSetId", { length: 255 }).notNull(), // CoachFlow ad set ID
  metaCampaignId: varchar("metaCampaignId", { length: 255 }).notNull(), // Meta campaign ID
  metaAdSetId: varchar("metaAdSetId", { length: 255 }).notNull(), // Meta ad set ID
  metaAdId: varchar("metaAdId", { length: 255 }).notNull(), // Meta ad ID
  metaCreativeId: varchar("metaCreativeId", { length: 255 }).notNull(), // Meta creative ID
  campaignName: varchar("campaignName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).default("PAUSED").notNull(),
  objective: varchar("objective", { length: 100 }), // Campaign objective
  dailyBudget: decimal("dailyBudget", { precision: 10, scale: 2 }), // Daily budget in dollars
  // PROVENANCE (publish-path step 1): which gated adCopy rows actually shipped. Before this,
  // a published ad recorded no link back to the copy that produced it — `adSetId` was written
  // as the literal string "temp" (§8c), so nothing could be traced. NULL on legacy rows.
  headlineAdCopyId: int("headlineAdCopyId"),
  bodyAdCopyId: int("bodyAdCopyId"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_metaPublishedAds_userId").on(table.userId),
  adSetIdIdx: index("idx_metaPublishedAds_adSetId").on(table.adSetId),
}));

export type MetaPublishedAd = typeof metaPublishedAds.$inferSelect;
export type InsertMetaPublishedAd = typeof metaPublishedAds.$inferInsert;

/**
 * Campaign Performance Alerts - Monitors campaign metrics and notifies owner
 * Tracks alert rules and their trigger history
 */
export const campaignAlerts = mysqlTable("campaign_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  metaCampaignId: varchar("metaCampaignId", { length: 255 }), // Null = applies to all campaigns
  alertType: mysqlEnum("alertType", ["ctr_drop", "cpc_exceed", "spend_limit", "low_impressions"]).notNull(),
  threshold: decimal("threshold", { precision: 10, scale: 2 }).notNull(), // Threshold value (e.g., 1.5 for CTR%, 2.50 for CPC$)
  enabled: boolean("enabled").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  triggerCount: int("triggerCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_campaignAlerts_userId").on(table.userId),
  campaignIdIdx: index("idx_campaignAlerts_metaCampaignId").on(table.metaCampaignId),
}));

export type CampaignAlert = typeof campaignAlerts.$inferSelect;
export type InsertCampaignAlert = typeof campaignAlerts.$inferInsert;

/**
 * Ad Creatives - Scroll-Stopper Ad Creator generated images
 * Stores AI-generated tabloid-style ad creatives for Facebook/Instagram
 */
export const adCreatives = mysqlTable("adCreatives", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  // Input fields
  niche: varchar("niche", { length: 255 }).notNull(), // e.g., "crypto", "mind coaching"
  productName: varchar("productName", { length: 255 }).notNull(),
  uniqueMechanism: text("uniqueMechanism"), // e.g., "9-Step System"
  targetAudience: text("targetAudience").notNull(),
  mainBenefit: text("mainBenefit").notNull(),
  pressingProblem: text("pressingProblem").notNull(),
  // Generation settings
  adType: mysqlEnum("adType", ["lead_gen", "ecommerce"]).default("lead_gen").notNull(),
  styleType: mysqlEnum("styleType", ["tabloid", "lad_bible", "before_after", "stats", "meme", "testimonial", "question", "editorial"]).default("tabloid").notNull(),
  designStyle: mysqlEnum("designStyle", ["person_shocked", "screenshot", "person_intense", "object", "person_curious", "desk_focus", "workspace", "lean_in", "hero_object", "lobby_walk"]).notNull(),
  headlineFormula: mysqlEnum("headlineFormula", ["benefit", "social_proof", "curiosity", "contrast", "challenge"]).notNull(),
  // Generated content
  headline: varchar("headline", { length: 255 }).notNull(),
  imageUrl: text("imageUrl").notNull(), // Cloudinary URL to composited (headline baked in) image
  // Raw Flux output BEFORE headline compositing — lets recompositeText start
  // from a clean background so text-only edits don't leave ghost pixels from
  // the previous headline. Nullable for legacy rows predating this column.
  rawImageUrl: varchar("rawImageUrl", { length: 500 }),
  // The INTERMEDIATE render, uploaded by generateImage/generateEditorialImage under
  // `generated/…` before the raw and composited copies are stored above. Every render
  // produces THREE Cloudinary objects, and teardown could only ever see two of them —
  // so one leaked per render, permanently, because a DB delete never touches Cloudinary
  // and the URL is unrecoverable once the row is gone. Recorded here so the guarded
  // sweep can clear all three. Nullable and FORWARD-ONLY: rows written before this
  // column have no id to recover, and their orphans need a pattern-scoped listing sweep.
  sourceImageUrl: varchar("sourceImageUrl", { length: 500 }),
  // PROVENANCE (publish-path step 1): the gated `adCopy.id` whose text is baked onto this
  // picture. The publish path reads the headline off this row, so recording the source is
  // what lets anyone answer "did this ad actually ship gated copy?" after the fact. NULL
  // means the legacy template path produced the headline — which is itself the signal.
  headlineAdCopyId: int("headlineAdCopyId"),
  // ── THE CONCEPT WHOSE HEADLINE THIS PICTURE BAKES (step 3, migration 0102) ──
  // Carried as an INTEGER straight from the gated-copy resolver, beside the headlineAdCopyId
  // above. Step 4 pairs an ad's surfaces by concept identity; that join must never be on
  // matching desire or awareness text, because two concepts can share a stage and `desire` is
  // free text a generator may rephrase — a silent mispair looks perfectly plausible.
  //
  // ⚠️ ITS HONEST LIMIT — read this before treating it as "this image IS that concept".
  // It records where the picture's WORDS came from, not where its PICTURE came from:
  //   · the rendered SCENE follows `awarenessDeckPlan` (four distinct stages, coldest first),
  //     which is a separate allocation and is NOT concept-sourced. A creative stamped with a
  //     product_aware concept can depict a solution_aware scene.
  //   · the on-picture HOOK line comes from an `image_hook` adCopy row chosen independently
  //     (`resolveAdBodyTexts`), whose identity is discarded — its concept may differ from this.
  //
  // NULL means "not concept-keyed", never a default concept. It is NULL for every row
  // generated before 0102, for the editorial path, for the two router insert sites (three of
  // the five unwired fan-out sites — a creative they produce genuinely did not come from a
  // concept), and wherever the legacy template path supplied the headline.
  conceptId: int("conceptId").references(() => campaignConcepts.id, { onDelete: "set null" }),
  // ── WHICH image_hook ROW WAS BAKED ONTO THIS PICTURE (step 4a, migration 0103) ──
  // The companion to `headlineAdCopyId` above: that one records the picture's HEADLINE
  // surface, this one its short on-image hook line. Together they are what makes the
  // picture's words checkable by id.
  //
  // ⚠️ IT EXISTS BECAUSE THE HOOK IS THE ONE SURFACE A JOIN CANNOT RECOVER. An assembled
  // ad's concept is `headlineAdCopyId` → `adCopy.conceptId`, so it needs no column. Once
  // composited, the hook exists only as pixels inside a Cloudinary object; nothing else
  // anywhere records which row produced them, and recovering it by comparing baked text
  // would be exactly the string-matching this chapter refuses (hooks are short, the
  // compositor clamps and uppercases what it draws).
  //
  // NO FK and NO INDEX, deliberately — it follows `headlineAdCopyId`, not `conceptId`.
  // ON DELETE SET NULL is right for a grouping key and wrong for provenance: it would
  // erase the record of what was baked into a picture that still exists.
  //
  // NULL means "this row does not record a hook identity" — NOT "no hook was drawn". It is
  // NULL for every row rendered before 0103, for the editorial path and the two router
  // insert sites, and for the legacy fallback where the baked line is a 140-character
  // truncation of a BODY row rather than a purpose-built hook.
  hookAdCopyId: int("hookAdCopyId"),
  imageFormat: varchar("imageFormat", { length: 20 }).default("1080x1080").notNull(), // Square format
  // Editorial scene brief {mode, action, symbolicObject, zone} persisted at feed
  // batch time so an on-demand 9:16 vertical re-renders flux from the SAME scene
  // (one shoot with its feed version). NULL for tabloid (prompt is deterministic
  // from designStyle+niche+problem) and legacy rows.
  sceneBrief: json("sceneBrief"),
  // On-demand vertical 9:16 (1080x1920) composited asset — populated by
  // adCreatives.makeVertical for the concept the user picks. NULL until requested.
  verticalImageUrl: varchar("verticalImageUrl", { length: 500 }),
  // Comparison-card structured ✗/✓ pairs [{them, us}, ...] persisted at batch
  // time so the pure-render comparison card can reflow at 9:16 on demand — the
  // vertical re-renders from the SAME pairs (unlike quote/notification/testimonial,
  // which carry no persisted structured content and can't go vertical). NULL for
  // every other style and legacy rows.
  comparisonPairs: json("comparisonPairs"),
  // Meta compliance
  complianceChecked: boolean("complianceChecked").default(true).notNull(),
  complianceIssues: text("complianceIssues"), // JSON array of flagged issues
  // Batch info
  batchId: varchar("batchId", { length: 100 }), // Groups 5 variations together
  variationNumber: int("variationNumber").default(1).notNull(), // 1-5
  // Metadata
  rating: int("rating").default(0), // 0-5 stars
  downloaded: boolean("downloaded").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_adCreatives_userId").on(table.userId),
  serviceIdIdx: index("idx_adCreatives_serviceId").on(table.serviceId),
  campaignIdIdx: index("idx_adCreatives_campaignId").on(table.campaignId),
  batchIdIdx: index("idx_adCreatives_batchId").on(table.batchId),
  conceptIdIdx: index("idx_adCreatives_conceptId").on(table.conceptId),
}));

export type AdCreative = typeof adCreatives.$inferSelect;
export type InsertAdCreative = typeof adCreatives.$inferInsert;


/**
 * Video Credits - Credit balance for video generation
 * Each user has one record tracking their current balance
 */
export const videoCredits = mysqlTable("videoCredits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  balance: int("balance").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_videoCredits_userId").on(table.userId),
}));
export type VideoCredit = typeof videoCredits.$inferSelect;
export type InsertVideoCredit = typeof videoCredits.$inferInsert;

/**
 * Video Credit Transactions - Transaction history for credits
 * Tracks purchases, deductions, free grants, and refunds
 */
export const videoCreditTransactions = mysqlTable("videoCreditTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["purchase", "deduction", "free_grant", "refund"]).notNull(),
  amount: int("amount").notNull(), // Positive for purchases/grants, negative for deductions
  balanceAfter: int("balanceAfter").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  videoId: int("videoId"), // Reference to videos table (nullable)
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_videoCreditTransactions_userId").on(table.userId),
  videoIdIdx: index("idx_videoCreditTransactions_videoId").on(table.videoId),
}));
export type VideoCreditTransaction = typeof videoCreditTransactions.$inferSelect;
export type InsertVideoCreditTransaction = typeof videoCreditTransactions.$inferInsert;

/**
 * Video Scripts - AI-generated video scripts (free to generate)
 * Users can generate and edit scripts before spending credits on rendering
 */
export const videoScripts = mysqlTable("videoScripts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  videoType: mysqlEnum("videoType", [
    "explainer", 
    "proof_results", 
    "testimonial", 
    "mechanism_reveal"
  ]).notNull(),
  duration: mysqlEnum("duration", ["15", "30", "60", "90"]).notNull(),
  visualStyle: mysqlEnum("visualStyle", [
    "text_only",
    "kinetic_typography", 
    "motion_graphics", 
    "stats_card"
  ]).notNull(),
  scenes: json("scenes").notNull(), // Array of {sceneNumber, duration, voiceoverText, visualDirection, onScreenText}
  voiceoverText: text("voiceoverText").notNull(), // Concatenated voiceover from all scenes
  status: mysqlEnum("status", ["draft", "approved", "rendered", "failed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_videoScripts_userId").on(table.userId),
  serviceIdIdx: index("idx_videoScripts_serviceId").on(table.serviceId),
  campaignIdIdx: index("idx_videoScripts_campaignId").on(table.campaignId),
}));
export type VideoScript = typeof videoScripts.$inferSelect;
export type InsertVideoScript = typeof videoScripts.$inferInsert;

/**
 * Videos - Rendered video ads with voiceover
 * Costs 1-3 credits depending on duration (15-30s=1, 60s=2, 90s=3)
 */
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  scriptId: int("scriptId").notNull().references(() => videoScripts.id, { onDelete: "cascade" }),
  videoType: mysqlEnum("videoType", [
    "explainer", 
    "proof_results", 
    "testimonial", 
    "mechanism_reveal"
  ]).notNull(),
  duration: mysqlEnum("duration", ["15", "30", "60", "90"]).notNull(),
  visualStyle: mysqlEnum("visualStyle", [
    "text_only",
    "kinetic_typography", 
    "motion_graphics", 
    "stats_card"
  ]).notNull(),
  creatomateRenderId: varchar("creatomateRenderId", { length: 255 }),
  creatomateStatus: mysqlEnum("creatomateStatus", [
    "queued", 
    "rendering", 
    "succeeded", 
    "failed"
  ]).default("queued").notNull(),
  videoUrl: varchar("videoUrl", { length: 1000 }), // Creatomate video URL
  thumbnailUrl: varchar("thumbnailUrl", { length: 1000 }),
  fileSize: int("fileSize"), // In bytes
  creditsUsed: int("creditsUsed").notNull(), // 1, 2, or 3 based on duration
  sentToMetaAt: timestamp("sentToMetaAt"),
  metaCreativeId: varchar("metaCreativeId", { length: 255 }), // Meta Ads Manager creative ID
  rating: int("rating").default(0), // 0-5 stars
  title: varchar("title", { length: 255 }), // e.g. "Incredible You — IDENTITY Ad (5 scenes, 98 words)"
  angle: varchar("angle", { length: 50 }), // e.g. "IDENTITY"
  nicheWorld: varchar("nicheWorld", { length: 100 }), // e.g. "coaching certification"
  wordCount: int("wordCount"), // total words in script
  actualDuration: int("actualDuration"), // actual rendered duration in seconds from Creatomate
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_videos_userId").on(table.userId),
  serviceIdIdx: index("idx_videos_serviceId").on(table.serviceId),
  campaignIdIdx: index("idx_videos_campaignId").on(table.campaignId),
  scriptIdIdx: index("idx_videos_scriptId").on(table.scriptId),
}));
export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

/**
 * Demo Videos Table
 * Stores ZAP flagship demo videos with hardcoded script
 * Separate from main video generation system
 */
export const demoVideos = mysqlTable("demoVideos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull().default("ZAP Demo Video"),
  description: text("description"),
  creatomateRenderId: varchar("creatomateRenderId", { length: 255 }),
  creatomateStatus: mysqlEnum("creatomateStatus", [
    "queued", 
    "rendering", 
    "succeeded", 
    "failed"
  ]).default("queued").notNull(),
  videoUrl: varchar("videoUrl", { length: 1000 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 1000 }),
  fileSize: int("fileSize"),
  duration: int("duration").default(30).notNull(), // Always 30 seconds
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DemoVideo = typeof demoVideos.$inferSelect;
export type InsertDemoVideo = typeof demoVideos.$inferInsert;

/**
 * Meta Connections - OAuth connection to Meta Ads Manager
 * Stores access token and ad account info for pushing videos/images
 */
export const metaConnections = mysqlTable("metaConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  metaUserId: varchar("metaUserId", { length: 255 }).notNull(),
  adAccountId: varchar("adAccountId", { length: 255 }).notNull(),
  adAccountName: varchar("adAccountName", { length: 255 }),
  pageId: varchar("pageId", { length: 255 }),
  pageName: varchar("pageName", { length: 255 }),
  accessToken: text("accessToken").notNull(),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_metaConnections_userId").on(table.userId),
}));
export type MetaConnection = typeof metaConnections.$inferSelect;
export type InsertMetaConnection = typeof metaConnections.$inferInsert;

/**
 * ICP Angle Suggestions — Item 1.1b
 * Stores AI-generated audience segment suggestions for a service.
 * User picks 1-3 and full ICPs are generated from them.
 */
export const icpAngleSuggestions = mysqlTable("icp_angle_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  angleName: varchar("angle_name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  primaryPain: text("primary_pain").notNull(),
  primaryBuyingTrigger: text("primary_buying_trigger").notNull(),
  status: varchar("status", { length: 50 }).default("suggested"),
  icpId: int("icp_id").references(() => idealCustomerProfiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  serviceIdIdx: index("idx_icp_angle_suggestions_serviceId").on(table.serviceId),
  userIdIdx: index("idx_icp_angle_suggestions_userId").on(table.userId),
}));
export type IcpAngleSuggestion = typeof icpAngleSuggestions.$inferSelect;
export type InsertIcpAngleSuggestion = typeof icpAngleSuggestions.$inferInsert;

/**
 * campaignConcepts — the Andromeda per-concept fan-out source (EXECUTION_BRIEF §2/§8).
 * "One person, many angles": N concepts vary Desire × Awareness WITHIN one ICP (persona fixed to the
 * ICP). Distinct from icp_angle_suggestions (which is per-service, pre-ICP, the onboarding persona-picker).
 * Each row carries the ad-copy payload {hook, headline, shortText, longText} read downstream by ad copy,
 * the video-script generator, and the LP hook variant. Awareness = Schwartz 5-stage enum; hookPattern =
 * the 6 named patterns. Additive, zero risk to onboarding. DRAFT-only — nothing here reaches Meta until
 * the separate, approval-gated publishToMeta action.
 */
export const campaignConcepts = mysqlTable("campaignConcepts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  icpId: int("icpId").notNull().references(() => idealCustomerProfiles.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  conceptSetId: varchar("conceptSetId", { length: 191 }).notNull(), // groups one generation batch
  personaLabel: varchar("personaLabel", { length: 255 }), // snapshot of the ICP name/angle (persona is fixed)
  desire: text("desire").notNull(), // which pain/goal this concept leads with (the Desire axis)
  awareness: mysqlEnum("awareness", [
    "unaware",
    "problem_aware",
    "solution_aware",
    "product_aware",
    "most_aware",
  ]).notNull(),
  hookPattern: mysqlEnum("hookPattern", [
    "problem_first",
    "founder_authenticity",
    "social_proof",
    "aspirational_transformation",
    "meme_humor",
    "data_chart",
    "direct_offer_urgency",
  ]).notNull(),
  hook: text("hook").notNull(),
  headline: text("headline").notNull(),
  shortText: text("shortText").notNull(),
  longText: text("longText").notNull(),
  status: mysqlEnum("status", ["draft", "selected", "dismissed"]).default("draft").notNull(),
  rating: int("rating").default(0),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_campaignConcepts_userId").on(table.userId),
  icpIdIdx: index("idx_campaignConcepts_icpId").on(table.icpId),
  setIdx: index("idx_campaignConcepts_set").on(table.conceptSetId),
}));
export type CampaignConcept = typeof campaignConcepts.$inferSelect;
export type InsertCampaignConcept = typeof campaignConcepts.$inferInsert;

/**
 * conceptScripts — the Andromeda per-concept video SCRIPT (a coach records it themselves for a Meta ad).
 * One script per campaignConcepts row, written to that concept's persona/desire/awareness/hookPattern.
 * Scenes hold {sceneNumber, sceneType, spokenLine, onScreenText, deliveryNote} for a human presenter (NOT
 * render/pexels fields — the credit-render tool in videoScripts is untouched and unused here). A NEW table
 * (not videoScripts) to avoid the credit-render coupling and to key on conceptId. Additive, zero risk.
 * DRAFT-only — nothing here reaches Meta until publishToMeta. Video generation + upload→push = separate pass.
 */
export const conceptScripts = mysqlTable("conceptScripts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptId: int("conceptId").notNull().references(() => campaignConcepts.id, { onDelete: "cascade" }),
  icpId: int("icpId").references(() => idealCustomerProfiles.id, { onDelete: "set null" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  scriptSetId: varchar("scriptSetId", { length: 191 }).notNull(),
  awareness: mysqlEnum("awareness", [
    "unaware",
    "problem_aware",
    "solution_aware",
    "product_aware",
    "most_aware",
  ]).notNull(),
  hookPattern: mysqlEnum("hookPattern", [
    "problem_first",
    "founder_authenticity",
    "social_proof",
    "aspirational_transformation",
    "meme_humor",
    "data_chart",
    "direct_offer_urgency",
  ]).notNull(),
  targetLengthSeconds: int("targetLengthSeconds").notNull(),
  scenes: json("scenes").notNull(), // [{sceneNumber, sceneType, spokenLine, onScreenText, deliveryNote}]
  teleprompter: text("teleprompter").notNull(), // concatenated spokenLines
  status: mysqlEnum("status", ["draft", "selected", "dismissed"]).default("draft").notNull(),
  source: mysqlEnum("source", ["generated", "imported"]).default("generated").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_conceptScripts_userId").on(table.userId),
  conceptIdIdx: index("idx_conceptScripts_conceptId").on(table.conceptId),
  setIdx: index("idx_conceptScripts_set").on(table.scriptSetId),
}));
export type ConceptScript = typeof conceptScripts.$inferSelect;
export type InsertConceptScript = typeof conceptScripts.$inferInsert;

/**
 * Admin Audit Log — tracks all admin actions with full before/after details
 */
export const adminAuditLog = mysqlTable("admin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("admin_user_id").notNull().references(() => users.id),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  targetUserId: int("target_user_id").references(() => users.id),
  details: text("details").default("{}").notNull(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  adminUserIdIdx: index("idx_audit_adminUserId").on(table.adminUserId),
  targetUserIdIdx: index("idx_audit_targetUserId").on(table.targetUserId),
  createdAtIdx: index("idx_audit_createdAt").on(table.createdAt),
}));
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

/**
 * User Notes — internal admin notes on user accounts
 */
export const userNotes = mysqlTable("user_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adminUserId: int("admin_user_id").notNull().references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_userNotes_userId").on(table.userId),
}));
export type UserNote = typeof userNotes.$inferSelect;
export type InsertUserNote = typeof userNotes.$inferInsert;

/**
 * Content Flags — flagged generated content for moderation
 */
export const contentFlags = mysqlTable("content_flags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  contentId: int("content_id").notNull(),
  contentText: text("content_text"),
  flagReason: text("flag_reason"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  resolvedBy: int("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_contentFlags_userId").on(table.userId),
  statusIdx: index("idx_contentFlags_status").on(table.status),
}));
export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = typeof contentFlags.$inferInsert;

/**
 * System Health Metrics — periodic snapshots of system health data
 */
export const systemHealthMetrics = mysqlTable("system_health_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricDate: timestamp("metric_date").notNull(),
  apiErrorCount: int("api_error_count").default(0),
  apiSuccessCount: int("api_success_count").default(0),
  llmErrorCount: int("llm_error_count").default(0),
  llmSuccessCount: int("llm_success_count").default(0),
  webhookDeliverySuccess: int("webhook_delivery_success").default(0),
  webhookDeliveryFailed: int("webhook_delivery_failed").default(0),
  storageUsageBytes: bigint("storage_usage_bytes", { mode: "number" }).default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SystemHealthMetric = typeof systemHealthMetrics.$inferSelect;
export type InsertSystemHealthMetric = typeof systemHealthMetrics.$inferInsert;

// ---------------------------------------------------------------------------
// Coach Assets — uploaded images (headshot, logo, social proof)
// ---------------------------------------------------------------------------
export const coachAssets = mysqlTable("coachAssets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Per-LP scoping: NULL = per-user (headshot, logo, press_logo, social_proof),
  // set = per-landing-page (hero_image). Migration 0082.
  landingPageId: int("landingPageId").references(() => landingPages.id, { onDelete: "cascade" }),
  assetType: varchar("assetType", { length: 50 }).notNull(), // 'headshot', 'logo', 'social_proof', 'hero_image', 'press_logo'
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  landingPageIdIdx: index("idx_coachAssets_landingPageId").on(table.landingPageId),
}));
export type CoachAsset = typeof coachAssets.$inferSelect;
export type InsertCoachAsset = typeof coachAssets.$inferInsert;

// ---------------------------------------------------------------------------
// Testimonial Library — persistent, reusable testimonials across campaigns
// ---------------------------------------------------------------------------
export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceId: int("serviceId"),
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  quote: text("quote").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_testimonials_userId").on(table.userId),
  serviceIdIdx: index("idx_testimonials_serviceId").on(table.serviceId),
}));
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

// ---------------------------------------------------------------------------
// Background job queue table for async AI generation polling
// ---------------------------------------------------------------------------
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  userId: varchar("userId", { length: 36 }).notNull().default(""), // Owner — used for ownership check in GET /api/jobs/:jobId
  // Auto Mode Phase 0: 'running' added for multi-step orchestrators. Reaper
  // (server/_core/index.ts:67) filters on status='pending' only, so 'running'
  // jobs are never swept. Single-step generators continue using
  // pending → complete/failed; only Auto Mode-class orchestrators transition
  // through pending → running → complete/failed. Migration: 0071.
  status: mysqlEnum("status", ["pending", "complete", "failed", "running"]).notNull().default("pending"),
  result: text("result"), // JSON stored as longtext-compatible text
  error: varchar("error", { length: 1024 }),
  progress: text("progress"), // JSON: { step: number, total: number, label: string } — updated during generation
  retryCount: int("retry_count").notNull().default(0), // Number of automatic retries attempted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ---------------------------------------------------------------------------
// Campaign Kits — assembled campaigns linking selected items from each node
// ---------------------------------------------------------------------------
export const campaignKits = mysqlTable("campaignKits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  icpId: int("icpId").notNull(),
  name: varchar("name", { length: 255 }),
  status: mysqlEnum("status", ["draft", "complete", "exported"]).default("draft").notNull(),
  // Workstream commit 2.5b — Option A catch-up. campaignType added to match
  // prod DB (migration 0067 / 30fde57). 7-value enum identical to
  // campaigns.campaignType (migration 0066). Nullable: existing kit rows
  // pre-date this column. Generators default to course_launch when null.
  // Closes the 2.5a → 2.5b drift window. Zero V1 cascade — campaignKits is
  // V2-only (audited: 0 references in client/src/pages/ or client/src/
  // components/), so widening the inferred CampaignKit TS type does not
  // reach the V1 hand-written CampaignType literal.
  campaignType: mysqlEnum("campaignType", ["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"]),
  selectedOfferId: int("selectedOfferId"),
  selectedMechanismId: int("selectedMechanismId"),
  selectedHvcoId: int("selectedHvcoId"),
  selectedHeadlineId: int("selectedHeadlineId"),
  selectedAdCopyId: int("selectedAdCopyId"),
  selectedLandingPageId: int("selectedLandingPageId"),
  selectedLandingPageAngle: varchar("selectedLandingPageAngle", { length: 50 }),
  selectedEmailSequenceId: int("selectedEmailSequenceId"),
  selectedWhatsAppSequenceId: int("selectedWhatsAppSequenceId"),
  // Phase C C1 (migration 0072): pointer to the adCreatives.batchId
  // varchar(100) that the Auto Mode cascade's adCreatives step produces.
  // Nullable for legacy kits predating C1; required-for-completion for
  // new Auto Mode runs (autoSelectBest's isComplete check at
  // server/routers/campaignKits.ts L51-59 includes this field).
  selectedAdCreativeBatchId: varchar("selectedAdCreativeBatchId", { length: 100 }),
  // Trail Sprint 1 (migration 0076): which entry path the user chose.
  // Nullable: pre-Trail kits have no path. Mutable: users can switch mid-campaign.
  path: mysqlEnum("path", ["auto", "manual", "has_assets"]),
  // Style options (migration 0078): user's chosen ad-image style.
  // NULL = photo_ad (existing Flux pipeline). "quote_card:navy" etc for quote cards.
  adImageStyle: varchar("adImageStyle", { length: 50 }),
  // Campaign facts (migration 0090, Phase 1 / Problem A): operator facts captured UPFRONT in the wizard —
  // date/time/timezone/venue + price — BEFORE any generation node, so email/whatsapp/LP generate with REAL
  // values instead of hardcoded sequenceLength:3 + [INSERT_*] placeholders patched later. Typed to the
  // eventSchedule + price sub-shape of LandingPageContent so the intake resolver (deriveOperatorQuestions /
  // applyOperatorAnswer) works against it VERBATIM. Booking/video/checkout stay coach-level (users columns).
  // Read by orchestration's emailSequence / whatsappSequence / landingPage steps (wizard path only).
  campaignFacts: json("campaignFacts").$type<{ eventSchedule?: LandingPageContent["eventSchedule"]; price?: LandingPageContent["price"] }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CampaignKit = typeof campaignKits.$inferSelect;
export type InsertCampaignKit = typeof campaignKits.$inferInsert;

// ---------------------------------------------------------------------------
// Node Statuses — explicit status per node per campaign kit (Trail Sprint 1)
// Completion was previously inferred from selected*Id != null on campaignKits.
// That inference is UNCHANGED — this table adds imported/stale tracking only.
// ---------------------------------------------------------------------------
export const nodeStatuses = mysqlTable("nodeStatuses", {
  id: int("id").autoincrement().primaryKey(),
  campaignKitId: int("campaignKitId").notNull(),
  nodeType: varchar("nodeType", { length: 30 }).notNull(),
  status: mysqlEnum("status", ["generated", "imported", "stale", "dismissed", "needs_publish"]).notNull().default("generated"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueKitNode: uniqueIndex("nodeStatuses_kitId_nodeType_unique").on(table.campaignKitId, table.nodeType),
}));
export type NodeStatus = typeof nodeStatuses.$inferSelect;
export type InsertNodeStatus = typeof nodeStatuses.$inferInsert;

// ---------------------------------------------------------------------------
// Chat Transcripts — persisted chat message list per campaign kit (Trail Sprint 1)
// Read only by the Trail's ChatThread on mount/resume. Write-only-new.
// ---------------------------------------------------------------------------
export const chatTranscripts = mysqlTable("chatTranscripts", {
  id: int("id").autoincrement().primaryKey(),
  campaignKitId: int("campaignKitId").notNull(),
  messages: json("messages").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueKit: uniqueIndex("chatTranscripts_kitId_unique").on(table.campaignKitId),
}));
export type ChatTranscript = typeof chatTranscripts.$inferSelect;
export type InsertChatTranscript = typeof chatTranscripts.$inferInsert;

// ---------------------------------------------------------------------------
// Favourites — persisted thumbs-up state per user per node item
// ---------------------------------------------------------------------------
export const favourites = mysqlTable("favourites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  nodeId: varchar("nodeId", { length: 50 }).notNull(), // e.g. "headlines", "adCopy", "emailSequence"
  itemIndex: int("itemIndex").notNull(), // index of the item within the node's result list
  itemText: text("itemText"), // snapshot of the item text at time of favourite
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Favourite = typeof favourites.$inferSelect;
export type InsertFavourite = typeof favourites.$inferInsert;

// ---------------------------------------------------------------------------
// Product usage events — tracks user_generated, user_upgraded, node_completed
// ---------------------------------------------------------------------------
export const productEvents = mysqlTable("product_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(), // user_generated, user_upgraded, node_completed
  metadata: json("metadata"), // { nodeType, serviceId, tier, etc. }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_product_events_userId").on(table.userId),
  eventTypeIdx: index("idx_product_events_eventType").on(table.eventType),
  createdAtIdx: index("idx_product_events_createdAt").on(table.createdAt),
}));
export type ProductEvent = typeof productEvents.$inferSelect;
export type InsertProductEvent = typeof productEvents.$inferInsert;

// ---------------------------------------------------------------------------
// Node Skips — tracks which wizard nodes a user has skipped per service
// ---------------------------------------------------------------------------
export const nodeSkips = mysqlTable("nodeSkips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").notNull().references(() => services.id, { onDelete: "cascade" }),
  nodeType: varchar("nodeType", { length: 50 }).notNull(),
  skippedAt: timestamp("skippedAt").defaultNow().notNull(),
}, (table) => ({
  uniqueSkip: uniqueIndex("nodeSkips_userId_serviceId_nodeType_unique").on(table.userId, table.serviceId, table.nodeType),
}));
export type NodeSkip = typeof nodeSkips.$inferSelect;
export type InsertNodeSkip = typeof nodeSkips.$inferInsert;

// ---------------------------------------------------------------------------
// Compliance Rewrites (W5 — Compliance Rewrite Engine)
// Pre-computed and on-demand compliant rewrites for flagged generated content.
// Phase 1 populates sourceTable='headlines'; Phases 2/3 extend to adCopy and
// landingPage. All writes are gated on ENABLE_COMPLIANCE_REWRITES — when the
// flag is off (production default during development), no rows are inserted
// and the panel never renders.
// ---------------------------------------------------------------------------
export const complianceRewrites = mysqlTable("complianceRewrites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Denormalised for the free-tier cap count (count-by-service path avoids
  // a JOIN into the source generator table). Duplicated from the source
  // row's serviceId at insert time — treated as immutable per rewrite.
  serviceId: int("serviceId").notNull(),
  contentType: mysqlEnum("contentType", ["headline", "adCopy", "landingPage", "body", "link"]).notNull(),
  // sourceTable + sourceId form a loose foreign key into whichever generator
  // table produced the flagged row (e.g., sourceTable='headlines' + headline.id).
  // Kept as a free-form string rather than a real FK so a single table can
  // reference rows across multiple generators.
  sourceTable: varchar("sourceTable", { length: 64 }).notNull(),
  sourceId: int("sourceId").notNull(),
  originalText: text("originalText").notNull(),
  rewrittenText: text("rewrittenText").notNull(),
  // JSON array of plain-English violation reasons from checkCompliance's
  // ComplianceIssue[] (.reason for each issue).
  violationReasons: json("violationReasons").notNull(),
  // Score the rewrite achieved — gated >= 70 at insert time, so nothing below
  // that ever lives here; stored for audit and future tightening.
  complianceScore: int("complianceScore").notNull(),
  userAccepted: boolean("userAccepted").notNull().default(false),
  userDismissed: boolean("userDismissed").notNull().default(false),
  // Phase 3 — keys a rewrite to a specific (angle, section) inside a
  // multi-region source row (currently only landingPages, where one row
  // holds four angle JSONs each with 12 string sections). Format
  // "<angleKey>:<sectionKey>" — opaque string, parsed only by the panel's
  // KEPT-label humanizer. NULL for Phase 1/2 (headlines, adCopy) since
  // those source tables are one-content-per-row. Non-indexed: every read
  // path narrows by (userId, sourceTable, sourceId) first.
  sourceSubKey: varchar("sourceSubKey", { length: 128 }),
  // Phase 3 — which LLM produced the rewrite. Hybrid routing on
  // landing-page calls uses 'claude-opus-4-7' for body contentType and
  // 'claude-sonnet-4-6' for headline + link. Populated on every new
  // rewrite from Phase 3 onward (Phase 1/2 paths always write
  // 'claude-sonnet-4-6'). NULL on pre-Phase-3 historical rows; not
  // backfilled.
  modelUsed: varchar("modelUsed", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sourceIdx:  index("complianceRewrites_source_idx").on(table.userId, table.sourceTable, table.sourceId),
  serviceIdx: index("complianceRewrites_service_idx").on(table.userId, table.serviceId),
}));
export type ComplianceRewrite = typeof complianceRewrites.$inferSelect;
export type InsertComplianceRewrite = typeof complianceRewrites.$inferInsert;

// ---------------------------------------------------------------------------
// Placeholder Values — two-level registry for operator-fillable [INSERT_*] tokens.
// serviceId IS NULL = account-level default (remembered across campaigns).
// serviceId = N     = per-campaign override (frozen at save time).
// Uniqueness enforced at app level, not via DB constraint (MySQL NULL != NULL).
// ---------------------------------------------------------------------------
export const placeholderValues = mysqlTable("placeholderValues", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 100 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userServiceTokenIdx: index("idx_pv_user_service_token").on(table.userId, table.serviceId, table.token),
  userDefaultsIdx: index("idx_pv_user_defaults").on(table.userId, table.token),
}));
export type PlaceholderValue = typeof placeholderValues.$inferSelect;
export type InsertPlaceholderValue = typeof placeholderValues.$inferInsert;
