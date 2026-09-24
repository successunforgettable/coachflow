/**
 * Shared server-side quota enforcement.
 * Called at the top of every generate / generateAsync / regenerate procedure, and by the Trail's
 * autoMode.orchestrateStep for trial users.
 *
 * TWO REGIMES (Arfeen, D5 as corrected 2026-09-24):
 *   - TRIAL users (tierAccess.countsUsage): the option-(b) rationing — monthly reset first, trial expiry, the table
 *     limits, a plain-English limit message carrying a UsageLimitCause (surfaced as `data.usageLimit`).
 *   - Everyone else: EXACTLY the pre-sprint behaviour of this helper — table limits, the original JSON message,
 *     no reset inside the helper (the landing-page router calls it and resets after, as it always has).
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
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  const [peek] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!peek) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  const trial = countsUsage({ role: userRole ?? peek.role, subscriptionTier: peek.subscriptionTier });
  // Trial only: reset first, so a check never reads last month's count. Non-trial keeps its pre-sprint ordering.
  const user = trial ? (await loadUserForCheck(userId)).user : peek;

  const tier: SubscriptionTier = (user.subscriptionTier as SubscriptionTier) || "trial";
  const role = userRole ?? user.role ?? undefined;

  // Trial expiry gate: if the user is on the trial tier and their trial has ended, block ALL generation.
  // Paid users (pro/agency) and superusers/admins are unaffected.
  if (tier === "trial" && role !== "superuser" && role !== "admin") {
    if (isTrialExpired(user)) {
      if (trial) throw usageLimitError("trial_expired", generatorType);
      throw new TRPCError({ code: "FORBIDDEN", message: JSON.stringify({ message: "trial_expired", generator: generatorType }) });
    }
  }

  const limit = getQuotaLimit(tier, generatorType, role ?? undefined);
  // Infinity means unlimited — skip the count check entirely
  if (limit === Infinity || limit >= 999) return;

  const currentCount = (user as any)[getQuotaCountField(generatorType)] ?? 0;
  if (currentCount >= limit) {
    if (trial) throw usageLimitError("quota_exceeded", generatorType, limit);
    throw new TRPCError({ code: "FORBIDDEN", message: JSON.stringify({ message: "quota_exceeded", generator: generatorType }) });
  }
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
  // Exempt exactly who the pre-sprint gate exempted: superusers and any non-trial tier.
  if (role === "superuser" || (user.subscriptionTier && user.subscriptionTier !== "trial")) return;
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
 * Count one successful generation against a TRIAL user's quota — the five counters (offer, adCopy, icp, email,
 * whatsapp) that were checked but never incremented. Pro, agency and staff never move (the WHERE clause excludes
 * them), which is exactly their pre-sprint behaviour: those five counters never moved for anyone. Atomic `+ 1`, so two concurrent generations cannot both read the same count. Call AFTER the
 * generation has been written, never before — a failed attempt costs nothing.
 */
export async function countTrialUsage(userId: number, generatorType: GeneratorType): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const col = (users as any)[getQuotaCountField(generatorType)];
  await db.update(users).set({ [getQuotaCountField(generatorType)]: sql`${col} + 1` } as any).where(trialUsageWhere(userId));
}

/**
 * Increment the generation count for a user after a successful generation.
 * Call this AFTER the generation completes (not before). Unchanged from before this sprint.
 */
export async function incrementQuotaCount(
  userId: number,
  generatorType: GeneratorType,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Counts every tier, exactly as before this sprint (D5 as corrected: the old counters are untouched).
  const countField = getQuotaCountField(generatorType);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const currentCount = (user as any)[countField] ?? 0;
  await db.update(users).set({ [countField]: currentCount + 1 } as any).where(eq(users.id, userId));

  // Track product event (non-blocking)
  try {
    const { trackEvent } = await import("./productEvents");
    await trackEvent(userId, "user_generated", { generator: generatorType });
  } catch (_) { /* ignore tracking failures */ }
}
