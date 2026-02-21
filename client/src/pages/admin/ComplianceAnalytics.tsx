import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, AlertTriangle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function ComplianceAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [days, setDays] = useState(30);

  // Check admin access
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // Queries
  const { data: analytics, isLoading: analyticsLoading } = trpc.compliance.getUsageAnalytics.useQuery({ limit: 20, days });
  const { data: timeline, isLoading: timelineLoading } = trpc.compliance.getUsageTimeline.useQuery({ days });

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Compliance Analytics</h1>
              <p className="text-gray-400">
                Track which banned phrases are most frequently detected
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                <SelectTrigger className="w-[180px] bg-[#14141F] border-[#27273A] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#14141F] border-[#27273A]">
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#14141F] border-[#27273A]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Total Detections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#8B5CF6]">
                {analyticsLoading ? "..." : analytics?.totalDetections || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">in last {days} days</p>
            </CardContent>
          </Card>

          <Card className="bg-[#14141F] border-[#27273A]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Unique Phrases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#8B5CF6]">
                {analyticsLoading ? "..." : analytics?.topPhrases?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">detected at least once</p>
            </CardContent>
          </Card>

          <Card className="bg-[#14141F] border-[#27273A]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Generator Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#8B5CF6]">
                {analyticsLoading ? "..." : analytics?.byGenerator?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">active generators</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Detected Phrases */}
        <Card className="bg-[#14141F] border-[#27273A] mb-8">
          <CardHeader>
            <CardTitle>Most Frequently Detected Phrases</CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Phrases that users are triggering most often during content generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="text-center py-8 text-gray-400">Loading analytics...</div>
            ) : !analytics?.topPhrases || analytics.topPhrases.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No data available for this period</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#27273A] hover:bg-[#16161F]">
                    <TableHead className="text-gray-400">Rank</TableHead>
                    <TableHead className="text-gray-400">Phrase</TableHead>
                    <TableHead className="text-gray-400">Category</TableHead>
                    <TableHead className="text-gray-400 text-right">Detections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topPhrases.map((item, index) => (
                    <TableRow key={index} className="border-[#27273A] hover:bg-[#16161F]">
                      <TableCell className="font-medium text-gray-300">#{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{item.phrase}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.category === "critical" ? "destructive" : "default"}
                          className={
                            item.category === "critical"
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }
                        >
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Usage by Generator Type */}
        <Card className="bg-[#14141F] border-[#27273A]">
          <CardHeader>
            <CardTitle>Detections by Generator Type</CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Which content generators are catching the most compliance issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="text-center py-8 text-gray-400">Loading analytics...</div>
            ) : !analytics?.byGenerator || analytics.byGenerator.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No data available for this period</div>
            ) : (
              <div className="space-y-4">
                {analytics.byGenerator.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-32 font-medium text-gray-300 capitalize">
                        {item.generatorType}
                      </div>
                      <div className="flex-1 bg-[#0A0A0F] rounded-full h-2 w-64">
                        <div
                          className="bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] h-2 rounded-full transition-all"
                          style={{
                            width: `${(item.count / (analytics.totalDetections || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{item.count}</div>
                      <div className="text-xs text-gray-500">
                        {((item.count / (analytics.totalDetections || 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
