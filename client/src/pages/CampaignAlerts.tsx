import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, TrendingDown, DollarSign, Eye, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function CampaignAlerts() {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [alertType, setAlertType] = useState<"ctr_drop" | "cpc_exceed" | "spend_limit" | "low_impressions">("ctr_drop");
  const [threshold, setThreshold] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");

  const { data: alerts, isLoading, refetch } = trpc.meta.getAlerts.useQuery();
  const { data: campaigns } = trpc.meta.getCampaigns.useQuery({ includeInsights: false, limit: 50 });

  const createMutation = trpc.meta.createAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert created successfully");
      setCreateDialogOpen(false);
      setThreshold("");
      setCampaignId("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create alert");
    },
  });

  const updateMutation = trpc.meta.updateAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update alert");
    },
  });

  const deleteMutation = trpc.meta.deleteAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete alert");
    },
  });

  const checkAlertsMutation = trpc.meta.checkCampaignAlerts.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to check alerts");
    },
  });

  const handleCreateAlert = () => {
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      toast.error("Please enter a valid threshold value");
      return;
    }

    createMutation.mutate({
      metaCampaignId: campaignId || undefined,
      alertType,
      threshold: thresholdNum,
    });
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "ctr_drop":
        return <TrendingDown className="w-4 h-4" />;
      case "cpc_exceed":
        return <DollarSign className="w-4 h-4" />;
      case "spend_limit":
        return <AlertTriangle className="w-4 h-4" />;
      case "low_impressions":
        return <Eye className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case "ctr_drop":
        return "CTR Drop";
      case "cpc_exceed":
        return "CPC Exceed";
      case "spend_limit":
        return "Spend Limit";
      case "low_impressions":
        return "Low Impressions";
      default:
        return type;
    }
  };

  const getThresholdUnit = (type: string) => {
    switch (type) {
      case "ctr_drop":
        return "%";
      case "cpc_exceed":
      case "spend_limit":
        return "$";
      case "low_impressions":
        return " impressions";
      default:
        return "";
    }
  };

  if (!user) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Please sign in to manage campaign alerts.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign Alerts</h1>
          <p className="text-muted-foreground mt-2">
            Monitor campaign performance and get notified when metrics exceed thresholds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => checkAlertsMutation.mutate()}
            disabled={checkAlertsMutation.isPending}
          >
            {checkAlertsMutation.isPending ? "Checking..." : "Check Now"}
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Campaign Alert</DialogTitle>
                <DialogDescription>
                  Set up a new alert to monitor campaign performance metrics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={alertType} onValueChange={(v: any) => setAlertType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ctr_drop">CTR Drop Below</SelectItem>
                      <SelectItem value="cpc_exceed">CPC Exceeds</SelectItem>
                      <SelectItem value="spend_limit">Spend Limit Exceeded</SelectItem>
                      <SelectItem value="low_impressions">Low Impressions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Threshold</Label>
                  <div className="flex items-center gap-2">
                    {(alertType === "cpc_exceed" || alertType === "spend_limit") && (
                      <span className="text-muted-foreground">$</span>
                    )}
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter threshold value"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                    {alertType === "ctr_drop" && <span className="text-muted-foreground">%</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {alertType === "ctr_drop" && "Alert when CTR drops below this percentage"}
                    {alertType === "cpc_exceed" && "Alert when CPC exceeds this dollar amount"}
                    {alertType === "spend_limit" && "Alert when total spend exceeds this amount"}
                    {alertType === "low_impressions" && "Alert when impressions drop below this number"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Campaign (Optional)</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All campaigns" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All campaigns</SelectItem>
                      {campaigns?.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to apply this alert to all campaigns
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAlert} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Alert"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const campaign = campaigns?.find((c) => c.id === alert.metaCampaignId);
            return (
              <Card key={alert.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      {getAlertIcon(alert.alertType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{getAlertLabel(alert.alertType)}</h3>
                        <Badge variant={alert.enabled ? "default" : "secondary"}>
                          {alert.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Threshold: {alert.threshold}
                        {getThresholdUnit(alert.alertType)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {campaign ? `Campaign: ${campaign.name}` : "Applies to all campaigns"}
                      </p>
                      {alert.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()} (
                          {alert.triggerCount} times)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ alertId: alert.id, enabled: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate({ alertId: alert.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Alerts Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first alert to start monitoring campaign performance
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </Card>
      )}

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">How Alerts Work</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Alerts are checked automatically when you click "Check Now" or sync campaigns</li>
          <li>• You'll receive notifications when thresholds are exceeded</li>
          <li>• Enable/disable alerts anytime using the toggle switch</li>
          <li>• Apply alerts to specific campaigns or all campaigns globally</li>
        </ul>
      </Card>
    </div>
  );
}
