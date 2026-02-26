import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Zap, CheckCircle2, AlertCircle, Circle, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CampaignCreativesDialog } from "@/components/CampaignCreativesDialog";
import { CampaignCreativesSection } from "@/components/CampaignCreativesSection";

interface GeneratorStatus {
  name: string;
  type: string;
  count: number;
  status: "complete" | "partial" | "missing" | "error";
  icon: string;
}

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const campaignId = id ? parseInt(id) : null;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreativesDialogOpen, setIsCreativesDialogOpen] = useState(false);

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Campaign not found</p>
            <Button asChild className="mt-4">
              <Link href="/campaigns">Back to Campaigns</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const generators: GeneratorStatus[] = [
    {
      name: "Ad Creatives",
      type: "ad_creatives",
      count: 0, // Will be calculated from images + videos
      status: "missing",
      icon: "🎨",
    },
    {
      name: "Headlines",
      type: "headline",
      count: campaign.assetCounts?.headline || 0,
      status: (campaign.assetCounts?.headline || 0) >= 25 ? "complete" : (campaign.assetCounts?.headline || 0) > 0 ? "partial" : "missing",
      icon: "💡",
    },
    {
      name: "HVCO Titles",
      type: "hvco",
      count: campaign.assetCounts?.hvco || 0,
      status: (campaign.assetCounts?.hvco || 0) >= 20 ? "complete" : (campaign.assetCounts?.hvco || 0) > 0 ? "partial" : "missing",
      icon: "📚",
    },
    {
      name: "Hero Mechanisms",
      type: "hero_mechanism",
      count: campaign.assetCounts?.hero_mechanism || 0,
      status: (campaign.assetCounts?.hero_mechanism || 0) >= 5 ? "complete" : (campaign.assetCounts?.hero_mechanism || 0) > 0 ? "partial" : "missing",
      icon: "⚡",
    },
    {
      name: "Ad Copy",
      type: "ad_copy",
      count: campaign.assetCounts?.ad_copy || 0,
      status: (campaign.assetCounts?.ad_copy || 0) >= 15 ? "complete" : (campaign.assetCounts?.ad_copy || 0) > 0 ? "partial" : "missing",
      icon: "📝",
    },
    {
      name: "Email Sequences",
      type: "email_sequence",
      count: campaign.assetCounts?.email_sequence || 0,
      status: (campaign.assetCounts?.email_sequence || 0) >= 3 ? "complete" : (campaign.assetCounts?.email_sequence || 0) > 0 ? "partial" : "missing",
      icon: "✉️",
    },
    {
      name: "WhatsApp Sequences",
      type: "whatsapp_sequence",
      count: campaign.assetCounts?.whatsapp_sequence || 0,
      status: (campaign.assetCounts?.whatsapp_sequence || 0) >= 2 ? "complete" : (campaign.assetCounts?.whatsapp_sequence || 0) > 0 ? "partial" : "missing",
      icon: "💬",
    },
    {
      name: "Landing Pages",
      type: "landing_page",
      count: campaign.assetCounts?.landing_page || 0,
      status: (campaign.assetCounts?.landing_page || 0) >= 1 ? "complete" : "missing",
      icon: "🌐",
    },
    {
      name: "Offers",
      type: "offer",
      count: campaign.assetCounts?.offer || 0,
      status: (campaign.assetCounts?.offer || 0) >= 1 ? "complete" : "missing",
      icon: "🎁",
    },
    {
      name: "ICP",
      type: "icp",
      count: campaign.assetCounts?.icp || 0,
      status: (campaign.assetCounts?.icp || 0) >= 1 ? "complete" : "missing",
      icon: "👤",
    },
  ];

  const totalAssets = generators.reduce((sum, gen) => sum + gen.count, 0);
  const completeGenerators = generators.filter((gen) => gen.status === "complete").length;
  const progressPercentage = (completeGenerators / generators.length) * 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "partial":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "missing":
        return <Circle className="w-5 h-5 text-muted-foreground" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Complete</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Partial</Badge>;
      case "missing":
        return <Badge variant="outline">Missing</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleGenerateAll = async () => {
    if (!campaignId) return;
    
    setIsGenerating(true);
    toast.info("Generating all missing assets... This may take a few minutes.");
    
    try {
      const result = await trpc.campaigns.generateAllMissing.useMutation().mutateAsync({ 
        campaignId 
      });
      
      if (result.success) {
        toast.info(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate assets");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCampaign = async () => {
    if (!campaignId) return;
    
    toast.info("Exporting campaign... This may take a moment.");
    
    try {
      const result = await trpc.campaigns.exportCampaign.useMutation().mutateAsync({ 
        campaignId 
      });
      
      if (result.success) {
        toast.info(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to export campaign");
    }
  };

  return (
    <div className="container py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-muted-foreground">
              {campaign.description || "Campaign Dashboard"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCampaign}>
            <Download className="w-4 h-4 mr-2" />
            Export Campaign
          </Button>
          <Button onClick={handleGenerateAll} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate All Missing
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Campaign Progress</CardTitle>
          <CardDescription>
            {completeGenerators} of {generators.length} generators complete • {totalAssets} total assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>{Math.round(progressPercentage)}% Complete</span>
            <span>{generators.length - completeGenerators} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Asset Generation Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {generators.map((generator) => (
          <Card key={generator.type} className="hover:border-primary transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{generator.icon}</span>
                  <div>
                    <CardTitle className="text-base">{generator.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {generator.count} asset{generator.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {getStatusIcon(generator.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {getStatusBadge(generator.status)}
                {generator.type === "ad_creatives" ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsCreativesDialogOpen(true)}
                  >
                    Generate →
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${generator.type.replace("_", "-")}s`}>
                      View →
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ad Creatives Dialog */}
      <CampaignCreativesDialog
        open={isCreativesDialogOpen}
        onOpenChange={setIsCreativesDialogOpen}
        campaignId={campaignId!}
        serviceId={campaign.serviceId}
        onSuccess={() => {
          // Refetch campaign to update counts
          window.location.reload();
        }}
      />

      {/* Campaign Creatives Section */}
      <div className="mt-8">
        <CampaignCreativesSection campaignId={campaignId!} />
      </div>

      {/* Service Info */}
      {campaign.service && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Linked Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{campaign.service.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {campaign.service.description}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/services/${campaign.service.id}`}>
                  Edit Service
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
