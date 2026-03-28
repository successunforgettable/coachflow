import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Webhook, HardDrive, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

function StatusBadge({ value, good, warn }: { value: number; good: number; warn: number }) {
  if (value >= good) return <Badge className="bg-green-100 text-green-700">Healthy</Badge>;
  if (value >= warn) return <Badge className="bg-yellow-100 text-yellow-700">Degraded</Badge>;
  return <Badge className="bg-red-100 text-red-700">Critical</Badge>;
}

export default function AdminSystemHealth() {
  const { data: health, isLoading: healthLoading } = trpc.admin.getSystemHealth.useQuery();
  const { data: webhooks, isLoading: webhookLoading } = trpc.admin.getWebhookStatus.useQuery();
  const { data: storage, isLoading: storageLoading } = trpc.admin.getStorageUsage.useQuery();

  const apiErrorRate = parseFloat((health as any)?.apiErrorRate || "0");
  const llmSuccessRate = parseFloat((health as any)?.llmSuccessRate || "100");
  const metrics: any[] = (health as any)?.metrics || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" /> System Health
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live infrastructure metrics for the last 24 hours.
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">API Error Rate</p>
            {healthLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{apiErrorRate.toFixed(1)}%</p>
                <StatusBadge value={100 - apiErrorRate} good={99} warn={95} />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">LLM Success Rate</p>
            {healthLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{llmSuccessRate.toFixed(1)}%</p>
                <StatusBadge value={llmSuccessRate} good={99} warn={95} />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Stripe Webhooks</p>
            {webhookLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{(webhooks as any)?.endpoints?.length || 0}</p>
                {(webhooks as any)?.configured ? (
                  <Badge className="bg-green-100 text-green-700">Configured</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700">Not Configured</Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Storage Used</p>
            {storageLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{(storage as any)?.totalGB || "0"} GB</p>
                <p className="text-xs text-muted-foreground">{(storage as any)?.estimatedCost || "$0.00"} / mo</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stripe Webhook Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Stripe Webhook Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          {webhookLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : !(webhooks as any)?.configured ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4 text-red-500" />
              No webhook endpoints configured. Go to Stripe Dashboard → Developers → Webhooks.
            </div>
          ) : (
            <div className="space-y-3">
              {((webhooks as any)?.endpoints || []).map((ep: any) => (
                <div key={ep.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  {ep.status === "enabled" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{ep.url}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ep.enabledEvents?.length} events · ID: {ep.id}
                    </p>
                  </div>
                  <Badge className={ep.status === "enabled" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                    {ep.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent metrics log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Recent Metric Snapshots (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">System health monitoring is initializing. Data will appear within 24 hours.</p>
              <p className="text-xs mt-1">Metrics are collected by background jobs and will populate automatically once the health tracking job completes its first cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-right py-2 pr-4">API OK</th>
                    <th className="text-right py-2 pr-4">API Errors</th>
                    <th className="text-right py-2 pr-4">LLM OK</th>
                    <th className="text-right py-2">LLM Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slice(0, 20).map((m: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(m.metric_date).toLocaleString()}</td>
                      <td className="text-right py-2 pr-4 text-green-600">{m.api_success_count || 0}</td>
                      <td className="text-right py-2 pr-4 text-red-600">{m.api_error_count || 0}</td>
                      <td className="text-right py-2 pr-4 text-green-600">{m.llm_success_count || 0}</td>
                      <td className="text-right py-2 text-red-600">{m.llm_error_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" /> Storage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded" />
          ) : (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Used</p>
                <p className="font-semibold text-lg">{(storage as any)?.totalGB || "0"} GB</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Bytes</p>
                <p className="font-semibold text-lg">{((storage as any)?.totalBytes || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Est. Monthly Cost</p>
                <p className="font-semibold text-lg">{(storage as any)?.estimatedCost || "$0.00"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
