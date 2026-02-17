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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["trial", "pro", "agency"]).default("trial"),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due", "trialing"]).default("trialing"),
  trialEndsAt: timestamp("trialEndsAt"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
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
 * Ideal Customer Profiles - simplified vs Kong's Dream Buyers (5 sections vs 17+ tabs)
 */
export const idealCustomerProfiles = mysqlTable("idealCustomerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  demographics: json("demographics").$type<{ ageRange?: string; occupation?: string; incomeLevel?: string }>(),
  painPoints: text("painPoints"),
  desiredOutcomes: text("desiredOutcomes"),
  valuesMotivations: text("valuesMotivations"),
  buyingTriggers: text("buyingTriggers"),
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
 * Ad Copy - Facebook/social media ads (10 variations vs Kong's 15+)
 */
export const adCopy = mysqlTable("adCopy", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  adType: mysqlEnum("adType", ["story", "authority", "question", "social_proof", "cta"]),
  headline: varchar("headline", { length: 500 }).notNull(),
  bodyCopy: text("bodyCopy").notNull(),
  linkDescription: varchar("linkDescription", { length: 500 }),
  rating: int("rating").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_adCopy_userId").on(table.userId),
  campaignIdIdx: index("idx_adCopy_campaignId").on(table.campaignId),
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
export const landingPages = mysqlTable("landingPages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  angle: mysqlEnum("angle", ["shock_solve", "contrarian", "story", "authority"]),
  headline: text("headline").notNull(),
  sections: json("sections").$type<Array<{ type: string; content: string }>>().notNull(),
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
 * Offers
 */
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  offerType: mysqlEnum("offerType", ["standard", "premium", "vip"]),
  headline: text("headline").notNull(),
  whatIncluded: json("whatIncluded").$type<Array<string>>().notNull(),
  bonuses: json("bonuses").$type<Array<{ name: string; value: string }>>(),
  guarantee: text("guarantee"),
  price: decimal("price", { precision: 10, scale: 2 }),
  rating: int("rating").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_offers_userId").on(table.userId),
  campaignIdIdx: index("idx_offers_campaignId").on(table.campaignId),
}));

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;