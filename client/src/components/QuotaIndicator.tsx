import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface QuotaIndicatorProps {
  generatorType: "icp" | "adCopy" | "emailSeq" | "whatsappSeq" | "landingPage" | "offer" | "headline" | "hvco" | "heroMechanism";
  label?: string;
}

// Kong parity: Quota limits by subscription tier
const QUOTA_LIMITS = {
  trial: {
    icp: 3,
    adCopy: 5,
    emailSeq: 3,
    whatsappSeq: 3,
    landingPage: 3,
    offer: 3,
    headline: 3,
    hvco: 3,
    heroMechanism: 3,
  },
  pro: {
    icp: 10,
    adCopy: 20,
    emailSeq: 10,
    whatsappSeq: 10,
    landingPage: 10,
    offer: 10,
    headline: 6,
    hvco: 6,
    heroMechanism: 6,
  },
  agency: {
    icp: 50,
    adCopy: 100,
    emailSeq: 50,
    whatsappSeq: 50,
    landingPage: 50,
    offer: 50,
    headline: 20,
    hvco: 20,
    heroMechanism: 20,
  },
};

const GENERATOR_FIELD_MAP = {
  icp: "icpGeneratedCount",
  adCopy: "adCopyGeneratedCount",
  emailSeq: "emailSeqGeneratedCount",
  whatsappSeq: "whatsappSeqGeneratedCount",
  landingPage: "landingPageGeneratedCount",
  offer: "offerGeneratedCount",
  headline: "headlineGeneratedCount",
  hvco: "hvcoGeneratedCount",
  heroMechanism: "heroMechanismGeneratedCount",
} as const;

export function QuotaIndicator({ generatorType, label }: QuotaIndicatorProps) {
  const { data: user } = trpc.auth.me.useQuery();

  if (!user) return null;

  const tier = user.subscriptionTier || "trial";
  const fieldName = GENERATOR_FIELD_MAP[generatorType];
  const used = (user as any)[fieldName] || 0;
  const limit = QUOTA_LIMITS[tier][generatorType];
  
  // Calculate reset date (monthly reset)
  const resetDate = user.usageResetAt ? new Date(user.usageResetAt) : new Date();
  const nextResetDate = new Date(resetDate);
  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
  
  const formattedResetDate = nextResetDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Kong parity: Green badge for normal usage, red for exceeded
  const isExceeded = used >= limit;
  const badgeColor = isExceeded ? "bg-red-600" : "bg-green-600";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
        <Badge className={`${badgeColor} text-white rounded-full px-3 py-1 font-semibold`}>
          {used}/{limit}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        Usage Resets: {formattedResetDate}
      </span>
    </div>
  );
}
