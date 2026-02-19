import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CharLimitInput } from "@/components/CharLimitInput";
import { CHARACTER_LIMITS } from "@/lib/characterLimits";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ExamplesCarousel from "@/components/ExamplesCarousel";

const DESCRIPTOR_OPTIONS = [
  "Strategy",
  "Framework",
  "Method",
  "System",
  "Secret",
  "Technology",
  "Elixir",
  "AI",
  "Tool",
  "App",
  "Matrix",
  "Loophole",
  "Hack",
  "Algorithm",
  "Algorithm Loophole",
  "Machine",
  "Trade Secrets",
  "Deep Data Systems",
  "Flywheel",
];

const APPLICATION_OPTIONS = [
  "10 Drops",
  "Apply 2 drops",
  "Spend 30 seconds",
  "Spend 5 minutes",
  "Spend 20 minutes per day",
  "Spend 7 days",
  "Add this to coffee or tea",
  "1 Click Button",
  "Use this new tool",
  "Use this new app",
  "Use this system",
  "Use this method",
  "Unlock",
  "Simple switch",
  "Make a few small tweaks",
  "Copy and paste",
  "Swipe and deploy",
  "Apply",
  "Install",
];

// Real-world Hero Mechanism examples from Kong (18 examples)
const HERO_MECHANISM_EXAMPLES = [
  "Breakthrough 'Productivity Triggers' System Slashes 5, 10, Even 51 Hours Off Your Work Week",
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
  "Tiny Orange Plant (a secret ancient ingredient) that speeds up metabolism by up to 68%",
  "Algorithm Loophole That's Now Helping Normal Guys Match With Some of the Most Beautiful Women",
  "Revolutionary 'Autopilot Income' System Generates $10K-$50K Per Month With Zero Active Work",
  "Ancient Himalayan 'Golden Honey' Ritual That Melts Stubborn Belly Fat In 28 Days",
  "Secret 'Compounding Leverage' Strategy Used By Billionaires To 10X Their Wealth",
];

