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
import { Shield, Users, TrendingUp, Search, RefreshCw, Edit } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [newTier, setNewTier] = useState<"trial" | "pro" | "agency">("trial");

  // Check if user is admin
  if (!authLoading && user?.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  // Queries
  const { data: allUsers, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();
  const { data: analytics } = trpc.admin.getAnalytics.useQuery();

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
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage users and quota limits</p>
          </div>
        </div>

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
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "N/A"}</TableCell>
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
                              setShowResetDialog(true);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Reset Quota
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
