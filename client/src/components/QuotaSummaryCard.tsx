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
    { name: "Your Free Opt-In", used: authData.hvcoGeneratedCount, limit: quotaLimits.hvco },
    { name: "Your Unique Method", used: authData.heroMechanismGeneratedCount, limit: quotaLimits.heroMechanisms },
    { name: "Your Ideal Customer", used: authData.icpGeneratedCount, limit: quotaLimits.icp },
    { name: "Your Ads", used: authData.adCopyGeneratedCount, limit: quotaLimits.adCopy },
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
    <div
      style={{
        padding: 'var(--card-padding-md)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
      }}
    >
      {authData.subscriptionTier === "agency" ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quota Usage</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: '#10B981' }}>∞</span>
            <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Unlimited</span>
          </div>
        </div>
      ) : (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quota Usage</h3>
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Your monthly usage across all 9 generators
            </p>
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-primary)' }}>Overall: {totalUsed}/{totalLimit}</span>
              <span style={{ color: hasExceeded ? '#EF4444' : 'var(--text-tertiary)' }}>({Math.round(overallPercentage)}%)</span>
            </div>
            {hasExceeded && (
              <Link href="/pricing" className="text-xs mt-2 inline-block" style={{ color: 'var(--accent-primary)' }}>
                Upgrade Plan →
              </Link>
            )}
          </div>
        )}
    </div>
  );
}
