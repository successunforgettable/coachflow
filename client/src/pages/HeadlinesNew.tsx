import { useState } from "react";
import { useLocation } from "wouter";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// Kong's 18 unique mechanism examples
const UNIQUE_MECHANISM_EXAMPLES = [
  "$7.8 Billion AI Funnel That's Generating 90-480 Super Qualified Appointments A Month On Autopilot",
  "Tiny Orange Plant (a secret ancient ingredient China's most desired woman) that speeds up metabolism by up to 68%",
  "New 'FirmFit' Technology Delivers A Flawless, Unbreakable Smile For Less Than Half The Price Of All-On-4 Implant Treatment",
  "Breakthrough 'Productivity Triggers' System Slashes 5, 10, Even 51 Hours Off Your Work Week",
  "Weird 1-Page Exercise Permanently Removes Mental Blocks, Procrastination, And Fear Of Failure",
  "Algorithm Loophole That's Now Helping Normal Guys Match With Some of the Most Beautiful Women",
  "Weird 'Black Diamond' Refinance Framework Saves $120,787.50 On The Average Loan",
  "Simple 'Density Stacking' Method Allows Any Guy To Melt 12 KGs In 6 Weeks",
  "Wild $280 Billion 'Mrs Watanabe' Stock-Picking Strategy Of Japanese Housewives",
  "The Blood Sugar Balancing Secret From A Village Where People Eat Nothing But Carbs",
  "Primitive African Tribe Ritual Reveals the Secret To Rebuild Your Gums and Teeth",
  "The Secret Manufacturing System Used By Toyota And Amazon That Increases Production by 113%",
  "Strange 'Yield Farming' Strategy Used By Billionaire Crypto Investors",
  "How To Exploit 'Micro-Fluctuations' In Crypto To Make 100's Of Tiny, Profitable Trades",
  "Wild New 'Larger Market Formula' Prints More Clients, Customers And Sales",
  "This Breakthrough 'Bedtime Ritual' Restores Youthful Energy, Vitality And Sex Drive",
  "Mystical 'Japanese Elixir' Kickstarts A Deep, Sleeping Part Of Your Metabolism",
  "New Done-For-You 'Jetstream' Accountant Service Fully Automates All Your Cash Flow",
];

export default function HeadlinesNew() {
  const [, navigate] = useLocation();
  const { data: services } = trpc.services.list.useQuery();

  const [formData, setFormData] = useState({
    serviceId: "",
    targetMarket: "",
    pressingProblem: "",
    desiredOutcome: "",
    uniqueMechanism: "",
  });

  const generateMutation = trpc.headlines.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Headlines Generated! Created ${data.count} headlines across 5 formula types`);
      navigate(`/headlines/${data.headlineSetId}`);
    },
    onError: (error) => {
      toast.error(`Generation Failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate({
      serviceId: formData.serviceId ? parseInt(formData.serviceId) : undefined,
      targetMarket: formData.targetMarket,
      pressingProblem: formData.pressingProblem,
      desiredOutcome: formData.desiredOutcome,
      uniqueMechanism: formData.uniqueMechanism,
    });
  };

  const targetMarketCharsLeft = 52 - formData.targetMarket.length;
  const pressingProblemCharsLeft = 71 - formData.pressingProblem.length;
  const desiredOutcomeCharsLeft = 116 - formData.desiredOutcome.length;

  const { data: authData } = trpc.auth.me.useQuery();

  // Check if user has reached quota limit
  const quotaLimit = authData?.subscriptionTier === "agency" ? 999 : 6;
  const isQuotaExceeded = (authData?.headlineGeneratedCount || 0) >= quotaLimit;

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/headlines">
          <Button variant="ghost" size="sm" className="mb-4 active-press">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Headlines
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Generate Direct Response Headlines</h1>
        <p className="text-muted-foreground mt-2">
          Create 25 high-converting headlines using 5 proven formulas
        </p>
      </div>

      {/* Quota Progress Bar */}
      {authData && (
        <div className="mb-6">
          <QuotaProgressBar
            used={authData.headlineGeneratedCount}
            limit={quotaLimit}
            label="Headlines Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
          />
        </div>
      )}

      {/* Upgrade Prompt */}
      {authData && isQuotaExceeded && authData.subscriptionTier && (
        <div className="mb-6">
          <UpgradePrompt
            generatorName="Headlines"
            currentTier={authData.subscriptionTier}
            used={authData.headlineGeneratedCount}
            limit={quotaLimit}
          />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 animate-fade-in">
          <div className="space-y-6">
            {/* Service Selection */}
            <div className="space-y-2">
              <Label htmlFor="service">Select Product/Service (Optional)</Label>
              <Select
                value={formData.serviceId}
                onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Market */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="targetMarket">Target Market *</Label>
                <span className={`text-xs ${targetMarketCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {targetMarketCharsLeft} chars left
                </span>
              </div>
              <Input
                id="targetMarket"
                value={formData.targetMarket}
                onChange={(e) => setFormData({ ...formData, targetMarket: e.target.value })}
                placeholder="Ages 25-55, crypto beginners, want to make money"
                maxLength={52}
                required
              />
            </div>

            {/* Pressing Problem */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pressingProblem">Pressing Problem *</Label>
                <span className={`text-xs ${pressingProblemCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {pressingProblemCharsLeft} chars left
                </span>
              </div>
              <Textarea
                id="pressingProblem"
                value={formData.pressingProblem}
                onChange={(e) => setFormData({ ...formData, pressingProblem: e.target.value })}
                placeholder="People lose money in crypto. They don't know what to do."
                maxLength={71}
                rows={3}
                required
              />
            </div>

            {/* Desired Outcome */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="desiredOutcome">Desired Outcome *</Label>
                <span className={`text-xs ${desiredOutcomeCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {desiredOutcomeCharsLeft} chars left
                </span>
              </div>
              <Textarea
                id="desiredOutcome"
                value={formData.desiredOutcome}
                onChange={(e) => setFormData({ ...formData, desiredOutcome: e.target.value })}
                placeholder="Make $10,000 per month. Learn crypto in 6 months. Feel confident."
                maxLength={116}
                rows={3}
                required
              />
            </div>

            {/* Unique Mechanism */}
            <div className="space-y-2">
              <Label htmlFor="uniqueMechanism">Unique Mechanism *</Label>
              <Textarea
                id="uniqueMechanism"
                value={formData.uniqueMechanism}
                onChange={(e) => setFormData({ ...formData, uniqueMechanism: e.target.value })}
                placeholder="The 9-Step System That Turns Crypto Beginners Into Passive Income Earners"
                rows={3}
                required
              />
              
              {/* Examples Carousel */}
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Click an example to use:</p>
                <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {UNIQUE_MECHANISM_EXAMPLES.map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFormData({ ...formData, uniqueMechanism: example })}
                      className="text-left text-sm p-2 rounded hover:bg-accent transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div>
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 active-press"
                disabled={generateMutation.isPending || isQuotaExceeded}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Headlines...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Headlines
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Uses 1 Headline Credit
              </p>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
