import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RevenueChart() {
  const [days, setDays] = useState(30);
  const { data: chartData, isLoading } = trpc.admin.getRevenueChart.useQuery({ days });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revenue Trend</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={days === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(30)}
            >
              30 Days
            </Button>
            <Button
              variant={days === 90 ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(90)}
            >
              90 Days
            </Button>
            <Button
              variant={days === 365 ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(365)}
            >
              1 Year
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toLocaleString()}`, "MRR"]}
              labelFormatter={(label) => {
                const date = new Date(label);
                return date.toLocaleDateString();
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="mrr"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="Monthly Recurring Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
