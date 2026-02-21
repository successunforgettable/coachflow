import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Copy, Download, Trash2, ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegenerateConfirmationDialog } from "@/components/RegenerateConfirmationDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { checkCompliance } from "@/lib/complianceUtils";
import { PublishToMetaDialog } from "@/components/PublishToMetaDialog";
import { Send } from "lucide-react";

export default function AdCopyDetail() {
  const [, params] = useRoute("/ad-copy/:adSetId");
  const adSetId = params?.adSetId || "";
  const [powerMode, setBeastMode] = useState(false);
  const [activeTab, setActiveTab] = useState("headlines");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedHeadline, setSelectedHeadline] = useState("");
  const [selectedBody, setSelectedBody] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { user } = useAuth();

  const { data: adSet, isLoading, refetch } = trpc.adCopy.getByAdSetId.useQuery(
    { adSetId },
    { enabled: !!adSetId }
  );

  const updateMutation = trpc.adCopy.update.useMutation({
    onSuccess: () => {
      toast.success("Ad copy updated");
      refetch();
    },
  });

  const deleteAdSetMutation = trpc.adCopy.deleteAdSet.useMutation({
    onSuccess: () => {
      toast.success("Ad set deleted");
      window.location.href = "/ad-copy";
    },
  });

  const generateMutation = trpc.adCopy.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} new ad variations!`);
      refetch();
    },
  });

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleRating = (id: number, rating: number) => {
    updateMutation.mutate({ id, rating });
  };

  const handleExportPDF = () => {
    if (!adSet) return;
    
    const content = `
# Facebook Ad Copy - ${adSet.adType === "lead_gen" ? "Lead Generation" : "E-commerce"}

## Target Market
${adSet.targetMarket}

## Pressing Problem
${adSet.pressingProblem}

## Desired Outcome
${adSet.desiredOutcome}

## Unique Mechanism
${adSet.uniqueMechanism}

---

## Ad Headlines (${adSet.headlines.length})

${adSet.headlines.map((h: any, i: number) => `${i + 1}. ${h.content}`).join("\n\n")}

---

## Body Copy (${adSet.bodies.length})

${adSet.bodies.map((b: any, i: number) => `### Variation ${i + 1}\n\n${b.content}`).join("\n\n---\n\n")}

---

## Link Descriptions (${adSet.links.length})

