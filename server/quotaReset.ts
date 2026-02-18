/**
 * Anniversary-Based Quota Reset System
 * 
 * Each user's quota resets monthly based on their signup date.
 * Example: User joins Feb 17 → resets March 17, April 17, May 17, etc.
 */

import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Check if user's quota needs to be reset based on their anniversary date.
 * If reset is needed, reset all quotas and update usageResetAt to next month.
 * 
 * This function should be called at the start of every generation request.
 */
export async function checkAndResetQuotaIfNeeded(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[QuotaReset] Database not available");
    return;
  }

  try {
    // Get user's current quota reset date
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      console.error(`[QuotaReset] User ${userId} not found`);
      return;
    }

    const now = new Date();
    const resetDate = user.usageResetAt ? new Date(user.usageResetAt) : null;

    // If no reset date set, initialize it to 1 month from now
    if (!resetDate) {
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);
      
      await db
        .update(users)
        .set({ usageResetAt: nextReset, updatedAt: new Date() })
        .where(eq(users.id, userId));
      
      console.log(`[QuotaReset] Initialized reset date for user ${userId}: ${nextReset.toISOString()}`);
      return;
    }

    // Check if current date has passed the reset date
    if (now >= resetDate) {
      // Calculate next reset date (1 month from current reset date, not from now)
      const nextReset = new Date(resetDate);
      nextReset.setMonth(nextReset.getMonth() + 1);

      // Reset all quota counts to 0
      await db
        .update(users)
        .set({
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
          usageResetAt: nextReset,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      console.log(`[QuotaReset] Reset quotas for user ${userId}. Next reset: ${nextReset.toISOString()}`);
    }
  } catch (error) {
    console.error(`[QuotaReset] Error checking/resetting quota for user ${userId}:`, error);
  }
}
