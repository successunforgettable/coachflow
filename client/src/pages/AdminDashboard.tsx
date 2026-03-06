import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, Users, TrendingUp, Search, RefreshCw, Edit, Download, CheckSquare, Square, UserCog, Link as LinkIcon, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { FinancialMetricsCard } from "@/components/admin/FinancialMetricsCard";
import { RevenueByTierChart } from "@/components/admin/RevenueByTierChart";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { FailedPaymentsAlert } from "@/components/admin/FailedPaymentsAlert";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [newTier, setNewTier] = useState<"trial" | "pro" | "agency">("trial");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [showBulkTierDialog, setShowBulkTierDialog] = useState(false);
  const [bulkNewTier, setBulkNewTier] = useState<"trial" | "pro" | "agency">("trial");
  const [showSuperuserDialog, setShowSuperuserDialog] = useState(false);
  const [superuserTarget, setSuperuserTarget] = useState<any>(null);
  const [superuserAction, setSuperuserAction] = useState<"grant" | "revoke">("grant");

  // Check if user is admin
  if (!authLoading && user?.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  // Queries
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();
  const { data: analytics } = trpc.admin.getAnalytics.useQuery();
  const { data: activityMetrics } = trpc.admin.getUserActivityMetrics.useQuery();
  const { data: churnRiskUsers } = trpc.admin.getChurnRiskUsers.useQuery();

  // Mutations
  const resetQuotaMutation = trpc.admin.resetUserQuota.useMutation({
    onSuccess: () => {
      toast.success("User quota reset successfully");
      refetchUsers();
      setShowResetDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const overrideTierMutation = trpc.admin.overrideUserTier.useMutation({
    onSuccess: () => {
      toast.success("User tier updated successfully");
      refetchUsers();
      setShowTierDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Filter users
  const bulkResetMutation = trpc.admin.bulkResetQuota.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Quota reset for ${data.count} users`);
      setSelectedUserIds([]);
      refetchUsers();
    },
    onError: () => toast.error("Bulk reset failed"),
  });

  const bulkTierMutation = trpc.admin.bulkChangeTier.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Tier updated for ${data.count} users`);
      setSelectedUserIds([]);
      setShowBulkTierDialog(false);
      refetchUsers();
    },
    onError: () => toast.error("Bulk tier change failed"),
  });

  const createSuperUserMutation = trpc.admin.createSuperUser.useMutation({
    onSuccess: () => {
      toast.success("Superuser role granted");
      setShowSuperuserDialog(false);
      refetchUsers();
    },
    onError: () => toast.error("Failed to grant superuser"),
  });

  const revokeSuperUserMutation = trpc.admin.revokeSuperUser.useMutation({
    onSuccess: () => {
      toast.success("Superuser role revoked");
      setShowSuperuserDialog(false);
      refetchUsers();
    },
    onError: () => toast.error("Failed to revoke superuser"),
  });

  const { data: superUsers } = trpc.admin.listSuperUsers.useQuery();

  const exportCSV = () => {
    const users = filteredUsers || [];
    const headers = ["ID", "Name", "Email", "Tier", "Status", "Role", "Joined", "Last Sign-In", "Total Generations"];
    const rows = users.map((u: any) => {
      const total = (u.headlineGeneratedCount || 0) + (u.hvcoGeneratedCount || 0) +
        (u.heroMechanismGeneratedCount || 0) + (u.icpGeneratedCount || 0) +
        (u.adCopyGeneratedCount || 0) + (u.emailSeqGeneratedCount || 0) +
        (u.whatsappSeqGeneratedCount || 0) + (u.landingPageGeneratedCount || 0) +
        (u.offerGeneratedCount || 0);
      return [u.id, u.name || "", u.email || "", u.subscriptionTier || "trial",
        u.subscriptionStatus || "", u.role || "user",
        new Date(u.createdAt).toLocaleDateString(),
        u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : "",
        total];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${users.length} users to CSV`);
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === (filteredUsers?.length || 0)) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds((filteredUsers || []).map((u: any) => u.id));
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredUsers = allUsers?.filter((u: any) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "all" || u.subscriptionTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const getTierBadgeColor = (tier: string | null) => {
    switch (tier) {
      case "trial":
        return "bg-gray-500";
      case "pro":
        return "bg-blue-500";
      case "agency":
        return "bg-purple-500";
      default:
        return "bg-gray-400";
    }
  };

  const handleResetQuota = () => {
    if (selectedUser) {
      resetQuotaMutation.mutate({ userId: selectedUser.id });
    }
  };

  const handleOverrideTier = () => {
    if (selectedUser) {
      overrideTierMutation.mutate({ userId: selectedUser.id, newTier });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-8 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage users and quota limits</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin/audit-log")}>
              Audit Log
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin/content-moderation")}>
              Content Moderation
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin/system-health")}>
              System Health
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin/compliance")}>
              Compliance
            </Button>
          </div>
        </div>

        {/* Phase 1: Financial Metrics */}
        <div className="mb-8">
          <FinancialMetricsCard />
        </div>

        {/* Phase 1: Failed Payments Alert */}
        <div className="mb-8">
          <FailedPaymentsAlert />
        </div>

        {/* Phase 1: Revenue Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RevenueChart />
          <RevenueByTierChart />
        </div>

        {/* Phase 4: User Activity Metrics */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>Active users over different time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Last 7 Days</p>
                <p className="text-2xl font-bold">{activityMetrics?.activeUsers7d || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last 30 Days</p>
                <p className="text-2xl font-bold">{activityMetrics?.activeUsers30d || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last 90 Days</p>
                <p className="text-2xl font-bold">{activityMetrics?.activeUsers90d || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 4: Churn Risk Alert */}
        {churnRiskUsers && (churnRiskUsers.inactiveUsers.length > 0 || churnRiskUsers.quotaLimitUsers.length > 0) && (
          <Card className="mb-8 border-red-500">
            <CardHeader>
              <CardTitle className="text-red-500">⚠️ Churn Risk Alert</CardTitle>
              <CardDescription>
                {churnRiskUsers.inactiveUsers.length} inactive users (14+ days) | {churnRiskUsers.quotaLimitUsers.length} users hit quota limit
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{allUsers?.length || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Trial Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-500">
                {analytics?.usersByTier.trial || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pro Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-500">
                {analytics?.usersByTier.pro || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Agency Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-500">
                {analytics?.usersByTier.agency || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Card */}
        {analytics && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Most Popular Generators
              </CardTitle>
              <CardDescription>Total generations across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analytics.popularGenerators)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 9)
                  .map(([generator, count]) => (
                    <div key={generator} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                      <span className="text-sm font-medium capitalize">
                        {generator.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="text-lg font-bold text-primary">{count as number}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all user accounts and quotas</CardDescription>

            {/* Bulk actions bar */}
            {selectedUserIds.length > 0 && (
              <div className="flex items-center gap-3 mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-sm font-medium">{selectedUserIds.length} selected</span>
                <Button size="sm" variant="outline" onClick={() => bulkResetMutation.mutate({ userIds: selectedUserIds })} disabled={bulkResetMutation.isPending}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset Quota
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowBulkTierDialog(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Change Tier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds([])} className="ml-auto text-muted-foreground">
                  Clear selection
                </Button>
              </div>
            )}
            {/* Search and Filter */}
            <div className="flex gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="shrink-0">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                      {selectedUserIds.length > 0 && selectedUserIds.length === (filteredUsers?.length ?? 0) && (filteredUsers?.length ?? 0) > 0
                        ? <CheckSquare className="h-4 w-4" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Quota Usage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((u: any) => {
                  const totalGenerated =
                    u.headlineGeneratedCount +
                    u.hvcoGeneratedCount +
                    u.heroMechanismGeneratedCount +
                    u.icpGeneratedCount +
                    u.adCopyGeneratedCount +
                    u.emailSeqGeneratedCount +
                    u.whatsappSeqGeneratedCount +
                    u.landingPageGeneratedCount +
                    u.offerGeneratedCount;

                  return (
                    <TableRow key={u.id} className={selectedUserIds.includes(u.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                          <button onClick={() => toggleSelectUser(u.id)} className="text-muted-foreground hover:text-foreground">
                            {selectedUserIds.includes(u.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <button className="hover:underline text-left" onClick={() => setLocation(`/admin/users/${u.id}`)}>
                            {u.name || "N/A"}
                          </button>
                        </TableCell>
                      <TableCell>{u.email || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={getTierBadgeColor(u.subscriptionTier)}>
                          {u.subscriptionTier || "trial"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {totalGenerated} total generations
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setNewTier(u.subscriptionTier as any || "trial");
                              setShowTierDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Change Tier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/admin/users/${u.id}`)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setNewTier(u.subscriptionTier as any || "trial");
                              setShowTierDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Change Tier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredUsers?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your search criteria.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Superuser Management Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Superuser Management
            </CardTitle>
            <CardDescription>Superusers have unlimited quota across all generators. Grant or revoke this privilege carefully.</CardDescription>
          </CardHeader>
          <CardContent>
            {!superUsers || (superUsers as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No superusers currently. Grant superuser status from the user table below.</p>
            ) : (
              <div className="space-y-2">
                {(superUsers as any[]).map((su: any) => (
                  <div key={su.id} className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{su.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{su.email} · ID #{su.id}</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700">SUPERUSER</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { setSuperuserTarget(su); setSuperuserAction("revoke"); setShowSuperuserDialog(true); }}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">To grant superuser, click the user row in the table below and use the Change Tier action, or use the View Details page.</p>
          </CardContent>
        </Card>

        {/* Bulk Tier Change Dialog */}
        <Dialog open={showBulkTierDialog} onOpenChange={setShowBulkTierDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Change Tier</DialogTitle>
              <DialogDescription>Change tier for {selectedUserIds.length} selected users.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">New Tier</label>
              <Select value={bulkNewTier} onValueChange={(v: any) => setBulkNewTier(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkTierDialog(false)}>Cancel</Button>
              <Button onClick={() => bulkTierMutation.mutate({ userIds: selectedUserIds, newTier: bulkNewTier })} disabled={bulkTierMutation.isPending}>
                {bulkTierMutation.isPending ? "Updating…" : "Update Tier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Superuser Management Dialog */}
        <Dialog open={showSuperuserDialog} onOpenChange={setShowSuperuserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{superuserAction === "grant" ? "Grant Superuser" : "Revoke Superuser"}</DialogTitle>
              <DialogDescription>
                {superuserAction === "grant"
                  ? `Grant superuser (unlimited quota) to ${superuserTarget?.name || superuserTarget?.email}?`
                  : `Revoke superuser from ${superuserTarget?.name || superuserTarget?.email} and downgrade to regular user?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuperuserDialog(false)}>Cancel</Button>
              <Button
                variant={superuserAction === "revoke" ? "destructive" : "default"}
                onClick={() => superuserAction === "grant"
                  ? createSuperUserMutation.mutate({ userId: superuserTarget?.id })
                  : revokeSuperUserMutation.mutate({ userId: superuserTarget?.id })}
                disabled={createSuperUserMutation.isPending || revokeSuperUserMutation.isPending}
              >
                {createSuperUserMutation.isPending || revokeSuperUserMutation.isPending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Quota Dialog */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset User Quota</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset all quota counts for{" "}
                <strong>{selectedUser?.name || selectedUser?.email}</strong>? This will set all
                generation counts to 0.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleResetQuota}
                disabled={resetQuotaMutation.isPending}
              >
                {resetQuotaMutation.isPending ? "Resetting..." : "Reset Quota"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Tier Dialog */}
        <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Tier</DialogTitle>
              <DialogDescription>
                Update the subscription tier for{" "}
                <strong>{selectedUser?.name || selectedUser?.email}</strong>. This will immediately
                change their quota limits.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">New Tier</label>
              <Select value={newTier} onValueChange={(value: any) => setNewTier(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTierDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleOverrideTier}
                disabled={overrideTierMutation.isPending}
              >
                {overrideTierMutation.isPending ? "Updating..." : "Update Tier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
