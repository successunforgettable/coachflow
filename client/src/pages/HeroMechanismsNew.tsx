import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

// Real-world Hero Mechanism examples  (18 examples)
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

  // AutoPop: Auto-fill fields when service is selected
  const handleServiceChange = (serviceId: string) => {
    const id = parseInt(serviceId);
    setSelectedServiceId(id);
    
    const service = services?.find((s) => s.id === id);
    if (service) {
      // Pre-fill targetMarket with psychographic context
      // Priority: 1) Use service.targetCustomer if exists, 2) Construct from avatarTitle + whyProblemExists, 3) Fallback to avatar name
      if (service.targetCustomer) {
        setTargetMarket(service.targetCustomer);
      } else if (service.avatarTitle && service.whyProblemExists) {
        setTargetMarket(`${service.avatarTitle}s struggling with ${service.whyProblemExists}`);
      } else if (service.avatarName && service.avatarTitle) {
        setTargetMarket(`${service.avatarTitle}s like ${service.avatarName}`);
      }
      
      setPressingProblem(service.mainBenefit ? `Struggling with ${service.mainBenefit.toLowerCase()}` : "");
      setDesiredOutcome(service.mainBenefit || "");
      
      // Pre-fill descriptor from AutoPop field
      if (service.mechanismDescriptor) {
        setDescriptor(service.mechanismDescriptor);
      }
      
      // Pre-fill applicationMethod from AutoPop field
      if (service.applicationMethod) {
        setApplicationMethod(service.applicationMethod);
      }
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
          <div className="space-y-2">
            <Label htmlFor="targetMarket">
              Target Market <span className="text-red-500">*</span>
            </Label>
            <Input
              id="targetMarket"
              placeholder="e.g. Women over 45."
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value.slice(0, 52))}
              maxLength={52}
            />
            <p className="text-xs text-muted-foreground">
              {52 - targetMarket.length} chars left
            </p>
          </div>

          {/* Pressing Problem */}
          <div className="space-y-2">
            <Label htmlFor="pressingProblem">
              Pressing Problem <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="pressingProblem"
              placeholder="e.g. Weight gain/metabolism slowing down due to menopause."
              value={pressingProblem}
              onChange={(e) => setPressingProblem(e.target.value.slice(0, 71))}
              maxLength={71}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {71 - pressingProblem.length} chars left
            </p>
            
            {/* Examples Carousel */}
            <div className="mt-4">
              <ExamplesCarousel
                examples={HERO_MECHANISM_EXAMPLES}
                onSelectExample={setPressingProblem}
                title="Hero Mechanism Examples (Click to Use)"
              />
            </div>
          </div>

          {/* Why Problem Exists */}
          <div className="space-y-2">
            <Label htmlFor="whyProblemExists">
              Why does your prospect have this problem in the first place? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="whyProblemExists"
              placeholder="e.g. They've relied on 'word of mouth' and referrals to get customers and grow their business."
              value={whyProblemExists}
              onChange={(e) => setWhyProblemExists(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {150 - whyProblemExists.length} chars left
            </p>
          </div>

          {/* Solutions Tried */}
          <div className="space-y-2">
            <Label htmlFor="solutionsTried">
              What other solutions has your prospect tried to solve this problem? <span className="text-red-500">*</span> (List Out)
            </Label>
            <Textarea
              id="solutionsTried"
              placeholder="e.g. Agencies that promise them the world but deliver no results. SEO services, expensive pay-per-click advertising and complicated webinar funnels."
              value={solutionsTried}
              onChange={(e) => setSolutionsTried(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {150 - solutionsTried.length} chars left
            </p>
          </div>

          {/* Why Solutions Fail */}
          <div className="space-y-2">
            <Label htmlFor="whySolutionsFail">
              Why don't the existing solutions in the market solve this? Where do they fall short? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="whySolutionsFail"
              placeholder="e.g. They either take too long to get results, are far too expensive and complicated to set up and the leads and customers they generate are low-quality."
              value={whySolutionsFail}
              onChange={(e) => setWhySolutionsFail(e.target.value.slice(0, 150))}
              maxLength={150}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {150 - whySolutionsFail.length} chars left
            </p>
          </div>

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
          <div className="space-y-2">
            <Label htmlFor="desiredOutcome">
              Desired Outcome <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="desiredOutcome"
              placeholder="e.g. Being slim, sexy, desirable, impressing their husband, looking like their younger slim self"
              value={desiredOutcome}
              onChange={(e) => setDesiredOutcome(e.target.value.slice(0, 116))}
              maxLength={116}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {116 - desiredOutcome.length} chars left
            </p>
          </div>

          {/* Credible Authority Figure */}
          <div className="space-y-2">
            <Label htmlFor="credibleAuthority">
              Credible Authority Figure <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="credibleAuthority"
              placeholder="e.g. Award-Winning Author and Mind Coach"
              value={credibleAuthority}
              onChange={(e) => setCredibleAuthority(e.target.value.slice(0, 70))}
              maxLength={70}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {70 - credibleAuthority.length} chars left
            </p>
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
          </div>

          {/* Social Proof */}
          <div className="space-y-2">
            <Label htmlFor="socialProof">
              Social Proof <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="socialProof"
              placeholder="i.e. GQ, Elle, Vogue & Forbes"
              value={socialProof}
              onChange={(e) => setSocialProof(e.target.value.slice(0, 100))}
              maxLength={100}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {100 - socialProof.length} chars left
            </p>
          </div>

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