${adSet.links.map((l: any, i: number) => `${i + 1}. ${l.content}`).join("\n\n")}
`;

    exportToPDF({
      title: `Facebook Ad Copy - ${adSet.adType === "lead_gen" ? "Lead Generation" : "E-commerce"}`,
      subtitle: `Target Market: ${adSet.targetMarket}`,
      sections: [
        {
          title: "Generation Parameters",
          content: [
            `Pressing Problem: ${adSet.pressingProblem}`,
            `Desired Outcome: ${adSet.desiredOutcome}`,
            `Unique Mechanism: ${adSet.uniqueMechanism}`,
          ],
        },
        {
          title: `Ad Headlines (${adSet.headlines.length})`,
          content: adSet.headlines.map((h: any) => h.content),
        },
        {
          title: `Body Copy (${adSet.bodies.length})`,
          content: adSet.bodies.map((b: any) => b.content),
        },
        {
          title: `Link Descriptions (${adSet.links.length})`,
          content: adSet.links.map((l: any) => l.content),
        },
      ],
      metadata: {
        generatedDate: new Date(adSet.createdAt).toLocaleDateString(),
        generatorType: "Facebook Ad Copy Generator",
      },
    });
  };

  const handleMoreLikeThis = () => {
    setShowConfirmDialog(true);
  };

  const confirmMoreLikeThis = () => {
    if (!adSet) return;
    
    setShowConfirmDialog(false);
    generateMutation.mutate({
      serviceId: adSet.serviceId!,
      campaignId: adSet.campaignId || undefined,
      adType: adSet.adType,
      adStyle: adSet.adStyle || "Hero Ad",
      adCallToAction: adSet.adCallToAction || "Download free report",
      targetMarket: adSet.targetMarket || "",
      productCategory: adSet.productCategory || "",
      specificProductName: adSet.specificProductName || "",
      pressingProblem: adSet.pressingProblem || "",
      desiredOutcome: adSet.desiredOutcome || "",
      uniqueMechanism: adSet.uniqueMechanism || "",
      listBenefits: adSet.listBenefits || "",
      specificTechnology: adSet.specificTechnology || "",
      scientificStudies: adSet.scientificStudies || "",
      credibleAuthority: adSet.credibleAuthority || "",
      featuredIn: adSet.featuredIn || "",
      numberOfReviews: adSet.numberOfReviews || "",
      averageReviewRating: adSet.averageReviewRating || "",
      totalCustomers: adSet.totalCustomers || "",
      testimonials: adSet.testimonials || "",
      powerMode,
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">Loading ad copy...</div>
      </div>
    );
  }

  if (!adSet) {
    return (
      <div className="container py-8">
        <div className="text-center">Ad set not found</div>
      </div>
    );
  }

  const handleRegenerate = () => {
    if (!adSet?.serviceId) {
      toast.error("Cannot regenerate: No service associated with this ad set");
      return;
    }
    generateMutation.mutate({
      serviceId: adSet.serviceId,
      adType: adSet.adType,
      adStyle: adSet.adStyle || "Hero Ad",
      adCallToAction: adSet.adCallToAction || "Download free report",
      targetMarket: adSet.targetMarket || "",
      productCategory: adSet.productCategory || "",
      specificProductName: adSet.specificProductName || "",
      pressingProblem: adSet.pressingProblem || "",
      desiredOutcome: adSet.desiredOutcome || "",
      uniqueMechanism: adSet.uniqueMechanism || "",
      listBenefits: adSet.listBenefits || "",
      specificTechnology: adSet.specificTechnology || "",
      scientificStudies: adSet.scientificStudies || "",
      credibleAuthority: adSet.credibleAuthority || "",
      featuredIn: adSet.featuredIn || "",
      numberOfReviews: adSet.numberOfReviews || "",
      averageReviewRating: adSet.averageReviewRating || "",
      totalCustomers: adSet.totalCustomers || "",
      testimonials: adSet.testimonials || "",
      powerMode,
    });
  };

  return (
    <div className="container py-8">
      <div className="flex gap-6">
      <div className="flex-1">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/ad-copy">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ad Copy
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {adSet.adType === "lead_gen" ? "Lead Generation" : "E-commerce"} Ad Copy
        </h1>
        <p className="text-muted-foreground">
          Generated {new Date(adSet.createdAt).toLocaleDateString()} • {adSet.headlines.length} headlines, {adSet.bodies.length} body copies, {adSet.links.length} link descriptions
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          onClick={() => {
            // Use first headline and body as defaults
            if (adSet.headlines.length > 0 && adSet.bodies.length > 0) {
              setSelectedHeadline(adSet.headlines[0].content);
              setSelectedBody(adSet.bodies[0].content);
              setPublishDialogOpen(true);
            } else {
              toast.error("Need at least one headline and body copy to publish");
            }
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Send className="h-4 w-4 mr-2" />
          Publish to Meta
        </Button>
        <Button onClick={handleExportPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button
          onClick={() => {
            if (confirm("Delete this entire ad set?")) {
              deleteAdSetMutation.mutate({ adSetId });
            }
          }}
          variant="outline"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Ad Set
        </Button>
      </div>

      {/* Product Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generation Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="font-semibold">Target Market:</span> {adSet.targetMarket}
          </div>
          <div>
            <span className="font-semibold">Pressing Problem:</span> {adSet.pressingProblem}
          </div>
          <div>
            <span className="font-semibold">Desired Outcome:</span> {adSet.desiredOutcome}
          </div>
          <div>
            <span className="font-semibold">Unique Mechanism:</span> {adSet.uniqueMechanism}
          </div>
        </CardContent>
      </Card>

      {/* Power Mode Toggle */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="beast-mode" className="text-base font-semibold">
                🔥 Power Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Generate {powerMode ? "30" : "15"} variations per content type ({powerMode ? "2x" : "1x"})
              </p>
            </div>
            <Switch
              id="beast-mode"
              checked={powerMode}
              onCheckedChange={setBeastMode}
            />
          </div>
          <Button
            onClick={handleMoreLikeThis}
            disabled={generateMutation.isPending}
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {generateMutation.isPending
              ? `Generating ${powerMode ? "30" : "15"} variations...`
              : `+${powerMode ? "30" : "15"} More Like This`}
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="headlines">
            Ad Headlines ({adSet.headlines.length})
          </TabsTrigger>
          <TabsTrigger value="body">
            Body Copy ({adSet.bodies.length})
          </TabsTrigger>
          <TabsTrigger value="links">
            Link Descriptions ({adSet.links.length})
          </TabsTrigger>
        </TabsList>

        {/* Headlines Tab */}
        <TabsContent value="headlines" className="space-y-4 mt-6">
          {adSet.headlines.map((headline: any, index: number) => (
            <Card key={headline.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      Headline {index + 1}
                    </div>
                    <div className="text-lg font-medium">{headline.content}</div>
                    {headline.complianceScore !== null && headline.complianceScore !== undefined && (
                      <ComplianceBadge
                        score={headline.complianceScore}
                        compliant={headline.complianceScore >= 90}
                        issues={checkCompliance(headline.content).issues}
                        suggestions={checkCompliance(headline.content).suggestions}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(headline.id, headline.rating === 1 ? 0 : 1)}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 ${headline.rating === 1 ? "fill-green-500 text-green-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(headline.id, headline.rating === -1 ? 0 : -1)}
                    >
                      <ThumbsDown
                        className={`h-4 w-4 ${headline.rating === -1 ? "fill-red-500 text-red-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(headline.content)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Body Copy Tab */}
        <TabsContent value="body" className="space-y-4 mt-6">
          {adSet.bodies.map((body: any, index: number) => (
            <Card key={body.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      Body Copy {index + 1}
                    </div>
                    <div className="whitespace-pre-wrap">{body.content}</div>
                    {body.complianceScore !== null && body.complianceScore !== undefined && (
                      <ComplianceBadge
                        score={body.complianceScore}
                        compliant={body.complianceScore >= 90}
                        issues={checkCompliance(body.content).issues}
                        suggestions={checkCompliance(body.content).suggestions}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(body.id, body.rating === 1 ? 0 : 1)}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 ${body.rating === 1 ? "fill-green-500 text-green-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(body.id, body.rating === -1 ? 0 : -1)}
                    >
                      <ThumbsDown
                        className={`h-4 w-4 ${body.rating === -1 ? "fill-red-500 text-red-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(body.content)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Link Descriptions Tab */}
        <TabsContent value="links" className="space-y-4 mt-6">
          {adSet.links.map((link: any, index: number) => (
            <Card key={link.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      Link Description {index + 1}
                    </div>
                    <div className="text-lg font-medium">{link.content}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(link.id, link.rating === 1 ? 0 : 1)}
                    >
                      <ThumbsUp
                        className={`h-4 w-4 ${link.rating === 1 ? "fill-green-500 text-green-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRating(link.id, link.rating === -1 ? 0 : -1)}
                    >
                      <ThumbsDown
                        className={`h-4 w-4 ${link.rating === -1 ? "fill-red-500 text-red-500" : ""}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(link.content)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      </div>

      {/* Regenerate Sidebar */}
      <RegenerateSidebar
        title="Regenerate Facebook Ad"
        subtitle="Submit or modify the pre-filled form below to regenerate similar ad copy"
        onRegenerate={handleRegenerate}
        isLoading={generateMutation.isPending}
        creditText="Uses 1 Facebook Ad Credit"
      >
        <div className="space-y-4">
          <div>
            <Label>Ad Type*</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={adSet.adType === "lead_gen" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled
              >
                Lead Gen
              </Button>
              <Button
                type="button"
                variant={adSet.adType === "ecommerce" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled
              >
                Ecommerce
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="targetMarket">Target Market*</Label>
            <Input
              id="targetMarket"
              value={adSet.targetMarket || ""}
              readOnly
              maxLength={52}
            />
          </div>
          <div>
            <Label htmlFor="pressingProblem">Pressing Problem*</Label>
            <Textarea
              id="pressingProblem"
              value={adSet.pressingProblem || ""}
              readOnly
              maxLength={48}
            />
          </div>
          <div>
            <Label htmlFor="desiredOutcome">Desired Outcome*</Label>
            <Input
              id="desiredOutcome"
              value={adSet.desiredOutcome || ""}
              readOnly
              maxLength={25}
            />
          </div>
          <div>
            <Label htmlFor="uniqueMechanism">Unique Mechanism*</Label>
            <Textarea
              id="uniqueMechanism"
              value={adSet.uniqueMechanism || ""}
              readOnly
            />
          </div>
          <div className="text-xs text-muted-foreground italic">
            Note: Full 17-field form with character limits will be added in next iteration
          </div>
        </div>
      </RegenerateSidebar>

      {/* Regenerate Confirmation Dialog */}
      <RegenerateConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmMoreLikeThis}
        generatorName="Ad Copy"
        currentCount={user?.adCopyGeneratedCount || 0}
        limit={user?.role === "superuser" ? Infinity : (user?.subscriptionTier === "agency" ? 999 : user?.subscriptionTier === "pro" ? 100 : 0)}
        resetDate={undefined}
        isLoading={generateMutation.isPending}
      />

      {/* Publish to Meta Dialog */}
      <PublishToMetaDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        headline={selectedHeadline}
        body={selectedBody}
        linkUrl=""
      />
      </div>
    </div>
  );
}
