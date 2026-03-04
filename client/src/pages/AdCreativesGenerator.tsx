import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { Loader2, Download, Star, AlertTriangle, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { SkeletonCardList } from "@/components/SkeletonCard";

export default function AdCreativesGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [niche, setNiche] = useState("");
  const [productName, setProductName] = useState("");
  const [uniqueMechanism, setUniqueMechanism] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [mainBenefit, setMainBenefit] = useState("");
  const [pressingProblem, setPressingProblem] = useState("");
  const [adType, setAdType] = useState<"lead_gen" | "ecommerce">("lead_gen");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });

  // AutoPop: Pre-fill fields when service is selected
  const handleServiceChange = (value: string) => {
    const id = parseInt(value, 10);
    setServiceId(id);
    
    const service = services?.find(s => s.id === id);
    if (service) {
      setProductName(service.name || "");
      setNiche(service.category || "");
      
      // Pre-fill targetAudience with psychographic context
      // Priority: 1) Use service.targetCustomer if exists, 2) Construct from avatarTitle + whyProblemExists, 3) Fallback to avatar name
      if (service.targetCustomer) {
        setTargetAudience(service.targetCustomer);
      } else if (service.avatarTitle && service.whyProblemExists) {
        setTargetAudience(`${service.avatarTitle}s struggling with ${service.whyProblemExists}`);
      } else if (service.avatarName && service.avatarTitle) {
        setTargetAudience(`${service.avatarTitle}s like ${service.avatarName}`);
      }
      
      setMainBenefit(service.mainBenefit || "");
    }
  };
  const { data: batches, refetch } = trpc.adCreatives.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: selectedBatch } = trpc.adCreatives.getBatch.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const generateMutation = trpc.adCreatives.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`5 ad images generated successfully!`);
      refetch();
      setSelectedBatchId(data.batchId);
      // Reset form
      setNiche("");
      setProductName("");
      setUniqueMechanism("");
      setTargetAudience("");
      setMainBenefit("");
      setPressingProblem("");
    },
    onError: (error) => {
      toast.error(`Failed to generate ad images: ${error.message}`);
    },
  });

  const rateMutation = trpc.adCreatives.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating saved!");
      refetch();
    },
  });

  const deleteMutation = trpc.adCreatives.deleteBatch.useMutation({
    onSuccess: () => {
      toast.success("Batch deleted successfully");
      refetch();
      setSelectedBatchId(null);
    },
  });

  const handleGenerate = () => {
    if (!serviceId || !niche || !productName || !targetAudience || !mainBenefit || !pressingProblem) {
      toast.error("Please fill in all required fields");
      return;
    }

    generateMutation.mutate({
      serviceId,
      niche,
      productName,
      uniqueMechanism,
      targetAudience,
      mainBenefit,
      pressingProblem,
      adType,
    });
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image downloaded!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  if (authLoading) {
    return <SkeletonCardList />;
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Scroll-Stopper Ad Creator"
        description="Generate tabloid-style, gossip magazine aesthetic ad images that stop people from scrolling"
      />

      <div className="container py-8">
        {/* Generator Form */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Generate Your Ad Images</CardTitle>
                <CardDescription>
                  Create 5 dramatic, tabloid-style ad variations optimized for Facebook/Instagram
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Service Selection */}
            <div>
              <Label htmlFor="service">Service / Product *</Label>
              <Select value={serviceId?.toString() || ""} onValueChange={handleServiceChange}>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Select a service" />
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

            {/* Ad Type */}
            <div>
              <Label htmlFor="adType">Ad Type *</Label>
              <Select value={adType} onValueChange={(value: "lead_gen" | "ecommerce") => setAdType(value)}>
                <SelectTrigger id="adType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_gen">Lead Generation (Webinar, Free Training)</SelectItem>
                  <SelectItem value="ecommerce">E-commerce (Product Sales)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Niche */}
            <div>
              <Label htmlFor="niche">Niche / Industry *</Label>
              <Input
                id="niche"
                placeholder="e.g., crypto, mind coaching, fitness, real estate"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>

            {/* Product Name */}
            <div>
              <Label htmlFor="productName">Product / Service Name *</Label>
              <Input
                id="productName"
                placeholder="e.g., ZAP - Zero-to-Ads Platform"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Unique Mechanism */}
            <div>
              <Label htmlFor="mechanism">Unique Mechanism (Optional)</Label>
              <Input
                id="mechanism"
                placeholder="e.g., 9-Step System, Firewall Formula"
                value={uniqueMechanism}
                onChange={(e) => setUniqueMechanism(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your proprietary method or system name
              </p>
            </div>

            {/* Target Audience */}
            <div>
              <Label htmlFor="audience">Target Audience *</Label>
              <Input
                id="audience"
                placeholder="e.g., crypto beginners, entrepreneurs, busy moms"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            {/* Main Benefit */}
            <div>
              <Label htmlFor="benefit">Main Benefit / Transformation *</Label>
              <Textarea
                id="benefit"
                placeholder="e.g., Build wealth in crypto, Rewire your brain for success, Lose 20 pounds"
                value={mainBenefit}
                onChange={(e) => setMainBenefit(e.target.value)}
                rows={2}
              />
            </div>

            {/* Pressing Problem */}
            <div>
              <Label htmlFor="problem">The main problem you solve *</Label>
              <Textarea
                id="problem"
                placeholder="e.g., Losing money in crypto, Stuck mindset holding you back, Can't lose weight"
                value={pressingProblem}
                onChange={(e) => setPressingProblem(e.target.value)}
                rows={2}
              />
            </div>

            {/* Meta Compliance Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                    Meta Ad Compliance
                  </p>
                  <p className="text-yellow-800 dark:text-yellow-300">
                    Avoid prohibited claims: "Make $X guaranteed", "Earn money while you sleep", "Get rich quick".
                    Use educational language instead: "Learn the system", "Discover how others approached wealth building".
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              size="lg"
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating 5 Variations... (2-3 minutes)
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate 5 Ad Images
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Batches List */}
        {batches && batches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Your Ad Creative Batches</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <Card
                  key={batch.batchId}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedBatchId(batch.batchId)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{batch.productName}</CardTitle>
                    <CardDescription>
                      {batch.niche} • {batch.creatives.length} variations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {batch.creatives.slice(0, 3).map((creative) => (
                        <img
                          key={creative.id}
                          src={creative.imageUrl}
                          alt={creative.headline}
                          className="w-full aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Selected Batch Details */}
        {selectedBatch && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Ad Creative Variations</h2>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete this entire batch?")) {
                    deleteMutation.mutate({ batchId: selectedBatchId! });
                  }
                }}
              >
                Delete Batch
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedBatch.map((creative) => (
                <Card key={creative.id}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Variation {creative.variationNumber}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {creative.designStyle.replace(/_/g, " ")} • {creative.headlineFormula}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Image */}
                    <img
                      src={creative.imageUrl}
                      alt={creative.headline}
                      className="w-full aspect-square object-cover rounded-lg"
                    />

                    {/* Headline */}
                    <div>
                      <p className="font-bold text-sm">{creative.headline}</p>
                    </div>

                    {/* Compliance Issues */}
                    {creative.complianceIssues && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                        <p className="text-xs font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                          ⚠️ Compliance Warnings:
                        </p>
                        <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1">
                          {JSON.parse(creative.complianceIssues).map((issue: string, idx: number) => (
                            <li key={idx}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 cursor-pointer ${
                            (creative.rating || 0) >= star
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                          onClick={() => rateMutation.mutate({ id: creative.id, rating: star })}
                        />
                      ))}
                    </div>

                    {/* Download Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        handleDownload(
                          creative.imageUrl,
                          `${creative.productName}-variation-${creative.variationNumber}.png`
                        )
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download (1080x1080)
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
