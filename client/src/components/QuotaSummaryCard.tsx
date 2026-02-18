import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { AlertCircle, TrendingUp } from "lucide-react";

interface QuotaSummaryCardProps {
  authData: {
    subscriptionTier: "trial" | "pro" | "agency" | null;
    headlineGeneratedCount: number;
    hvcoGeneratedCount: number;
    heroMechanismGeneratedCount: number;
    icpGeneratedCount: number;
    adCopyGeneratedCount: number;
    emailSeqGeneratedCount: number;
    whatsappSeqGeneratedCount: number;
    landingPageGeneratedCount: number;
    offerGeneratedCount: number;
    usageResetAt: string | Date | null;
  };
  quotaLimits: {
    headlines: number;
    hvco: number;
    heroMechanisms: number;
    icp: number;
    adCopy: number;
    email: number;
    whatsapp: number;
    landingPages: number;
    offers: number;
  };
}

export function QuotaSummaryCard({ authData, quotaLimits }: QuotaSummaryCardProps) {
  const generators = [
    { name: "Headlines", used: authData.headlineGeneratedCount, limit: quotaLimits.headlines },
    { name: "HVCO Titles", used: authData.hvcoGeneratedCount, limit: quotaLimits.hvco },
    { name: "Hero Mechanisms", used: authData.heroMechanismGeneratedCount, limit: quotaLimits.heroMechanisms },
    { name: "ICP", used: authData.icpGeneratedCount, limit: quotaLimits.icp },
    { name: "Ad Copy", used: authData.adCopyGeneratedCount, limit: quotaLimits.adCopy },
    { name: "Email Sequences", used: authData.emailSeqGeneratedCount, limit: quotaLimits.email },
    { name: "WhatsApp Sequences", used: authData.whatsappSeqGeneratedCount, limit: quotaLimits.whatsapp },
    { name: "Landing Pages", used: authData.landingPageGeneratedCount, limit: quotaLimits.landingPages },
    { name: "Offers", used: authData.offerGeneratedCount, limit: quotaLimits.offers },
  ];

  // Check if any generator is at or near limit
  const hasWarning = generators.some((gen) => gen.used >= gen.limit * 0.8);
  const hasExceeded = generators.some((gen) => gen.used >= gen.limit);

  // Calculate overall usage percentage
  const totalUsed = generators.reduce((sum, gen) => sum + gen.used, 0);
  const totalLimit = generators.reduce((sum, gen) => sum + gen.limit, 0);
  const overallPercentage = (totalUsed / totalLimit) * 100;

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quota Usage
            </CardTitle>
            <CardDescription>
              {authData.subscriptionTier === "agency"
                ? "Unlimited generations on all tools"
                : `Your monthly usage across all 9 generators`}
            </CardDescription>
          </div>
          {authData.subscriptionTier !== "agency" && hasExceeded && (
            <Link href="/pricing">
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {authData.subscriptionTier === "agency" ? (
          <div className="text-center py-8">
            <p className="text-2xl font-bold text-green-500">∞ Unlimited</p>
            <p className="text-sm text-muted-foreground mt-2">
              You have unlimited access to all generators
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="pb-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Usage</span>
                <span className="text-sm text-muted-foreground">
                  {totalUsed}/{totalLimit} ({Math.round(overallPercentage)}%)
                </span>
              </div>
              <Progress value={overallPercentage} className="h-2" />
            </div>

            {/* Individual Generators */}
            <div className="space-y-3">
              {generators.map((gen) => {
                const percentage = (gen.used / gen.limit) * 100;
                const isAtLimit = gen.used >= gen.limit;
                const isNearLimit = gen.used >= gen.limit * 0.8 && !isAtLimit;

                return (
                  <div key={gen.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">
                        {gen.name}
                        {isAtLimit && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                      </span>
                      <span
                        className={`text-sm ${
                          isAtLimit
                            ? "text-red-500 font-semibold"
                            : isNearLimit
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {gen.used}/{gen.limit}
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      className={`h-1.5 ${
                        isAtLimit
                          ? "bg-red-100 [&>div]:bg-red-500"
                          : isNearLimit
                          ? "bg-yellow-100 [&>div]:bg-yellow-500"
                          : ""
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Reset Date */}
            {authData.usageResetAt && (
              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  Quota resets on{" "}
                  {new Date(authData.usageResetAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Warning Message */}
            {hasExceeded && (
              <div className="pt-4 border-t">
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-sm text-yellow-500 font-medium">
                    You've reached your limit on some generators. Upgrade to continue generating!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
