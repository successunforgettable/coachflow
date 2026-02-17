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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, Loader2, Star, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { exportToPDF } from "@/lib/pdfExport";

export default function AdCopyGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [angle, setAngle] = useState<"story" | "authority" | "question" | "social_proof" | "cta">(
    "story"
  );
  const [customPrompt, setCustomPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: adCopyList, refetch: refetchAdCopy } = trpc.adCopy.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateMutation = trpc.adCopy.generate.useMutation({
    onSuccess: () => {
      toast.success("Ad copy generated successfully!");
      refetchAdCopy();
      setCustomPrompt("");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.adCopy.delete.useMutation({
    onSuccess: () => {
      toast.success("Ad copy deleted");
      refetchAdCopy();
    },
  });

  const updateRatingMutation = trpc.adCopy.update.useMutation({
    onSuccess: () => {
      refetchAdCopy();
    },
  });

  const handleGenerate = () => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }

    generateMutation.mutate({
      serviceId,
      adType: angle,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownloadPDF = (adCopy: any) => {
    const sections = [
      {
        title: "Headline",
        content: adCopy.headline,
      },
      {
        title: "Body Copy",
        content: adCopy.bodyCopy,
      },
      {
        title: "Call to Action",
        content: adCopy.cta || "Not specified",
      },
    ];

    exportToPDF({
      title: "Ad Copy",
      subtitle: `${adCopy.adType?.charAt(0).toUpperCase()}${adCopy.adType?.slice(1)} Ad`,
      sections,
      metadata: {
        generatedDate: new Date(adCopy.createdAt).toLocaleDateString(),
        generatorType: "Ad Copy Generator",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mb-6">
        <QuotaIndicator generatorType="adCopy" />
      </div>
      <PageHeader 
        title="Ad Copy Generator" 
        description="Generate high-converting ad copy with proven formulas"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Generation Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Ad Copy</CardTitle>
                <CardDescription>Select service and angle to generate variations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Select Service
                  </label>
                  <Select
                    value={serviceId?.toString()}
                    onValueChange={(value) => setServiceId(parseInt(value))}
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

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Ad Angle
                  </label>
                  <Select value={angle} onValueChange={(value: any) => setAngle(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">Story (Emotional Connection)</SelectItem>
                      <SelectItem value="authority">Authority (Credibility)</SelectItem>
                      <SelectItem value="question">Question (Curiosity)</SelectItem>
                      <SelectItem value="social_proof">Social Proof (Testimonials)</SelectItem>
                      <SelectItem value="cta">CTA Focused (Direct Action)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Custom Instructions (Optional)
                  </label>
                  <Textarea
                    placeholder="E.g., Focus on transformation stories, target entrepreneurs..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !serviceId}
                  className="w-full"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Ad Copy"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Generated Ad Copy List */}
          <div className="lg:col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar
                placeholder="Search Ad Copy..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">
              Your Ad Copy ({adCopyList?.length || 0})
            </h2>

            {!adCopyList || adCopyList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No ad copy generated yet. Create your first one!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {adCopyList
                  .filter((adCopy) =>
                    adCopy.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    adCopy.bodyCopy.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((adCopy) => (
                  <Card key={adCopy.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {adCopy.adType ? adCopy.adType.charAt(0).toUpperCase() + adCopy.adType.slice(1) : "Ad"} Copy
                          </CardTitle>
                          <CardDescription>
                            {new Date(adCopy.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Rating */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() =>
                                  updateRatingMutation.mutate({
                                    id: adCopy.id,
                                    rating: star,
                                  })
                                }
                                className="hover:scale-110 transition-transform"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    star <= (adCopy.rating || 0)
                                      ? "fill-yellow-500 text-yellow-500"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(adCopy)}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate({ id: adCopy.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Headline */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2">Headline</h4>
                        <div className="flex items-start gap-2 p-3 bg-accent rounded-lg">
                          <span className="text-sm text-foreground flex-1">{adCopy.headline}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(adCopy.headline)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Body Copy */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-2">Body Copy</h4>
                        <div className="flex items-start gap-2 p-3 bg-accent rounded-lg">
                          <span className="text-sm text-foreground flex-1 whitespace-pre-wrap">
                            {adCopy.bodyCopy}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(adCopy.bodyCopy)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Link Description */}
                      {adCopy.linkDescription && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-2">Link Description</h4>
                          <div className="flex items-start gap-2 p-3 bg-accent rounded-lg">
                            <span className="text-sm text-foreground flex-1">
                              {adCopy.linkDescription}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(adCopy.linkDescription!)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
