import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, MousePointerClick, DollarSign, Eye, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function MetaCampaigns() {
  const { user } = useAuth();
  const { data: connection, isLoading: connectionLoading } = trpc.meta.getConnectionStatus.useQuery();
  const { data: campaigns, isLoading: campaignsLoading, refetch } = trpc.meta.getCampaigns.useQuery(
    { includeInsights: true, limit: 50 },
    { enabled: !!connection?.connected }
  );
  const { data: adAccount } = trpc.meta.getAdAccount.useQuery(undefined, { enabled: !!connection?.connected });

  const updateStatusMutation = trpc.meta.updateCampaignStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign ${data.status === "ACTIVE" ? "activated" : "paused"}`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update campaign status");
    },
  });

  const deleteMutation = trpc.meta.deleteCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete campaign");
    },
  });

  const handleToggleStatus = (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    updateStatusMutation.mutate({ campaignId, status: newStatus as "ACTIVE" | "PAUSED" });
  };

  const handleDelete = (campaignId: string, campaignName: string) => {
    if (confirm(`Delete campaign "${campaignName}"? This action cannot be undone.`)) {
      deleteMutation.mutate({ campaignId });
    }
  };

  if (connectionLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!connection?.connected) {
    return (
      <div className="container py-8">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Meta Ads Manager</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Meta Ads Manager account to view campaign performance and publish ads directly from CoachFlow.
          </p>
          <Link href="/settings/integrations">
            <Button>Go to Integrations</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Meta Campaigns</h1>
          <p className="text-muted-foreground">View and manage your Meta advertising campaigns</p>
        </div>
        <Button variant="outline" asChild>
          <a href="https://business.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Ads Manager
          </a>
        </Button>
      </div>

      {adAccount && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{adAccount.name}</h3>
              <p className="text-sm text-muted-foreground">Ad Account ID: {adAccount.id}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">${adAccount.balance.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{adAccount.currency} Balance</p>
            </div>
          </div>
        </Card>
      )}

      {campaignsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {campaign.objective} • Created {new Date(campaign.createdTime).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={
                    campaign.status === "ACTIVE"
                      ? "default"
                      : campaign.status === "PAUSED"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {campaign.status}
                </Badge>
              </div>

              {campaign.insights ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Impressions</p>
                      <p className="font-semibold">{campaign.insights.impressions.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Clicks</p>
                      <p className="font-semibold">{campaign.insights.clicks.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">CTR</p>
                      <p className="font-semibold">{campaign.insights.ctr.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Spend</p>
                      <p className="font-semibold">${campaign.insights.spend.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">CPC</p>
                      <p className="font-semibold">${campaign.insights.cpc.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No insights available yet</p>
              )}

              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {campaign.dailyBudget && `Daily Budget: $${campaign.dailyBudget.toFixed(2)}`}
                  {campaign.lifetimeBudget && `Lifetime Budget: $${campaign.lifetimeBudget.toFixed(2)}`}
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status !== "DELETED" && campaign.status !== "ARCHIVED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                        disabled={updateStatusMutation.isPending}
                      >
                        {campaign.status === "ACTIVE" ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(campaign.id, campaign.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No campaigns found in your Meta Ads Manager account.</p>
        </Card>
      )}
    </div>
  );
}
