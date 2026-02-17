import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface QuotaIndicatorProps {
  generatorType: "icp" | "adCopy" | "emailSeq" | "whatsappSeq" | "landingPage" | "offer" | "headline";
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
  },
  pro: {
    icp: 10,
    adCopy: 20,
    emailSeq: 10,
    whatsappSeq: 10,
    landingPage: 10,
    offer: 10,
    headline: 6, // Kong Pro plan: 6 headline sets per month
  },
  agency: {
    icp: 50,
    adCopy: 100,
    emailSeq: 50,
    whatsappSeq: 50,
    landingPage: 50,
    offer: 50,
    headline: 20,
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
} as const;

export function QuotaIndicator({ generatorType }: QuotaIndicatorProps) {
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
    <div className="flex items-center gap-3">
      <Badge className={`${badgeColor} text-white rounded-full px-3 py-1 font-semibold`}>
        {used}/{limit}
      </Badge>
      <span className="text-sm text-muted-foreground">
        Usage Resets: {formattedResetDate}
      </span>
    </div>
  );
}
