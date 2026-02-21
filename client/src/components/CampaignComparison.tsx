import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

interface CampaignComparisonProps {
  campaignIds: string[];
  onClose: () => void;
}

export function CampaignComparison({ campaignIds, onClose }: CampaignComparisonProps) {
  const [dateRange, setDateRange] = useState<string>("30"); // Default: Last 30 days

  // Calculate date range based on selection
  const getDateRange = () => {
    if (dateRange === "all") return undefined;
    
    const until = new Date().toISOString().split('T')[0]; // Today
    const since = new Date();
    since.setDate(since.getDate() - parseInt(dateRange));
    
    return {
      since: since.toISOString().split('T')[0],
      until,
    };
  };

  // Fetch campaigns with date range
  const { data: allCampaigns, isLoading } = trpc.meta.getCampaigns.useQuery(
    { includeInsights: true, dateRange: getDateRange() },
    { refetchOnWindowFocus: false }
  );

  // Filter to only selected campaigns
  const campaigns = allCampaigns?.filter((c) => campaignIds.includes(c.id)) || [];

  // Prepare data for comparison charts
  const comparisonData = campaigns.map((campaign) => ({
    name: campaign.name.length > 15 ? campaign.name.substring(0, 15) + "..." : campaign.name,
    fullName: campaign.name,
    impressions: campaign.insights?.impressions || 0,
    clicks: campaign.insights?.clicks || 0,
    spend: campaign.insights?.spend || 0,
    ctr: campaign.insights?.ctr || 0,
    cpc: campaign.insights?.cpc || 0,
    reach: campaign.insights?.reach || 0,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign Comparison</h2>
          <p className="text-muted-foreground">Comparing {campaigns.length} campaigns side-by-side</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Side-by-side comparison of key metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Campaign</th>
                  <th className="text-right py-3 px-4 font-semibold">Status</th>
                  <th className="text-right py-3 px-4 font-semibold">Impressions</th>
                  <th className="text-right py-3 px-4 font-semibold">Clicks</th>
                  <th className="text-right py-3 px-4 font-semibold">CTR</th>
                  <th className="text-right py-3 px-4 font-semibold">Spend</th>
                  <th className="text-right py-3 px-4 font-semibold">CPC</th>
                  <th className="text-right py-3 px-4 font-semibold">Reach</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b last:border-0">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.objective}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          campaign.status === "ACTIVE"
                            ? "bg-green-500/20 text-green-500"
                            : campaign.status === "PAUSED"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-gray-500/20 text-gray-500"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">{campaign.insights?.impressions.toLocaleString() || "-"}</td>
                    <td className="text-right py-3 px-4">{campaign.insights?.clicks.toLocaleString() || "-"}</td>
                    <td className="text-right py-3 px-4">{campaign.insights ? `${campaign.insights.ctr.toFixed(2)}%` : "-"}</td>
                    <td className="text-right py-3 px-4">{campaign.insights ? `$${campaign.insights.spend.toFixed(2)}` : "-"}</td>
                    <td className="text-right py-3 px-4">{campaign.insights ? `$${campaign.insights.cpc.toFixed(2)}` : "-"}</td>
                    <td className="text-right py-3 px-4">{campaign.insights?.reach.toLocaleString() || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Impressions vs Clicks */}
        <Card>
          <CardHeader>
            <CardTitle>Impressions vs Clicks</CardTitle>
            <CardDescription>Reach and engagement comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => {
                    const item = comparisonData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Legend />
                <Bar dataKey="impressions" fill="#8B5CF6" name="Impressions" />
                <Bar dataKey="clicks" fill="#10B981" name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CTR Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Click-Through Rate (CTR)</CardTitle>
            <CardDescription>Efficiency comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => {
                    const item = comparisonData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <Legend />
                <Bar dataKey="ctr" fill="#F59E0B" name="CTR %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Spend Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Ad Spend</CardTitle>
            <CardDescription>Budget allocation comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => {
                    const item = comparisonData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="spend" fill="#EF4444" name="Spend ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CPC Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Per Click (CPC)</CardTitle>
            <CardDescription>Cost efficiency comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(label) => {
                    const item = comparisonData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="cpc" fill="#3B82F6" name="CPC ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
