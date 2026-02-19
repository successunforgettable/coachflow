import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignAnalyticsProps {
  campaignId: number;
  startDate: string;
  endDate: string;
}

export default function CampaignAnalytics({ campaignId, startDate, endDate }: CampaignAnalyticsProps) {
  // Fetch campaign ROI
  const { data: roi } = trpc.analytics.calculateROI.useQuery({
    campaignId,
    startDate,
    endDate,
  });

  // Fetch asset performance
  const { data: assetPerformance } = trpc.analytics.getAssetPerformance.useQuery({
    campaignId,
    startDate,
    endDate,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getAssetTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      headline: "bg-blue-500",
      hvco: "bg-purple-500",
      hero_mechanism: "bg-green-500",
      icp: "bg-yellow-500",
      ad_copy: "bg-red-500",
      email: "bg-indigo-500",
      whatsapp: "bg-pink-500",
      landing_page: "bg-orange-500",
      offer: "bg-teal-500",
    };

    return (
      <Badge className={cn("text-white", colors[type] || "bg-gray-500")}>
        {type.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* ROI Card */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign ROI</CardTitle>
          <CardDescription>Return on investment for this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Revenue</div>
              <div className="text-2xl font-bold">{formatCurrency(roi?.revenue || 0)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Spend</div>
              <div className="text-2xl font-bold">{formatCurrency(roi?.spend || 0)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">ROI</div>
              <div className={cn(
                "text-2xl font-bold flex items-center gap-2",
                (roi?.roi || 0) >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {(roi?.roi || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {formatPercentage(roi?.roi || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Performance</CardTitle>
          <CardDescription>Performance metrics for each asset in this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {!assetPerformance || assetPerformance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No asset performance data available yet.</p>
              <p className="text-sm mt-2">Add assets to your campaign and track events to see performance metrics.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Asset ID</TableHead>
                  <TableHead className="text-right">Email Opens</TableHead>
                  <TableHead className="text-right">Email Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetPerformance.map((asset, index) => (
                  <TableRow key={index}>
                    <TableCell>{getAssetTypeBadge(asset.assetType || "unknown")}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.assetId?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-right">{asset.emailOpens}</TableCell>
                    <TableCell className="text-right">{asset.emailClicks}</TableCell>
                    <TableCell className="text-right">{asset.conversions}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(asset.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ROI Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>ROI Calculator</CardTitle>
          <CardDescription>Calculate potential return on investment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            ROI calculator coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
