/**
 * Shared server-side quota enforcement.
 * Called at the top of every generate / generateAsync / regenerate procedure, and by the Trail's
 * autoMode.orchestrateStep for trial users.
 *
 * Quotas ration TRIAL users only (tierAccess.ts): Pro, agency and staff are never counted and never refused (D5).
 *
 * Returns silently if the user is within quota. Otherwise throws TRPCError FORBIDDEN with a plain-English message
 * and a UsageLimitCause, surfaced to clients as `data.usageLimit` by the tRPC error formatter.
 */
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, adCreatives } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { type GeneratorType, type SubscriptionTier, getQuotaLimit, getQuotaCountField } from "../quotaLimits";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { countsUsage, trialUsageWhere, usageLimitError, TRIAL_AD_IMAGE_BATCH_LIMIT } from "./tierAccess";

/** Load the user after the monthly reset has run, so a check never reads last month's count. */
async function loadUserForCheck(userId: number) {
  await checkAndResetQuotaIfNeeded(userId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  return { db, user };
}

function isTrialExpired(user: { trialEndsAt?: Date | string | null }): boolean {
  return !!user.trialEndsAt && new Date() > new Date(user.trialEndsAt);
}

export async function enforceQuota(
  userId: number,
  generatorType: GeneratorType,
  userRole?: string | null,
): Promise<void> {
  const { user } = await loadUserForCheck(userId);
  const role = userRole ?? user.role ?? undefined;
  if (!countsUsage({ role, subscriptionTier: user.subscriptionTier })) return;

  // Trial expiry gate: an ended trial blocks ALL generation, on every path that enforces a quota.
  if (isTrialExpired(user)) throw usageLimitError("trial_expired", generatorType);

  const tier: SubscriptionTier = (user.subscriptionTier as SubscriptionTier) || "trial";
  const limit = getQuotaLimit(tier, generatorType, role ?? undefined);
  // Infinity means unlimited — skip the count check entirely
  if (limit === Infinity || limit >= 999) return;

  const currentCount = (user as any)[getQuotaCountField(generatorType)] ?? 0;
  if (currentCount >= limit) throw usageLimitError("quota_exceeded", generatorType, limit);
}

/** Trial-expiry gate alone, for trial steps that consume no counted quota (an import extraction's coherence check,
 *  an imported method or lead magnet). Pro, agency and staff pass untouched. */
export async function enforceTrialActive(userId: number, userRole?: string | null, what = "generation"): Promise<void> {
  const { user } = await loadUserForCheck(userId);
  const role = userRole ?? user.role ?? undefined;
  if (!countsUsage({ role, subscriptionTier: user.subscriptionTier })) return;
  if (isTrialExpired(user)) throw usageLimitError("trial_expired", what);
}

/**
 * D3: a trial user gets exactly the ad images one campaign needs — one batch (5 variations) — plus the trial-expiry
 * gate. Counts distinct batches, not rows: a batch is the unit a campaign kit selects.
 */
export async function enforceTrialAdImageBatchLimit(userId: number, userRole?: string | null): Promise<void> {
  const { db, user } = await loadUserForCheck(userId);
  const role = userRole ?? user.role ?? undefined;
  if (!countsUsage({ role, subscriptionTier: user.subscriptionTier })) return;
  if (isTrialExpired(user)) throw usageLimitError("trial_expired", "adCreatives");

  const [row] = await db
    .select({ n: sql<number>`COUNT(DISTINCT COALESCE(${adCreatives.batchId}, CONCAT('row-', ${adCreatives.id})))` })
    .from(adCreatives)
    .where(eq(adCreatives.userId, userId));
  if (Number(row?.n ?? 0) >= TRIAL_AD_IMAGE_BATCH_LIMIT) {
    throw usageLimitError("quota_exceeded", "adCreatives", TRIAL_AD_IMAGE_BATCH_LIMIT);
  }
}

/**
 * Count one successful generation against a TRIAL user's quota. Pro, agency and staff never move (the WHERE clause
 * excludes them). Atomic `+ 1`, so two concurrent generations cannot both read the same count. Call AFTER the
 * generation has been written, never before — a failed attempt costs nothing.
 */
export async function countTrialUsage(userId: number, generatorType: GeneratorType): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const col = (users as any)[getQuotaCountField(generatorType)];
  await db.update(users).set({ [getQuotaCountField(generatorType)]: sql`${col} + 1` } as any).where(trialUsageWhere(userId));
}

/**
 * Increment the generation count for a user after a successful generation, and record the product event.
 * Call this AFTER the generation completes (not before). The count is trial-only (countTrialUsage); the product
 * event is recorded for every tier, as before.
 */
export async function incrementQuotaCount(
  userId: number,
  generatorType: GeneratorType,
): Promise<void> {
  await countTrialUsage(userId, generatorType);

  // Track product event (non-blocking)
  try {
    const { trackEvent } = await import("./productEvents");
    await trackEvent(userId, "user_generated", { generator: generatorType });
  } catch (_) { /* ignore tracking failures */ }
}
