/**
 * Centralized Quota Limits Configuration
 * 
 * Defines generation limits for each subscription tier across all 9 generators.
 * These limits must match the promises on the pricing page.
 */

export type GeneratorType = 
  | "headlines" 
  | "hvco" 
  | "heroMechanisms" 
  | "icp" 
  | "adCopy" 
  | "email" 
  | "whatsapp" 
  | "landingPages" 
  | "offers";

export type SubscriptionTier = "trial" | "pro" | "agency";

export const QUOTA_LIMITS: Record<SubscriptionTier, Record<GeneratorType, number>> = {
  trial: {
    headlines: Infinity,
    hvco: Infinity,
    heroMechanisms: Infinity,
    icp: 2,
    adCopy: 5,
    email: 2,
    whatsapp: 2,
    landingPages: 2,
    offers: 2,
  },
  pro: {
    headlines: 50,
    hvco: 50,
    heroMechanisms: 50,
    icp: 50,
    adCopy: 100,
    email: 50,
    whatsapp: 50,
    landingPages: 50,
    offers: 50,
  },
  agency: {
    headlines: 999,
    hvco: 999,
    heroMechanisms: 999,
    icp: 999,
    adCopy: 999,
    email: 999,
    whatsapp: 999,
    landingPages: 999,
    offers: 999,
  },
};

/**
 * Get quota limit for a specific generator and subscription tier
 * @param tier - Subscription tier or null/undefined
 * @param generatorType - Type of generator
 * @param userRole - User role (optional, for superuser check)
 * @returns Quota limit (Infinity for superuser)
 */
export function getQuotaLimit(
  tier: SubscriptionTier | null | undefined, 
  generatorType: GeneratorType,
  userRole?: string
): number {
  // Superusers have unlimited quota
  if (userRole === "superuser") {
    return Infinity;
  }
  
  const effectiveTier = tier || "trial";
  return QUOTA_LIMITS[effectiveTier][generatorType];
}

/**
 * Get field name for quota count in user table
 */
export function getQuotaCountField(generatorType: GeneratorType): string {
  const fieldMap: Record<GeneratorType, string> = {
    headlines: "headlineGeneratedCount",
    hvco: "hvcoGeneratedCount",
    heroMechanisms: "heroMechanismGeneratedCount",
    icp: "icpGeneratedCount",
    adCopy: "adCopyGeneratedCount",
    email: "emailSeqGeneratedCount",
    whatsapp: "whatsappSeqGeneratedCount",
    landingPages: "landingPageGeneratedCount",
    offers: "offerGeneratedCount",
  };
  return fieldMap[generatorType];
}
