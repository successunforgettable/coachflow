import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = {
  trial: "#94a3b8", // slate-400
  pro: "#8b5cf6", // violet-500
  agency: "#10b981", // emerald-500
};

export function RevenueByTierChart() {
  const { data: revenueByTier, isLoading } = trpc.admin.getRevenueByTier.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!revenueByTier) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "Trial", value: revenueByTier.trial.revenue, count: revenueByTier.trial.count },
    { name: "Pro", value: revenueByTier.pro.revenue, count: revenueByTier.pro.count },
    { name: "Agency", value: revenueByTier.agency.revenue, count: revenueByTier.agency.count },
  ].filter((item) => item.value > 0); // Only show tiers with revenue

  const totalRevenue =
    revenueByTier.trial.revenue + revenueByTier.pro.revenue + revenueByTier.agency.revenue;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Tier</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            No revenue data available. All users are on trial tier.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `$${value.toLocaleString()} (${props.payload.count} users)`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total MRR:</span>
                <span className="text-sm font-bold">${totalRevenue.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Trial</div>
                  <div className="text-sm font-medium">{revenueByTier.trial.count} users</div>
                  <div className="text-xs text-muted-foreground">${revenueByTier.trial.revenue}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Pro</div>
                  <div className="text-sm font-medium">{revenueByTier.pro.count} users</div>
                  <div className="text-xs text-muted-foreground">${revenueByTier.pro.revenue}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Agency</div>
                  <div className="text-sm font-medium">{revenueByTier.agency.count} users</div>
                  <div className="text-xs text-muted-foreground">${revenueByTier.agency.revenue}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
