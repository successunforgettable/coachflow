import { useAuth } from "@/_core/hooks/useAuth";

import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { Loader2, Sparkles, Star, Trash2, Download } from "lucide-react";
import { SkeletonCardList } from "@/components/SkeletonCard";
import { Textarea } from "@/components/ui/textarea";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { exportToPDF } from "@/lib/pdfExport";
import { toast } from "sonner";
import RegenerateSidebar from "@/components/RegenerateSidebar";

// Real-world ICP name examples from Kong
const ICP_NAME_EXAMPLES = [
  "Tech-Savvy Millennial Entrepreneur",
  "Busy Corporate Executive",
  "Health-Conscious Mom Over 40",
  "Aspiring Real Estate Investor",
  "E-Commerce Store Owner",
  "Fitness Enthusiast Seeking Results",
  "High-Ticket Coach or Consultant",
  "B2B Service Provider",
  "Online Course Creator",
  "Agency Owner Scaling Revenue",
  "SaaS Founder Seeking Growth",
  "Crypto Investor Building Wealth",
  "Professional Seeking Career Change",
  "Retired Professional With Savings",
  "Small Business Owner Struggling With Marketing",
];

export default function ICPGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [icpName, setIcpName] = useState("");
  
  const icpNameCharsLeft = 100 - icpName.length;
  const [selectedICPId, setSelectedICPId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Queries
  const { data: authData } = trpc.auth.me.useQuery();
  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Check if user has reached quota limit
  const isQuotaExceeded = !!(authData && quotaLimits && authData.icpGeneratedCount >= quotaLimits.icp);

  const { data: icps, refetch: refetchICPs } = trpc.icps.list.useQuery(
    { serviceId: selectedServiceId || undefined },
    { enabled: isAuthenticated }
  );

  const { data: selectedICP } = trpc.icps.get.useQuery(
    { id: selectedICPId! },
    { enabled: !!selectedICPId }
  );

  // Mutations
  const generateMutation = trpc.icps.generate.useMutation({
    onSuccess: () => {
      refetchICPs();
      setIcpName("");
    },
  });

  const updateMutation = trpc.icps.update.useMutation({
    onSuccess: () => {
      refetchICPs();
    },
  });

  const deleteMutation = trpc.icps.delete.useMutation({
    onSuccess: () => {
      refetchICPs();
      setSelectedICPId(null);
    },
  });

  const generateMoreMutation = trpc.icps.generate.useMutation({
    onSuccess: () => {
      toast.success("Generated 15 more ICPs!");
      refetchICPs();
    },
    onError: (error) => {
      toast.error(`Failed to generate more: ${error.message}`);
    },
  });

  const handleGenerateMore = () => {
    if (!selectedICP || !selectedICP.serviceId) {
      toast.error("Cannot regenerate: No service associated with this ICP");
      return;
    }
    
    // Generate with same serviceId but new auto-generated name
    const timestamp = new Date().toLocaleTimeString();
    generateMoreMutation.mutate({
      serviceId: selectedICP.serviceId,
      name: `${selectedICP.name} - Variation ${timestamp}`,
    });
  };

  const handleGenerate = () => {
    if (!selectedServiceId || !icpName.trim()) {
      toast.error("Please select a service and enter an ICP name");
      return;
    }
    generateMutation.mutate({
      serviceId: selectedServiceId,
      name: icpName.trim(),
    });
  };

  const handleRating = (icpId: number, rating: number) => {
    updateMutation.mutate({ id: icpId, rating });
  };

  const handleDelete = (icpId: number) => {
    if (confirm("Are you sure you want to delete this ICP?")) {
      deleteMutation.mutate({ id: icpId });
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedICP) return;
    
    const sections = [
      { title: "Introduction", content: selectedICP.introduction || "Not specified" },
      { title: "Fears", content: selectedICP.fears || "Not specified" },
      { title: "Hopes & Dreams", content: selectedICP.hopesDreams || "Not specified" },
      {
        title: "Demographics",
        content: selectedICP.demographics
          ? Object.entries(selectedICP.demographics as Record<string, unknown>)
              .map(([key, value]) => `${key.replace(/_/g, " ").toUpperCase()}: ${value}`)
              .join("\n")
          : "Not specified",
      },
      { title: "Psychographics", content: selectedICP.psychographics || "Not specified" },
      { title: "Pains", content: selectedICP.pains || "Not specified" },
      { title: "Frustrations", content: selectedICP.frustrations || "Not specified" },
      { title: "Goals", content: selectedICP.goals || "Not specified" },
      { title: "Values", content: selectedICP.values || "Not specified" },
      { title: "Objections", content: selectedICP.objections || "Not specified" },
      { title: "Buying Triggers", content: selectedICP.buyingTriggers || "Not specified" },
      { title: "Media Consumption", content: selectedICP.mediaConsumption || "Not specified" },
      { title: "Influencers", content: selectedICP.influencers || "Not specified" },
      { title: "Communication Style", content: selectedICP.communicationStyle || "Not specified" },
      { title: "Decision Making", content: selectedICP.decisionMaking || "Not specified" },
      { title: "Success Metrics", content: selectedICP.successMetrics || "Not specified" },
      { title: "Implementation Barriers", content: selectedICP.implementationBarriers || "Not specified" },
    ];

    exportToPDF({
      title: selectedICP.name,
      sections,
    });
  };

  const filteredICPs = icps?.filter((icp) =>
    icp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="h-[400px] bg-card rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2">
            <SkeletonCardList count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Ideal Customer Profile Generator</h1>
        <p className="text-muted-foreground mb-6">
          Please sign in to generate ICPs
        </p>
        <Button asChild>
          <a href={getLoginUrl()}>Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Quota Progress Bar */}
      {authData && (
        <div className="mb-6">
          <QuotaProgressBar
            used={authData.icpGeneratedCount}
            limit={quotaLimits?.icp || 50}
            label="ICP Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
          />
        </div>
      )}

      {/* Upgrade Prompt */}
      {authData && authData.subscriptionTier && quotaLimits && authData.icpGeneratedCount >= quotaLimits.icp && (
        <div className="mb-6">
          <UpgradePrompt
            generatorName="ICP"
            currentTier={authData.subscriptionTier}
            used={authData.icpGeneratedCount}
            limit={quotaLimits.icp}
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ideal Customer Profile Generator</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered customer research with 17 comprehensive sections
          </p>
        </div>
        <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
          0/10 ICPs
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Generator Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate New ICP
              </CardTitle>
              <CardDescription>
                Select a service and name your ideal customer profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="service">Select Service*</Label>
                <Select
                  value={selectedServiceId?.toString() || ""}
                  onValueChange={(value) => setSelectedServiceId(parseInt(value))}
                >
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Choose a service" />
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="icpName">ICP Name*</Label>
                  <span className={`text-xs ${icpNameCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {icpNameCharsLeft} chars left
                  </span>
                </div>
                <Input
                  id="icpName"
                  placeholder="e.g., Tech-Savvy Millennial Entrepreneur"
                  value={icpName}
                  onChange={(e) => setIcpName(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Examples: {ICP_NAME_EXAMPLES.slice(0, 3).join(", ")}
                </p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !selectedServiceId || !icpName.trim() || isQuotaExceeded}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate ICP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ICP List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your ICPs</CardTitle>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search ICPs..."
              />
            </CardHeader>
            <CardContent>
              {filteredICPs && filteredICPs.length > 0 ? (
                <div className="space-y-2">
                  {filteredICPs.map((icp, index) => (
                    <div
                      key={icp.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-smooth animate-fade-in-up ${
                        selectedICPId === icp.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedICPId(icp.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{icp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(icp.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="active-press"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(icp.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ICPs generated yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - ICP Details with 17 Tabs */}
        <div className="lg:col-span-2">
          {selectedICP ? (
            <div className="flex gap-6">
              <div className="flex-1 space-y-6">
                {/* Header with Rating */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{selectedICP.name}</CardTitle>
                        <CardDescription>
                          Created {new Date(selectedICP.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRating(selectedICP.id, star)}
                              disabled={updateMutation.isPending}
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= (selectedICP.rating || 0)
                                    ? "fill-primary text-primary"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={handleDownloadPDF}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleGenerateMore}
                          disabled={generateMoreMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(selectedICP.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* 17 KONG TABS */}
                <Card>
                  <CardContent className="pt-6">
                    <Tabs defaultValue="introduction" className="w-full">
                      <TabsList className="grid grid-cols-6 lg:grid-cols-9 gap-1 h-auto flex-wrap">
                        <TabsTrigger value="introduction">Introduction</TabsTrigger>
                        <TabsTrigger value="fears">Fears</TabsTrigger>
                        <TabsTrigger value="hopesDreams">Hopes & Dreams</TabsTrigger>
                        <TabsTrigger value="demographics">Demographics</TabsTrigger>
                        <TabsTrigger value="psychographics">Psychographics</TabsTrigger>
                        <TabsTrigger value="pains">Pains</TabsTrigger>
                        <TabsTrigger value="frustrations">Frustrations</TabsTrigger>
                        <TabsTrigger value="goals">Goals</TabsTrigger>
                        <TabsTrigger value="values">Values</TabsTrigger>
                        <TabsTrigger value="objections">Objections</TabsTrigger>
                        <TabsTrigger value="buyingTriggers">Buying Triggers</TabsTrigger>
                        <TabsTrigger value="mediaConsumption">Media</TabsTrigger>
                        <TabsTrigger value="influencers">Influencers</TabsTrigger>
                        <TabsTrigger value="communicationStyle">Communication</TabsTrigger>
                        <TabsTrigger value="decisionMaking">Decision Making</TabsTrigger>
                        <TabsTrigger value="successMetrics">Success Metrics</TabsTrigger>
                        <TabsTrigger value="implementationBarriers">Barriers</TabsTrigger>
                      </TabsList>

                      <TabsContent value="introduction" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Introduction</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.introduction || "No introduction generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="fears" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Fears</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.fears || "No fears generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="hopesDreams" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Hopes & Dreams</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.hopesDreams || "No hopes & dreams generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="demographics" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Demographics</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {selectedICP.demographics &&
                              typeof selectedICP.demographics === "object" &&
                              Object.entries(selectedICP.demographics).map(([key, value]) => (
                                <div key={key}>
                                  <p className="text-sm font-medium text-muted-foreground capitalize">
                                    {key.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-foreground">{value as string}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="psychographics" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Psychographics</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.psychographics || "No psychographics generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="pains" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Pains</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.pains || "No pains generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="frustrations" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Frustrations</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.frustrations || "No frustrations generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="goals" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Goals</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.goals || "No goals generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="values" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Values</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.values || "No values generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="objections" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Objections</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.objections || "No objections generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="buyingTriggers" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Buying Triggers</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.buyingTriggers || "No buying triggers generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="mediaConsumption" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Media Consumption</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.mediaConsumption || "No media consumption data generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="influencers" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Influencers</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.influencers || "No influencers data generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="communicationStyle" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Communication Style</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.communicationStyle || "No communication style data generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="decisionMaking" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Decision Making</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.decisionMaking || "No decision making data generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="successMetrics" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Success Metrics</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.successMetrics || "No success metrics generated yet."}
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="implementationBarriers" className="mt-6">
                        <div className="prose prose-invert max-w-none">
                          <h3 className="text-xl font-semibold mb-4">Implementation Barriers</h3>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {selectedICP.implementationBarriers || "No implementation barriers generated yet."}
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              {/* Regenerate Sidebar */}
              <RegenerateSidebar
                title="Regenerate Avatar"
                subtitle="Submit or modify the pre-filled form below to regenerate a similar ICP"
                onRegenerate={() => {
                  if (!selectedICP.serviceId) {
                    toast.error("Cannot regenerate: No service associated with this ICP");
                    return;
                  }
                  const timestamp = new Date().toLocaleTimeString();
                  generateMoreMutation.mutate({
                    serviceId: selectedICP.serviceId,
                    name: `${selectedICP.name} - Variation ${timestamp}`,
                  });
                }}
                isLoading={generateMoreMutation.isPending}
              >
                <div className="space-y-4">
                  <div>
                    <Label>Selected Service</Label>
                    <p className="text-sm text-muted-foreground">
                      {services?.find((s) => s.id === selectedICP.serviceId)?.name || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="regenerate-name">ICP Name</Label>
                    <Input
                      id="regenerate-name"
                      defaultValue={selectedICP.name}
                      placeholder="Enter new ICP name"
                    />
                  </div>
                </div>
              </RegenerateSidebar>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Select an ICP from the list or generate a new one to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
