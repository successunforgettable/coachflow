import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Calendar, BarChart3 } from "lucide-react";
// Toast functionality will be added later

export default function CampaignList() {
  const [searchQuery, setSearchQuery] = useState("");
  // const { toast } = useToast();

  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      // toast({ title: "Campaign deleted successfully" });
      utils.campaigns.list.invalidate();
    },
  });
  const duplicateMutation = trpc.campaigns.duplicate.useMutation({
    onSuccess: () => {
      // toast({ title: "Campaign duplicated successfully" });
      utils.campaigns.list.invalidate();
    },
  });

  const utils = trpc.useUtils();

  const filteredCampaigns = campaigns?.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "draft":
        return "bg-gray-500";
      case "paused":
        return "bg-yellow-500";
      case "completed":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getCampaignTypeLabel = (type: string | null) => {
    if (!type) return "General";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Build and manage your marketing campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Campaign Grid */}
      {filteredCampaigns && filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {campaign.campaignType ? getCampaignTypeLabel(campaign.campaignType) : 'General Campaign'}
                  </p>
                </div>
                <Badge className={getStatusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {getCampaignTypeLabel(campaign.campaignType)}
                </div>
                {campaign.startDate && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(campaign.startDate).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                  <Button variant="default" className="w-full">
                    Open Builder
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => duplicateMutation.mutate({ id: campaign.id })}
                  disabled={duplicateMutation.isPending}
                >
                  {duplicateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>📋</span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (confirm("Delete this campaign?")) {
                      deleteMutation.mutate({ id: campaign.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>🗑️</span>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first campaign to start building your marketing workflow
            </p>
            <Link href="/campaigns/new">
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
