/**
 * Shared server-side quota enforcement.
 * Called at the top of every generate / generateAsync / regenerate procedure.
 *
 * Returns silently if the user is within quota.
 * Throws TRPCError FORBIDDEN (maps to HTTP 403) with { message: "quota_exceeded", generator } if over.
 */
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { type GeneratorType, type SubscriptionTier, getQuotaLimit, getQuotaCountField } from "../quotaLimits";

export async function enforceQuota(
  userId: number,
  generatorType: GeneratorType,
  userRole?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

  const tier: SubscriptionTier = (user.subscriptionTier as SubscriptionTier) || "trial";
  const role = userRole ?? user.role ?? undefined;
  const limit = getQuotaLimit(tier, generatorType, role ?? undefined);

  // Infinity means unlimited — skip the count check entirely
  if (limit === Infinity || limit >= 999) return;

  const countField = getQuotaCountField(generatorType);
  const currentCount = (user as any)[countField] ?? 0;

  if (currentCount >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: JSON.stringify({ message: "quota_exceeded", generator: generatorType }),
    });
  }
}

/**
 * Increment the generation count for a user after a successful generation.
 * Call this AFTER the generation completes (not before).
 */
export async function incrementQuotaCount(
  userId: number,
  generatorType: GeneratorType,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

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
