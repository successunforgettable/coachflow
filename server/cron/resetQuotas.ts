/**
 * Monthly Quota Reset Cron Job
 * 
 * Resets all generator quotas for all users on the 1st of each month at midnight.
 * Run this script with: node --import tsx server/cron/resetQuotas.ts
 */

import { getDb } from "../db";
import { users } from "../../drizzle/schema";

export async function resetMonthlyQuotas() {
  console.log("[Cron] Starting monthly quota reset...");
  
  const db = await getDb();
  if (!db) {
    console.error("[Cron] Database not available");
    return { success: false, error: "Database not available" };
  }

  try {
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1); // Next reset in 1 month

    // Reset all quota counts to 0 for all users
    const result = await db
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
        usageResetAt: resetDate,
        updatedAt: new Date(),
      });

    console.log(`[Cron] Monthly quota reset complete.`);
    return { success: true };
  } catch (error) {
    console.error("[Cron] Error resetting quotas:", error);
    return { success: false, error: String(error) };
  }
}

// If running directly (not imported)
if (require.main === module) {
  resetMonthlyQuotas()
    .then((result) => {
      console.log("[Cron] Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("[Cron] Fatal error:", error);
      process.exit(1);
    });
}
