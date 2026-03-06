import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ChevronLeft, ChevronRight, Search } from "lucide-react";

const ACTION_TYPES = [
  "overrideUserTier", "resetUserQuota", "cancelSubscription", "refundPayment",
  "addUserNote", "grantBonusQuota", "bulkResetQuota", "bulkChangeTier",
  "createSuperUser", "revokeSuperUser", "flagContent", "resolveFlaggedContent",
  "deleteUserContent",
];

const ACTION_COLORS: Record<string, string> = {
  overrideUserTier: "bg-blue-100 text-blue-700",
  resetUserQuota: "bg-yellow-100 text-yellow-700",
  cancelSubscription: "bg-red-100 text-red-700",
  refundPayment: "bg-orange-100 text-orange-700",
  addUserNote: "bg-gray-100 text-gray-700",
  grantBonusQuota: "bg-green-100 text-green-700",
  bulkResetQuota: "bg-yellow-100 text-yellow-700",
  bulkChangeTier: "bg-blue-100 text-blue-700",
  createSuperUser: "bg-purple-100 text-purple-700",
  revokeSuperUser: "bg-red-100 text-red-700",
  flagContent: "bg-orange-100 text-orange-700",
  resolveFlaggedContent: "bg-green-100 text-green-700",
  deleteUserContent: "bg-red-100 text-red-700",
};

export default function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = trpc.admin.getAuditLog.useQuery({
    page,
    limit: 50,
    actionType: actionFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const logs: any[] = (data?.logs as any[]) || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Audit Log
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          All admin actions are logged here. {data?.total ? `${data.total} total entries.` : ""}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter by action…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All actions</SelectItem>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">From</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">To</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            {(actionFilter || startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setActionFilter(""); setStartDate(""); setEndDate(""); setPage(1); }}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${logs.length} entries (page ${page} of ${data?.totalPages || 1})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No audit log entries found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((entry: any) => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs font-mono ${ACTION_COLORS[entry.action_type] || "bg-gray-100 text-gray-700"}`}>
                        {entry.action_type}
                      </Badge>
                      <span className="text-sm">
                        by <span className="font-medium">{entry.admin_name || "Admin"}</span>
                        {entry.admin_email && <span className="text-muted-foreground"> ({entry.admin_email})</span>}
                      </span>
                      {entry.target_user_name && (
                        <span className="text-sm text-muted-foreground">
                          → <span className="font-medium text-foreground">{entry.target_user_name}</span>
                          {entry.target_user_email && ` (${entry.target_user_email})`}
                        </span>
                      )}
                    </div>
                    {entry.details && entry.details !== "{}" && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded mt-1.5 truncate">
                        {typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      IP: {entry.ip_address || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
