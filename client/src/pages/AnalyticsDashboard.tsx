import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, TrendingDown, DollarSign, Users, Mail, MousePointerClick } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });

  // Fetch overall metrics
  const { data: metrics, isLoading } = trpc.analytics.getOverallMetrics.useQuery({
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
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

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your campaign performance and ROI
          </p>
        </div>

        {/* Date Range Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from && dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">From</label>
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                  initialFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {metrics?.totalCampaigns || 0} campaigns
            </p>
          </CardContent>
        </Card>

        {/* Total Conversions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalConversions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercentage(metrics?.avgConversionRate || 0)} conversion rate
            </p>
          </CardContent>
        </Card>

        {/* Email Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Performance</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEmailOpens || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.totalEmailClicks || 0} clicks
            </p>
          </CardContent>
        </Card>

        {/* ROI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            {(metrics?.totalROI || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              (metrics?.totalROI || 0) >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatPercentage(metrics?.totalROI || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on investment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {/* Revenue Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Chart will display when campaign data is available
            </div>
          </CardContent>
        </Card>

        {/* Conversion Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Email opens → clicks → conversions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Chart will display when campaign data is available
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Detailed metrics for each campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.totalCampaigns === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No campaigns found for the selected date range.</p>
              <p className="text-sm mt-2">Create a campaign to start tracking analytics.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Campaign-specific analytics coming soon
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