export default function HeroMechanismsNew() {
  const [, setLocation] = useLocation();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [targetMarket, setTargetMarket] = useState("");
  const [pressingProblem, setPressingProblem] = useState("");
  const [whyProblemExists, setWhyProblemExists] = useState("");
  const [solutionsTried, setSolutionsTried] = useState("");
  const [whySolutionsFail, setWhySolutionsFail] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [applicationMethod, setApplicationMethod] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [credibleAuthority, setCredibleAuthority] = useState("");
  const [socialProof, setSocialProof] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const { data: services } = trpc.services.list.useQuery();
  const generateMutation = trpc.heroMechanisms.generate.useMutation({
    onSuccess: (data) => {
      toast.success("Hero Mechanisms generated successfully!");
      setLocation(`/hero-mechanisms/${data.mechanismSetId}`);
    },
    onError: (error) => {
      toast.error(`Failed to generate Hero Mechanisms: ${error.message}`);
    },
  });

  // Auto-fill fields when service is selected
  const handleServiceChange = (serviceId: string) => {
    const id = parseInt(serviceId);
    setSelectedServiceId(id);
    
    const service = services?.find((s) => s.id === id);
    if (service) {
      setTargetMarket(service.targetCustomer || "");
      setPressingProblem(service.mainBenefit ? `Struggling with ${service.mainBenefit.toLowerCase()}` : "");
      setDesiredOutcome(service.mainBenefit || "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedServiceId) {
      toast.error("Please select a product");
      return;
    }

    const requiredFields = [
      { value: targetMarket, name: "Target Market" },
      { value: pressingProblem, name: "Pressing Problem" },
      { value: whyProblemExists, name: "Why problem exists" },
      { value: solutionsTried, name: "Solutions tried" },
      { value: whySolutionsFail, name: "Why solutions fail" },
      { value: desiredOutcome, name: "Desired Outcome" },
      { value: credibleAuthority, name: "Credible Authority Figure" },
      { value: socialProof, name: "Social Proof" },
    ];

    for (const field of requiredFields) {
      if (!field.value.trim()) {
        toast.error(`Please enter ${field.name}`);
        return;
      }
    }

    generateMutation.mutate({
      serviceId: selectedServiceId,
      targetMarket: targetMarket.trim(),
      pressingProblem: pressingProblem.trim(),
      whyProblem: whyProblemExists.trim(),
      whatTried: solutionsTried.trim(),
      whyExistingNotWork: whySolutionsFail.trim(),
      descriptor: descriptor || undefined,
      application: applicationMethod || undefined,
      desiredOutcome: desiredOutcome.trim(),
      credibility: credibleAuthority.trim(),
      socialProof: socialProof.trim(),
    });
  };

  const { data: authData } = trpc.auth.me.useQuery();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();

  // Check if user has reached quota limit
  const isQuotaExceeded = !!(authData && quotaLimits && authData.heroMechanismGeneratedCount >= quotaLimits.heroMechanisms);

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Hero Mechanism</h1>
        <p className="text-muted-foreground">
          Highlight the unique features and benefits that set your product apart
        </p>
      </div>

      {/* Quota Progress Bar */}
      {authData && (
        <div className="mb-6">
          <QuotaProgressBar
            used={authData.heroMechanismGeneratedCount}
            limit={quotaLimits?.heroMechanisms || 50}
            label="Hero Mechanisms Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
          />
        </div>
      )}

      {/* Upgrade Prompt */}
      {authData && authData.subscriptionTier && quotaLimits && authData.heroMechanismGeneratedCount >= quotaLimits.heroMechanisms && (
        <div className="mb-6">
          <UpgradePrompt
            generatorName="Hero Mechanisms"
            currentTier={authData.subscriptionTier}
            used={authData.heroMechanismGeneratedCount}
            limit={quotaLimits.heroMechanisms}
          />
        </div>
      )}

      <Card className="p-6 animate-fade-in">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Product */}
          <div className="space-y-2">
            <Label htmlFor="service">
              Selected Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedServiceId?.toString()}
              onValueChange={handleServiceChange}
            >
              <SelectTrigger id="service">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedServiceId && (
              <p className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setSelectedServiceId(null)}
                  className="text-primary hover:underline"
                >
                  Change
                </button>
              </p>
            )}
          </div>

          {/* Target Market */}
          <CharLimitInput
            label="Target Market"
            value={targetMarket}
            onChange={setTargetMarket}
            maxLength={CHARACTER_LIMITS.heroMechanisms.targetMarket}
            placeholder="e.g. Women over 45."
            required
            id="targetMarket"
          />

          {/* Pressing Problem */}
          <CharLimitInput
            label="Pressing Problem"
            value={pressingProblem}
            onChange={setPressingProblem}
            maxLength={CHARACTER_LIMITS.heroMechanisms.pressingProblem}
            placeholder="e.g. Weight gain/metabolism slowing down due to menopause."
            multiline
            rows={3}
            required
            id="pressingProblem"
          />

          {/* Examples Carousel */}
          <div className="mt-4">
            <ExamplesCarousel
              examples={HERO_MECHANISM_EXAMPLES}
              onSelectExample={setPressingProblem}
              title="Hero Mechanism Examples (Click to Use)"
            />
          </div>

          {/* Why Problem Exists */}
          <CharLimitInput
            label="Why does your prospect have this problem in the first place?"
            value={whyProblemExists}
            onChange={setWhyProblemExists}
            maxLength={0}
            placeholder="e.g. They've relied on 'word of mouth' and referrals to get customers and grow their business."
            multiline
            rows={4}
            required
            id="whyProblemExists"
          />

          {/* Solutions Tried */}
          <CharLimitInput
            label="What other solutions has your prospect tried to solve this problem? (List Out)"
            value={solutionsTried}
            onChange={setSolutionsTried}
            maxLength={0}
            placeholder="e.g. Agencies that promise them the world but deliver no results. SEO services, expensive pay-per-click advertising and complicated webinar funnels."
            multiline
            rows={4}
            required
            id="solutionsTried"
          />

          {/* Why Solutions Fail */}
          <CharLimitInput
            label="Why don't the existing solutions in the market solve this? Where do they fall short?"
            value={whySolutionsFail}
            onChange={setWhySolutionsFail}
            maxLength={0}
            placeholder="e.g. They either take too long to get results, are far too expensive and complicated to set up and the leads and customers they generate are low-quality."
            multiline
            rows={4}
            required
            id="whySolutionsFail"
          />

          {/* Descriptor */}
          <div className="space-y-2">
            <Label htmlFor="descriptor">
              Descriptor For Hero Mechanisms
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              How is your solution superior to the existing solutions available in the market that our prospect has likely tried? i.e. What makes it unique? Do you have a unique algorithm that gets the result? Do you leverage AI? A special framework?
            </p>
            <Select value={descriptor} onValueChange={setDescriptor}>
              <SelectTrigger id="descriptor">
                <SelectValue placeholder="Select A Descriptor" />
              </SelectTrigger>
              <SelectContent>
                {DESCRIPTOR_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Application Method */}
          <div className="space-y-2">
            <Label htmlFor="applicationMethod">
              How Is The Hero Mechanism Applied To Get The Desired Result?
            </Label>
            <Select value={applicationMethod} onValueChange={setApplicationMethod}>
              <SelectTrigger id="applicationMethod">
                <SelectValue placeholder="Select An Option" />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desired Outcome */}
          <CharLimitInput
            label="Desired Outcome"
            value={desiredOutcome}
            onChange={setDesiredOutcome}
            maxLength={CHARACTER_LIMITS.heroMechanisms.desiredOutcome}
            placeholder="e.g. Being slim, sexy, desirable, impressing their husband, looking like their younger slim self"
            multiline
            rows={2}
            required
            id="desiredOutcome"
          />

          {/* Credible Authority Figure */}
          <CharLimitInput
            label="Credible Authority Figure"
            value={credibleAuthority}
            onChange={setCredibleAuthority}
            maxLength={CHARACTER_LIMITS.heroMechanisms.credibleAuthority}
            placeholder="e.g. Award-Winning Author and Mind Coach"
            multiline
            rows={2}
            required
            id="credibleAuthority"
          />
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Show Examples
          </button>
          {showExamples && (
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p><strong>Examples:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Award-Winning Author and Mind Coach</li>
                <li>Published by Penguin & Macmillan</li>
                <li>Featured in GQ, ELLE, Forbes</li>
                <li>Top 7-figure traders and crypto experts</li>
                <li>Best-selling authors and leading authorities</li>
              </ul>
            </div>
          )}

          {/* Social Proof */}
          <CharLimitInput
            label="Social Proof"
            value={socialProof}
            onChange={setSocialProof}
            maxLength={CHARACTER_LIMITS.heroMechanisms.featuredIn}
            placeholder="i.e. GQ, Elle, Vogue & Forbes"
            multiline
            rows={2}
            required
            id="socialProof"
          />

          {/* Disclaimer */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Hero Mechanisms are AI-generated. Please review and edit all content for accuracy before using or publishing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={generateMutation.isPending || isQuotaExceeded}
              className="bg-green-600 hover:bg-green-700 active-press"
            >
              {generateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Hero Mechanisms
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocation("/hero-mechanisms")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
