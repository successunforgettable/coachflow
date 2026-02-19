import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, AlertCircle, Database } from "lucide-react";

export function SystemHealthCard() {
  const { data: systemHealth } = trpc.admin.getSystemHealth.useQuery();
  const { data: webhookStatus } = trpc.admin.getWebhookStatus.useQuery();
  const { data: storageUsage } = trpc.admin.getStorageUsage.useQuery();

  const getHealthStatus = () => {
    if (!systemHealth) return { color: "gray", label: "Loading", icon: Activity };
    
    const errorRate = parseFloat(systemHealth.apiErrorRate) || 0;
    const llmSuccessRate = parseFloat(systemHealth.llmSuccessRate) || 100;

    if (errorRate > 10 || llmSuccessRate < 80) {
      return { color: "red", label: "Critical", icon: XCircle };
    } else if (errorRate > 5 || llmSuccessRate < 90) {
      return { color: "yellow", label: "Warning", icon: AlertCircle };
    } else {
      return { color: "green", label: "Healthy", icon: CheckCircle2 };
    }
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <CardTitle>System Health</CardTitle>
        </div>
        <CardDescription>
          Monitor API errors, LLM success rates, and system status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Health Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <HealthIcon
              className={`h-8 w-8 ${
                healthStatus.color === "green"
                  ? "text-green-500"
                  : healthStatus.color === "yellow"
                  ? "text-yellow-500"
                  : healthStatus.color === "red"
                  ? "text-red-500"
                  : "text-gray-500"
              }`}
            />
            <div>
              <div className="font-semibold">Overall Status</div>
              <div className="text-sm text-muted-foreground">System health indicator</div>
            </div>
          </div>
          <Badge
            variant={
              healthStatus.color === "green"
                ? "default"
                : healthStatus.color === "yellow"
                ? "secondary"
                : "destructive"
            }
          >
            {healthStatus.label}
          </Badge>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* API Error Rate */}
          <div className="p-4 rounded-lg border space-y-2">
            <div className="text-sm font-medium text-muted-foreground">API Error Rate</div>
            <div className="text-2xl font-bold">
              {systemHealth?.apiErrorRate || "0.00"}%
            </div>
            <div className="text-xs text-muted-foreground">Last 24 hours</div>
          </div>

          {/* LLM Success Rate */}
          <div className="p-4 rounded-lg border space-y-2">
            <div className="text-sm font-medium text-muted-foreground">LLM Success Rate</div>
            <div className="text-2xl font-bold">
              {systemHealth?.llmSuccessRate || "100.00"}%
            </div>
            <div className="text-xs text-muted-foreground">Last 24 hours</div>
          </div>

          {/* Webhook Status */}
          <div className="p-4 rounded-lg border space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Stripe Webhooks</div>
            <div className="flex items-center gap-2">
              {webhookStatus?.configured ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold">Configured</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-lg font-semibold">Not Configured</span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {webhookStatus?.endpoints?.length || 0} endpoints
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="p-4 rounded-lg border space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-medium">S3 Storage Usage</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Storage</span>
              <span className="font-medium">
                {storageUsage?.totalGB || "0.00"} GB
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated Cost</span>
              <span className="font-medium">
                {storageUsage?.estimatedCost || "$0.00"}/month
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Files</span>
              <span className="font-medium">N/A</span>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        {systemHealth && systemHealth.metrics && systemHealth.metrics.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <div>Recent metrics logged: {systemHealth.metrics.length}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
