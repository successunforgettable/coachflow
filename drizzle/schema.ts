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
  campaignType: mysqlEnum("campaignType", ["webinar", "challenge", "course_launch", "product_launch"]),
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
  demographics: json("demographics").$type<{ ageRange?: string; occupation?: string; incomeLevel?: string; location?: string; education?: string; familyStatus?: string }>(), // Tab 4
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
  contentType: mysqlEnum("contentType", ["headline", "body", "link"]).notNull(),
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
  sequenceType: mysqlEnum("sequenceType", ["welcome", "engagement", "sales"]),
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
  sequenceType: mysqlEnum("sequenceType", ["engagement", "sales"]),
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
  insiderAdvantages: string;
  scarcityUrgency: string;
  shockingStat: string;
  timeSavingBenefit: string;
  consultationOutline: Array<{
    title: string;
    description: string;
  }>;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_offers_userId").on(table.userId),
  campaignIdIdx: index("idx_offers_campaignId").on(table.campaignId),
}));

export type Offer = typeof offers.$inferSelect;
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
  styleType: mysqlEnum("styleType", ["tabloid", "lad_bible", "before_after", "stats", "meme", "testimonial", "question"]).default("tabloid").notNull(),
  designStyle: mysqlEnum("designStyle", ["person_shocked", "screenshot", "person_intense", "object", "person_curious"]).notNull(),
  headlineFormula: mysqlEnum("headlineFormula", ["benefit", "social_proof", "curiosity", "contrast", "challenge"]).notNull(),
  // Generated content
  headline: varchar("headline", { length: 255 }).notNull(),
  imageUrl: text("imageUrl").notNull(), // S3 URL to generated image
  imageFormat: varchar("imageFormat", { length: 20 }).default("1080x1080").notNull(), // Square format
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
  assetType: varchar("assetType", { length: 50 }).notNull(), // 'headshot', 'logo', 'social_proof'
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CoachAsset = typeof coachAssets.$inferSelect;
export type InsertCoachAsset = typeof coachAssets.$inferInsert;

// ---------------------------------------------------------------------------
// Background job queue table for async AI generation polling
// ---------------------------------------------------------------------------
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  userId: varchar("userId", { length: 36 }).notNull().default(""), // Owner — used for ownership check in GET /api/jobs/:jobId
  status: mysqlEnum("status", ["pending", "complete", "failed"]).notNull().default("pending"),
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
  selectedOfferId: int("selectedOfferId"),
  selectedMechanismId: int("selectedMechanismId"),
  selectedHvcoId: int("selectedHvcoId"),
  selectedHeadlineId: int("selectedHeadlineId"),
  selectedAdCopyId: int("selectedAdCopyId"),
  selectedLandingPageId: int("selectedLandingPageId"),
  selectedLandingPageAngle: varchar("selectedLandingPageAngle", { length: 50 }),
  selectedEmailSequenceId: int("selectedEmailSequenceId"),
  selectedWhatsAppSequenceId: int("selectedWhatsAppSequenceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CampaignKit = typeof campaignKits.$inferSelect;
export type InsertCampaignKit = typeof campaignKits.$inferInsert;
