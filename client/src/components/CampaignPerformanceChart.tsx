import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CampaignInsight {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  reach: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  createdTime: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  insights?: CampaignInsight;
}

interface CampaignPerformanceChartProps {
  campaigns: Campaign[];
}

export function CampaignPerformanceChart({ campaigns }: CampaignPerformanceChartProps) {
  // Calculate totals
  const totals = campaigns.reduce(
    (acc, campaign) => {
      if (campaign.insights) {
        acc.impressions += campaign.insights.impressions;
        acc.clicks += campaign.insights.clicks;
        acc.spend += campaign.insights.spend;
        acc.reach += campaign.insights.reach;
      }
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0, reach: 0 }
  );

  const avgCTR = totals.clicks > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  // Prepare data for charts
  const campaignData = campaigns
    .filter((c) => c.insights)
    .map((campaign) => ({
      name: campaign.name.length > 20 ? campaign.name.substring(0, 20) + "..." : campaign.name,
      impressions: campaign.insights!.impressions,
      clicks: campaign.insights!.clicks,
      spend: campaign.insights!.spend,
      ctr: campaign.insights!.ctr,
      cpc: campaign.insights!.cpc,
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Impressions</CardDescription>
            <CardTitle className="text-3xl">{totals.impressions.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clicks</CardDescription>
            <CardTitle className="text-3xl">{totals.clicks.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spend</CardDescription>
            <CardTitle className="text-3xl">${totals.spend.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average CTR</CardDescription>
            <CardTitle className="text-3xl">{avgCTR.toFixed(2)}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts */}
      {campaignData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Impressions & Clicks Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Impressions & Clicks by Campaign</CardTitle>
              <CardDescription>Compare reach and engagement across campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="impressions" fill="#8B5CF6" name="Impressions" />
                  <Bar dataKey="clicks" fill="#10B981" name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* CTR Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Click-Through Rate (CTR)</CardTitle>
              <CardDescription>Campaign performance efficiency</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="ctr" stroke="#F59E0B" strokeWidth={2} name="CTR %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Spend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Ad Spend by Campaign</CardTitle>
              <CardDescription>Budget allocation and spending</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Bar dataKey="spend" fill="#EF4444" name="Spend ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* CPC Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Per Click (CPC)</CardTitle>
              <CardDescription>Efficiency of ad spending</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cpc" stroke="#3B82F6" strokeWidth={2} name="CPC ($)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No campaign data available yet. Campaigns need to run for a while to generate insights.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
