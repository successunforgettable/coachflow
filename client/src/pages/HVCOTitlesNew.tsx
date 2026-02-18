import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
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
import { Loader2 } from "lucide-react";
import ExamplesCarousel from "@/components/ExamplesCarousel";


// Real-world HVCO topic examples from Kong (18 examples)
const HVCO_TOPIC_EXAMPLES = [
  "How to build a 7-figure coaching business in 12 months without paid ads using organic content and strategic partnerships",
  "The exact system I used to replace my $150K corporate salary with passive income from rental properties in 24 months",
  "How to scale your e-commerce store from $10K/month to $100K/month using Facebook ads and conversion rate optimization",
  "The step-by-step blueprint for launching a profitable online course that generates $50K+ per month on autopilot",
  "How to build a 6-figure consulting practice in 90 days by positioning yourself as the go-to expert in your niche",
  "The proven framework for creating viral content that attracts high-ticket clients without spending a dime on advertising",
  "How to leverage LinkedIn to book 20-30 qualified sales calls per month for your B2B service business",
  "The complete system for building a $1M/year agency with just 10 high-paying retainer clients",
  "How to create a membership site that generates $20K-$50K in recurring monthly revenue within 6 months",
  "The exact funnel strategy that took my info product from $5K/month to $100K/month in 8 months",
  "How to build an email list of 100K+ engaged subscribers and monetize it to $500K+ per year",
  "The proven method for getting featured in major publications and becoming a recognized authority in your industry",
  "How to create a high-ticket mastermind program that sells for $25K-$50K per person and fills consistently",
  "The complete guide to building a YouTube channel that generates $10K-$30K per month in ad revenue and sponsorships",
  "How to transition from trading time for money to building scalable systems that generate income while you sleep",
  "The proven strategy for landing corporate speaking gigs that pay $10K-$50K per engagement",
  "How to build a personal brand that attracts opportunities, partnerships, and high-ticket clients on autopilot",
  "The complete system for creating and selling digital products that generate $100K+ in passive income annually",
];

export default function HVCOTitlesNew() {
  const [, setLocation] = useLocation();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [targetMarket, setTargetMarket] = useState("");
  const [hvcoTopic, setHvcoTopic] = useState("");

  const { data: services } = trpc.services.list.useQuery();
  const generateMutation = trpc.hvco.generate.useMutation({
    onSuccess: (data) => {
      toast.success("HVCO Titles generated successfully!");
      setLocation(`/hvco-titles/${data.hvcoSetId}`);
    },
    onError: (error) => {
      toast.error(`Failed to generate HVCO Titles: ${error.message}`);
    },
  });

  // Auto-fill target market when service is selected
  const handleServiceChange = (serviceId: string) => {
    const id = parseInt(serviceId);
    setSelectedServiceId(id);
    
    const service = services?.find((s) => s.id === id);
    if (service) {
      setTargetMarket(service.targetCustomer || "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedServiceId) {
      toast.error("Please select a product");
      return;
    }

    if (!targetMarket.trim()) {
      toast.error("Please enter a target market");
      return;
    }

    if (!hvcoTopic.trim()) {
      toast.error("Please describe what the HVCO talks about");
      return;
    }

    generateMutation.mutate({
      serviceId: selectedServiceId,
      targetMarket: targetMarket.trim(),
      hvcoTopic: hvcoTopic.trim(),
    });
  };

  const targetMarketCharsLeft = 52 - targetMarket.length;
  const hvcoTopicCharsLeft = 72 - hvcoTopic.length;

  const { data: authData } = trpc.auth.me.useQuery();

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New HVCO</h1>
        <p className="text-muted-foreground">
          Generate compelling titles for your high-value content offer
        </p>
      </div>

      {/* Quota Progress Bar */}
      {authData && (
        <div className="mb-6">
          <QuotaProgressBar
            used={authData.hvcoGeneratedCount}
            limit={50}
            label="HVCO Titles Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
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
              {targetMarketCharsLeft} chars left
            </p>
          </div>

          {/* HVCO Topic */}
          <div className="space-y-2">
            <Label htmlFor="hvcoTopic">
              What does the HVCO talk about? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="hvcoTopic"
              placeholder="e.g. replacing a 9 to 5 income and retiring 8 to 15 years earlier through building an investment property portfolio."
              value={hvcoTopic}
              onChange={(e) => setHvcoTopic(e.target.value.slice(0, 72))}
              maxLength={72}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {hvcoTopicCharsLeft} chars left
            </p>
            
            {/* Examples Carousel */}
            <div className="mt-4">
              <ExamplesCarousel
                examples={HVCO_TOPIC_EXAMPLES}
                onSelectExample={setHvcoTopic}
                title="HVCO Topic Examples (Click to Use)"
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              HVCOs are AI-generated. Please review and edit all content for accuracy before using or publishing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="bg-green-600 hover:bg-green-700 active-press"
            >
              {generateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Generate HVCO Titles
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLocation("/hvco-titles")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
