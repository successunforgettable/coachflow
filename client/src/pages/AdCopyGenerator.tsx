import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, Trash2, Eye } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";

// Real-world ad angle examples from Kong
const AD_ANGLE_EXAMPLES = {
  lead_gen: [
    "Free webinar: How to build a 6-figure coaching business in 90 days",
    "Download the complete guide to scaling your consulting practice",
    "Join our free masterclass on creating high-ticket offers that sell",
  ],
  ecommerce: [
    "Limited-time offer: Get 50% off our best-selling course",
    "New product launch: Transform your business with our proven system",
    "Flash sale: Premium coaching program now available at early-bird pricing",
  ],
};

export default function AdCopyGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [adType, setAdType] = useState<"lead_gen" | "ecommerce">("lead_gen");
  const [targetMarket, setTargetMarket] = useState("");
  const [pressingProblem, setPressingProblem] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [uniqueMechanism, setUniqueMechanism] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: adSets, refetch: refetchAdCopy } = trpc.adCopy.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateMutation = trpc.adCopy.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.headlineCount} headlines, ${data.bodyCount} body copies, ${data.linkCount} link descriptions!`);
      refetchAdCopy();
      // Reset form
      setTargetMarket("");
      setPressingProblem("");
      setDesiredOutcome("");
      setUniqueMechanism("");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteAdSetMutation = trpc.adCopy.deleteAdSet.useMutation({
    onSuccess: () => {
      toast.success("Ad set deleted");
      refetchAdCopy();
    },
  });

  const handleGenerate = () => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }
    if (!targetMarket.trim()) {
      toast.error("Please enter target market");
      return;
    }
    if (!pressingProblem.trim()) {
      toast.error("Please describe the pressing problem");
      return;
    }
    if (!desiredOutcome.trim()) {
      toast.error("Please describe the desired outcome");
      return;
    }
    if (!uniqueMechanism.trim()) {
      toast.error("Please describe the unique mechanism");
      return;
    }

    generateMutation.mutate({
      serviceId,
      adType,
      targetMarket: targetMarket.trim(),
      pressingProblem: pressingProblem.trim(),
      desiredOutcome: desiredOutcome.trim(),
      uniqueMechanism: uniqueMechanism.trim(),
    });
  };

  const filteredAdSets = adSets?.filter((adSet: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      adSet.targetMarket?.toLowerCase().includes(query) ||
      adSet.pressingProblem?.toLowerCase().includes(query) ||
      adSet.desiredOutcome?.toLowerCase().includes(query)
    );
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Please log in to access Ad Copy Generator</h1>
        <Button asChild>
          <a href={getLoginUrl()}>Log In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Facebook Ad Copy Generator"
        description="Generate high-converting Facebook/Instagram ad copy with headlines, body text, and link descriptions"
      />

      <QuotaIndicator generatorType="adCopy" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Generation Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Generate New Ad Copy</CardTitle>
              <CardDescription>
                Create 15 headlines, 15 body copies, and 15 link descriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service Selection */}
              <div className="space-y-2">
                <Label>Service/Product</Label>
                <Select
                  value={serviceId?.toString() || ""}
                  onValueChange={(value) => setServiceId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map((service: any) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ad Type Selection */}
              <div className="space-y-2">
                <Label>Ad Type</Label>
                <Select
                  value={adType}
                  onValueChange={(value: "lead_gen" | "ecommerce") => setAdType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_gen">Lead Generation</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {adType === "lead_gen"
                    ? "For free webinars, consultations, downloads"
                    : "For direct product/service sales"}
                </p>
              </div>

              {/* Examples Carousel */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Examples (click to use):</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                  {AD_ANGLE_EXAMPLES[adType].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setDesiredOutcome(example)}
                      className="text-left text-sm p-2 rounded hover:bg-accent transition-colors w-full"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Market */}
              <div className="space-y-2">
                <Label>Target Market</Label>
                <Input
                  placeholder="e.g., Coaches and consultants making $50K-$200K/year"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  {255 - targetMarket.length} characters remaining
                </p>
              </div>

              {/* Pressing Problem */}
              <div className="space-y-2">
                <Label>Pressing Problem</Label>
                <Textarea
                  placeholder="What keeps your target market up at night?"
                  value={pressingProblem}
                  onChange={(e) => setPressingProblem(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Desired Outcome */}
              <div className="space-y-2">
                <Label>Desired Outcome</Label>
                <Textarea
                  placeholder="What transformation do they want to achieve?"
                  value={desiredOutcome}
                  onChange={(e) => setDesiredOutcome(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Unique Mechanism */}
              <div className="space-y-2">
                <Label>Unique Mechanism</Label>
                <Textarea
                  placeholder="What makes your solution different and better?"
                  value={uniqueMechanism}
                  onChange={(e) => setUniqueMechanism(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Ad Copy...
                  </>
                ) : (
                  "Generate Ad Copy (15 Headlines, 15 Bodies, 15 Links)"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Generated Ad Sets List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Ad Sets</h2>
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search ad sets..." />
          </div>

          <div className="space-y-4">
            {filteredAdSets && filteredAdSets.length > 0 ? (
              filteredAdSets.map((adSet: any) => (
                <Card key={adSet.adSetId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {adSet.adType === "lead_gen" ? "Lead Generation" : "E-commerce"} Ad Set
                        </CardTitle>
                        <CardDescription>
                          {new Date(adSet.createdAt).toLocaleDateString()} • {adSet.headlines.length} headlines, {adSet.bodies.length} bodies, {adSet.links.length} links
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this ad set?")) {
                            deleteAdSetMutation.mutate({ adSetId: adSet.adSetId });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold">Target Market:</span>{" "}
                        {adSet.targetMarket}
                      </div>
                      <div>
                        <span className="font-semibold">Pressing Problem:</span>{" "}
                        {adSet.pressingProblem?.substring(0, 100)}
                        {adSet.pressingProblem?.length > 100 ? "..." : ""}
                      </div>
                    </div>
                    <Link href={`/ad-copy/${adSet.adSetId}`}>
                      <Button className="w-full mt-4" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Ad Copy
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  {searchQuery
                    ? "No ad sets match your search"
                    : "No ad sets yet. Generate your first ad copy!"}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
