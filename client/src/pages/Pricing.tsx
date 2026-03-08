import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FREE_FEATURES = [
  "1 ICP Profile",
  "11-step campaign path visible",
  "3 generations per tool on nodes 3–5",
  "2 welcome video credits",
];

const PRO_PLUS_FEATURES = [
  "Everything in ZAP Pro",
  "Unlimited ICP Profiles",
  "Unlimited Generations",
  "Multi-ICP Campaign Cloning",
  "Kill/Scale Automation",
  "White-Label Reports",
  "25 Video Credits per month",
  "Priority Support",
];

export default function Pricing() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">("monthly");

  const { data: pricing } = trpc.subscription.getPricing.useQuery();
  const { data: status } = trpc.subscription.getStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createCheckoutMutation = trpc.subscription.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.success("Redirecting to checkout...");
        window.open(data.url, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubscribe = (tier: "pro" | "agency") => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    createCheckoutMutation.mutate({ tier, interval: selectedInterval });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PageHeader title="Pricing" description="Choose your subscription plan" backTo="/dashboard" />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tiers = pricing?.tiers;
  const trialDays = pricing?.trialDays || 7;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Pricing" description="Choose your subscription plan" backTo="/dashboard" />
      <div className="container mx-auto px-4 py-16 max-w-7xl">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Start free. Upgrade when you're ready.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setSelectedInterval("monthly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedInterval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground hover:bg-accent/80"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval("yearly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedInterval === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground hover:bg-accent/80"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                Save 17%
              </span>
            </button>
          </div>

          {status && status.tier && status.tier !== "trial" && (
            <div className="bg-primary/10 border border-primary rounded-lg p-4 max-w-2xl mx-auto mb-8">
              <p className="text-foreground">
                <strong>Current Plan:</strong> {status.tier?.toUpperCase()} -{" "}
                {status.status?.replace("_", " ").toUpperCase()}
              </p>
              {status.subscriptionEndsAt && (
                <p className="text-sm text-muted-foreground mt-1">
                  {status.status === "canceled"
                    ? `Access until: ${new Date(status.subscriptionEndsAt).toLocaleDateString()}`
                    : `Renews: ${new Date(status.subscriptionEndsAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pricing Cards — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

          {/* Free Tier */}
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>See the quality before you commit</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground"> forever</span>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                variant="outline"
                className="w-full mb-6 bg-background"
              >
                <a href="/signup">Start Free</a>
              </Button>

              <div className="space-y-3">
                {FREE_FEATURES.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ZAP Pro Tier */}
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle className="text-2xl">ZAP Pro</CardTitle>
              <CardDescription>For coaches and consultants ready to launch their first high-converting campaign</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  ${selectedInterval === "monthly" ? tiers?.PRO.priceMonthly : Math.round((tiers?.PRO.priceYearly || 0) / 12)}
                </span>
                <span className="text-muted-foreground">/month</span>
                {selectedInterval === "yearly" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed ${tiers?.PRO.priceYearly}/year
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSubscribe("pro")}
                disabled={createCheckoutMutation.isPending || status?.tier === "pro"}
                className="w-full mb-2"
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : status?.tier === "pro" ? (
                  "Current Plan"
                ) : (
                  "Start ZAP Pro"
                )}
              </Button>
              {status?.tier !== "pro" && (
                <p className="text-center text-xs text-muted-foreground mb-4">
                  New here?{" "}
                  <a href="/signup" className="underline hover:text-foreground transition-colors">
                    Create a free account
                  </a>
                </p>
              )}

              <div className="space-y-3">
                {tiers?.PRO.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ZAP Pro Plus Tier */}
          <Card className="border-2 border-primary relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">ZAP Pro Plus</CardTitle>
              <CardDescription>For high-volume operators and multi-brand scalers running 10+ campaigns simultaneously</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  ${selectedInterval === "monthly" ? tiers?.AGENCY.priceMonthly : Math.round((tiers?.AGENCY.priceYearly || 0) / 12)}
                </span>
                <span className="text-muted-foreground">/month</span>
                {selectedInterval === "yearly" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed ${tiers?.AGENCY.priceYearly}/year
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleSubscribe("agency")}
                disabled={createCheckoutMutation.isPending || status?.tier === "agency"}
                className="w-full mb-2"
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : status?.tier === "agency" ? (
                  "Current Plan"
                ) : (
                  "Go Pro Plus"
                )}
              </Button>
              {status?.tier !== "agency" && (
                <p className="text-center text-xs text-muted-foreground mb-4">
                  New here?{" "}
                  <a href="/signup" className="underline hover:text-foreground transition-colors">
                    Create a free account
                  </a>
                </p>
              )}

              <div className="space-y-3">
                {PRO_PLUS_FEATURES.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <div className="mt-16 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Compare Plans</h2>
          {/* Horizontal scroll wrapper for mobile */}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{
            background: "#F5F1EA",
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid rgba(26,22,36,0.08)",
            fontFamily: "'Instrument Sans', sans-serif",
            minWidth: 600,
          }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "#1A1624" }}>
              {["Feature", "Free", "ZAP Pro", "ZAP Pro Plus"].map((col, i) => (
                <div key={col} style={{
                  padding: "16px 20px",
                  color: "#F5F1EA",
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: i === 0 ? "left" : "center",
                  borderLeft: i === 2 ? "3px solid #FF5B1D" : "none",
                }}>{col}</div>
              ))}
            </div>
            {/* Table rows */}
            {[
              { feature: "ICP Profiles",           free: "1",              pro: "3",              plus: "Unlimited" },
              { feature: "Generations per tool",   free: "3",              pro: "50–100",         plus: "Unlimited" },
              { feature: "Meta Compliance Scoring",free: false,            pro: true,             plus: true },
              { feature: "GHL & Meta Push",         free: false,            pro: true,             plus: true },
              { feature: "PDF Export",              free: false,            pro: true,             plus: true },
              { feature: "Video Credits",           free: "2 welcome",      pro: "10/month",       plus: "25/month" },
              { feature: "Campaign Cloning",        free: false,            pro: false,            plus: true },
              { feature: "Kill/Scale Automation",   free: false,            pro: false,            plus: true },
              { feature: "White-Label Reports",     free: false,            pro: false,            plus: true },
            ].map((row, rowIdx) => (
              <div key={row.feature} style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                background: rowIdx % 2 === 0 ? "rgba(26,22,36,0.02)" : "transparent",
                borderTop: "1px solid rgba(26,22,36,0.06)",
              }}>
                <div style={{ padding: "14px 20px", fontSize: 14, fontWeight: 500, color: "#1A1624" }}>{row.feature}</div>
                {[row.free, row.pro, row.plus].map((val, colIdx) => (
                  <div key={colIdx} style={{
                    padding: "14px 20px",
                    textAlign: "center",
                    fontSize: 15,
                    borderLeft: colIdx === 1 ? "3px solid #FF5B1D" : "none",
                    color: val === true ? "#22C55E" : val === false ? "#9CA3AF" : "#1A1624",
                    fontWeight: typeof val === "string" ? 500 : 700,
                  }}>
                    {val === true ? "✓" : val === false ? "✗" : val}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>{/* end scroll wrapper */}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                How does the {trialDays}-day free trial work?
              </h3>
              <p className="text-muted-foreground">
                Start using ZAP immediately with full access to all features. No credit card
                required. After {trialDays} days, you'll be charged based on your selected plan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes! Cancel your subscription at any time from your dashboard. You'll retain access
                until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-muted-foreground">
                We accept all major credit cards (Visa, Mastercard, American Express) through our
                secure Stripe payment processor.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                What makes ZAP unique?
              </h3>
              <p className="text-muted-foreground">
                ZAP is built around an 11-step guided campaign path. You define your service and your ideal customer once, and Zappy — your AI campaign guide — builds every asset from that foundation. Ad copy, email sequences, landing pages, WhatsApp sequences and more all know exactly who they're talking to without you re-explaining anything. Plus every asset is scored for Meta compliance before you spend a dollar.
              </p>
            </div>
          </div>
        </div>

        {/* Earnings Disclaimer */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-muted/30 border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3 text-center">
              Important Disclaimer
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed text-center">
              <strong className="text-foreground">Earnings &amp; Results Disclaimer:</strong> Results may vary significantly. No income, revenue, profit, or business success guarantees are made or implied. Success depends on individual effort, skill level, market conditions, business model, competition, and numerous other factors beyond our control. The testimonials, case studies, and examples shown (if any) are exceptional results and should not be interpreted as typical, average, or guaranteed outcomes. Your results may be better, worse, or non-existent. ZAP is a software tool that assists with marketing content creation and campaign management; it does not guarantee business success, customer acquisition, sales, or financial outcomes. Past performance is not indicative of future results. You are solely responsible for your business decisions and outcomes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
