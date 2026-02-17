import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
      window.location.href = getLoginUrl();
      return;
    }

    createCheckoutMutation.mutate({
      tier,
      interval: selectedInterval,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
      <PageHeader 
        title="Pricing" 
        description="Choose your subscription plan"
        backTo="/dashboard"
      />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tiers = pricing?.tiers;
  const trialDays = pricing?.trialDays || 7;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Pricing" 
        description="Choose your subscription plan"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Start with a {trialDays}-day free trial. No credit card required.
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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Pro Tier */}
          <Card className="border-2 hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <CardDescription>Perfect for individual coaches and consultants</CardDescription>
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
                className="w-full mb-6"
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : status?.tier === "pro" ? (
                  "Current Plan"
                ) : (
                  `Start {trialDays}-Day Free Trial`
                )}
              </Button>

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

          {/* Agency Tier */}
          <Card className="border-2 border-primary relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Agency</CardTitle>
              <CardDescription>For agencies and teams managing multiple clients</CardDescription>
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
                className="w-full mb-6"
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : status?.tier === "agency" ? (
                  "Current Plan"
                ) : (
                  `Start ${trialDays}-Day Free Trial`
                )}
              </Button>

              <div className="space-y-3">
                {tiers?.AGENCY.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                Start using CoachFlow immediately with full access to all features. No credit card
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
                How is CoachFlow different from Kong?
              </h3>
              <p className="text-muted-foreground">
                CoachFlow is specifically designed for coaches, speakers, and consultants with
                integrated email/WhatsApp/SMS sequences, simpler onboarding (6 fields vs 15), and
                better pricing ($49 vs $79 for Pro).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
