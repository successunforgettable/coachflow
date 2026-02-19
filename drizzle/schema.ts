import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean, uniqueIndex, index } from "drizzle-orm/mysql-core";

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
  // Beast Mode toggle
  beastMode: boolean("beastMode").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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
  campaignType: mysqlEnum("campaignType", ["webinar", "challenge", "course_launch", "product_launch"]),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed"]).default("draft").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_campaigns_userId").on(table.userId),
  serviceIdIdx: index("idx_campaigns_serviceId").on(table.serviceId),
}));

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Ideal Customer Profiles - FULL Kong parity with 17 tabs
 * Expanded from 5 sections to match Kong's Dream Buyers exactly
 */
export const idealCustomerProfiles = mysqlTable("idealCustomerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  
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
  adStyle: varchar("adStyle", { length: 100 }), // Hero Ad, Weird Authority Ad, Secret Info, Commitment & Consistency
  adCallToAction: varchar("adCallToAction", { length: 100 }), // Download free report, Watch free video, Book free call
  contentType: mysqlEnum("contentType", ["headline", "body", "link"]).notNull(),
  content: text("content").notNull(), // The actual headline/body/link text
  // Generation parameters for regeneration - 17 Kong fields
  targetMarket: varchar("targetMarket", { length: 52 }), // Kong: 52 char limit
  productCategory: varchar("productCategory", { length: 79 }), // Kong: 79 char limit
  specificProductName: varchar("specificProductName", { length: 72 }), // Kong: 72 char limit
  pressingProblem: varchar("pressingProblem", { length: 48 }), // Kong: 48 char limit
  desiredOutcome: varchar("desiredOutcome", { length: 25 }), // Kong: 25 char limit
  uniqueMechanism: text("uniqueMechanism"), // Kong: 0 char limit (unlimited)
  listBenefits: text("listBenefits"), // Kong: 0 char limit
  specificTechnology: varchar("specificTechnology", { length: 23 }), // Kong: 23 char limit
  scientificStudies: varchar("scientificStudies", { length: 31 }), // Kong: 31 char limit
  credibleAuthority: varchar("credibleAuthority", { length: 70 }), // Kong: 70 char limit
  featuredIn: varchar("featuredIn", { length: 65 }), // Kong: 65 char limit (social proof)
  numberOfReviews: varchar("numberOfReviews", { length: 20 }),
  averageReviewRating: varchar("averageReviewRating", { length: 10 }),
  totalCustomers: varchar("totalCustomers", { length: 20 }),
  testimonials: text("testimonials"), // Kong: 511 char limit
  rating: int("rating").default(0),
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
  targetMarket: varchar("targetMarket", { length: 255 }).notNull(),
  pressingProblem: text("pressingProblem").notNull(),
  desiredOutcome: text("desiredOutcome").notNull(),
  uniqueMechanism: text("uniqueMechanism").notNull(),
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
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
  targetMarket: varchar("targetMarket", { length: 100 }).notNull(),
  hvcoTopic: text("hvcoTopic").notNull(), // 800 chars
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
  isFavorite: boolean("isFavorite").default(false),
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
  targetMarket: varchar("targetMarket", { length: 100 }).notNull(),
  pressingProblem: varchar("pressingProblem", { length: 200 }).notNull(),
  whyProblem: text("whyProblem").notNull(), // 300 chars
  whatTried: text("whatTried").notNull(), // 300 chars
  whyExistingNotWork: text("whyExistingNotWork").notNull(), // 300 chars
  descriptor: varchar("descriptor", { length: 50 }), // Strategy, Framework, Method, System, etc.
  application: varchar("application", { length: 100 }), // How it's applied
  desiredOutcome: varchar("desiredOutcome", { length: 200 }).notNull(),
  credibility: varchar("credibility", { length: 200 }).notNull(), // Authority figure
  socialProof: varchar("socialProof", { length: 200 }).notNull(), // Publications, features
  // Metadata
  rating: int("rating").default(0), // -1 = thumbs down, 0 = no rating, 1 = thumbs up
  isFavorite: boolean("isFavorite").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_heroMechanisms_userId").on(table.userId),
  campaignIdIdx: index("idx_heroMechanisms_campaignId").on(table.campaignId),
  mechanismSetIdIdx: index("idx_heroMechanisms_mechanismSetId").on(table.mechanismSetId),
}));

export type HeroMechanism = typeof heroMechanisms.$inferSelect;
export type InsertHeroMechanism = typeof heroMechanisms.$inferInsert;
