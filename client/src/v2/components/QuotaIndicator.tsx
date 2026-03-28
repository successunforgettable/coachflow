/**
 * QuotaIndicator — small pill showing "[used]/[limit] generated"
 *
 * Colour shifts:
 *   < 80% of limit  → neutral grey
 *   >= 80% of limit → orange (--v2-primary-btn)
 *   >= limit        → red (--v2-error)
 *
 * Only renders for trial/pro tiers. Agency (999) and Infinity limits are hidden.
 */

// Mirror of server/quotaLimits.ts — kept minimal to avoid importing server code
type GeneratorKey = "icp" | "offers" | "adCopy" | "email" | "whatsapp" | "landingPages" | "headlines" | "hvco" | "heroMechanisms";

const TRIAL_LIMITS: Record<GeneratorKey, number> = {
  headlines: Infinity,
  hvco: Infinity,
  heroMechanisms: Infinity,
  icp: 2,
  adCopy: 5,
  email: 2,
  whatsapp: 2,
  landingPages: 2,
  offers: 2,
};

const PRO_LIMITS: Record<GeneratorKey, number> = {
  headlines: 6,
  hvco: 3,
  heroMechanisms: 4,
  icp: 50,
  adCopy: 100,
  email: 20,
  whatsapp: 20,
  landingPages: 10,
  offers: 10,
};

export function getLimit(tier: string | null | undefined, key: GeneratorKey): number {
  if (tier === "agency") return 999;
  if (tier === "pro") return PRO_LIMITS[key];
  return TRIAL_LIMITS[key];
}

interface QuotaIndicatorProps {
  generatorKey: GeneratorKey;
  usedCount: number;
  tier: string | null | undefined;
}

export default function QuotaIndicator({ generatorKey, usedCount, tier }: QuotaIndicatorProps) {
  const limit = getLimit(tier, generatorKey);

  // Don't render for Infinity or agency-level limits
  if (limit === Infinity || limit >= 999) return null;

  const ratio = limit > 0 ? usedCount / limit : 0;
  const atLimit = usedCount >= limit;
  const nearLimit = ratio >= 0.8 && !atLimit;

  let bg: string;
  let color: string;

  if (atLimit) {
    bg = "var(--v2-error)";
    color = "#fff";
  } else if (nearLimit) {
    bg = "var(--v2-primary-btn)";
    color = "#fff";
  } else {
    bg = "rgba(26, 22, 36, 0.08)";
    color = "var(--v2-text-color)";
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      marginTop: "8px",
      marginBottom: "4px",
    }}>
      <span style={{
        display: "inline-block",
        background: bg,
        color,
        fontFamily: "var(--v2-font-body)",
        fontSize: "12px",
        fontWeight: 600,
        padding: "4px 14px",
        borderRadius: "var(--v2-border-radius-pill)",
        letterSpacing: "0.01em",
      }}>
        {usedCount}/{limit} generated
      </span>
    </div>
  );
}
