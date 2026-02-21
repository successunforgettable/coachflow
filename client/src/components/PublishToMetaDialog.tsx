import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

interface PublishToMetaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headline: string;
  body: string;
  linkUrl?: string;
}

export function PublishToMetaDialog({
  open,
  onOpenChange,
  headline,
  body,
  linkUrl = "",
}: PublishToMetaDialogProps) {
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<string>("OUTCOME_LEADS");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED">("PAUSED");
  const [targetUrl, setTargetUrl] = useState(linkUrl);

  const { data: connection } = trpc.meta.getConnectionStatus.useQuery();

  const publishMutation = trpc.meta.publishToMeta.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to publish to Meta");
    },
  });

  const handlePublish = () => {
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    if (!targetUrl.trim()) {
      toast.error("Please enter a target URL for your ad");
      return;
    }

    const budget = parseFloat(dailyBudget);
    if (isNaN(budget) || budget < 1) {
      toast.error("Daily budget must be at least $1");
      return;
    }

    publishMutation.mutate({
      headline: headline.substring(0, 255), // Meta limit
      body,
      linkUrl: targetUrl,
      campaignName,
      objective: objective as any,
      dailyBudget: budget,
      status,
      targeting: {
        countries: ["US"],
        ageMin: 18,
        ageMax: 65,
      },
    });
  };

  if (!connection?.connected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Connect Meta Ads Manager</DialogTitle>
            <DialogDescription>
              You need to connect your Meta Ads Manager account before publishing ads.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Meta account to publish ads directly from CoachFlow to Facebook and Instagram.
            </p>
            <Button
              onClick={() => {
                window.location.href = "/settings/integrations";
              }}
              className="w-full"
            >
              Go to Integrations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Publish to Meta Ads Manager</DialogTitle>
          <DialogDescription>
            Create a new campaign in your Meta Ads account: {connection.adAccountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name *</Label>
            <Input
              id="campaignName"
              placeholder="e.g., Lead Gen - January 2026"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          {/* Target URL */}
          <div className="space-y-2">
            <Label htmlFor="targetUrl">Landing Page URL *</Label>
            <Input
              id="targetUrl"
              type="url"
              placeholder="https://yourwebsite.com/landing-page"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where users will be directed when they click your ad
            </p>
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <Label htmlFor="objective">Campaign Objective</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger id="objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                <SelectItem value="OUTCOME_ENGAGEMENT">Engagement</SelectItem>
                <SelectItem value="OUTCOME_AWARENESS">Awareness</SelectItem>
                <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Daily Budget */}
          <div className="space-y-2">
            <Label htmlFor="dailyBudget">Daily Budget (USD) *</Label>
            <Input
              id="dailyBudget"
              type="number"
              min="1"
              step="1"
              placeholder="10"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum $1/day. Meta recommends at least $10/day for best results.
            </p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Initial Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "PAUSED")}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAUSED">Paused (Review in Meta first)</SelectItem>
                <SelectItem value="ACTIVE">Active (Start immediately)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ad Preview */}
          <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
            <p className="text-sm font-medium">Ad Preview:</p>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{headline}</p>
              <p className="text-sm text-muted-foreground line-clamp-3">{body}</p>
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {targetUrl || "yourwebsite.com"}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishMutation.isPending}>
            {publishMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish to Meta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
