import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, DollarSign, Users, AlertCircle } from "lucide-react";

export function FinancialMetricsCard() {
  const { data: metrics, isLoading } = trpc.admin.getFinancialMetrics.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* MRR Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.mrr.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.mrrGrowth > 0 ? (
              <span className="text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +{metrics.mrrGrowth}% from last month
              </span>
            ) : metrics.mrrGrowth < 0 ? (
              <span className="text-red-600 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {metrics.mrrGrowth}% from last month
              </span>
            ) : (
              <span className="text-muted-foreground">No change from last month</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ARR Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.arr.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">MRR × 12</p>
        </CardContent>
      </Card>

      {/* Active Subscriptions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.activeSubscriptions}</div>
          <p className="text-xs text-muted-foreground">Paying customers</p>
        </CardContent>
      </Card>

      {/* Churn Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.churnRate > 5 ? "text-red-600" : "text-green-600"}`}>
            {metrics.churnRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.churnRate > 5 ? "Above healthy threshold" : "Healthy churn rate"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
