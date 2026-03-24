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
  const { data: financialMetrics } = trpc.admin.getFinancialMetrics.useQuery();
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F1EA" }}>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#999" }}>Loading...</p>
      </div>
    );
  }

  // Computed stats
  const totalUsers = allUsers?.length || 0;
  const proUsers = allUsers?.filter((u: any) => u.subscriptionTier === "pro").length || 0;
  const agencyUsers = allUsers?.filter((u: any) => u.subscriptionTier === "agency").length || 0;
  const mrr = financialMetrics?.mrr ?? (proUsers * 90 + agencyUsers * 297);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newUsersWeek = allUsers?.filter((u: any) => new Date(u.createdAt) > sevenDaysAgo).length || 0;

  const statCard = (value: string, label: string) => (
    <div style={{
      background: "#fff",
      borderRadius: 24,
      padding: "24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      flex: 1,
      minWidth: 140,
    }}>
      <p style={{
        fontFamily: "'Fraunces', serif",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: 32,
        color: "#FF5B1D",
        margin: 0,
        lineHeight: 1.1,
      }}>{value}</p>
      <p style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "#999",
        margin: "8px 0 0",
      }}>{label}</p>
    </div>
  );

  const tierBadge = (tier: string | null) => {
    const t = tier || "trial";
    const bg = t === "pro" ? "#FF5B1D" : t === "agency" ? "#8B5CF6" : "#E5E5E5";
    const color = t === "trial" ? "#666" : "#fff";
    return (
      <span style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 9999,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Instrument Sans', sans-serif",
        textTransform: "capitalize",
      }}>{t}</span>
    );
  };

  const statusDot = (status: string | null) => {
    const s = status || "trialing";
    const dotColor = s === "active" ? "#22C55E" : s === "canceled" ? "#EF4444" : s === "past_due" ? "#EAB308" : "#FF5B1D";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "'Instrument Sans', sans-serif", color: "#999" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
        {s}
      </span>
    );
  };

  const relativeTime = (date: string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: 28,
          color: "#1A1624",
          margin: 0,
        }}>Dashboard</h1>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: "#999", margin: "4px 0 0" }}>
          Overview of users, subscriptions, and activity
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        {statCard(String(totalUsers), "Total Users")}
        {statCard(String(proUsers), "Pro Users")}
        {statCard(`$${mrr.toLocaleString()}`, "MRR")}
        {statCard(String(newUsersWeek), "New (7 days)")}
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e0d8",
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: 14,
            outline: "none",
            background: "#fff",
          }}
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e5e0d8",
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="all">All Tiers</option>
          <option value="trial">Trial</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </select>
        <button
          onClick={exportCSV}
          style={{
            padding: "10px 18px",
            borderRadius: 9999,
            border: "1px solid #e5e0d8",
            background: "#fff",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            color: "#1A1624",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedUserIds.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          padding: "10px 16px",
          borderRadius: 12,
          background: "rgba(255,91,29,0.06)",
          border: "1px solid rgba(255,91,29,0.15)",
        }}>
          <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>
            {selectedUserIds.length} selected
          </span>
          <button onClick={() => setShowBulkTierDialog(true)} style={{ padding: "6px 14px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Change Tier
          </button>
          <button onClick={() => bulkResetMutation.mutate({ userIds: selectedUserIds })} style={{ padding: "6px 14px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Reset Quota
          </button>
          <button onClick={() => setSelectedUserIds([])} style={{ marginLeft: "auto", background: "none", border: "none", color: "#999", fontSize: 12, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif" }}>
            Clear
          </button>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf8f5" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", width: 40 }}>
                <input type="checkbox" checked={selectedUserIds.length > 0 && selectedUserIds.length === (filteredUsers?.length ?? 0)} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Email</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Tier</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Joined</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Last Active</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers?.map((u: any) => {
              return (

                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,91,29,0.03)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <td style={{ padding: "14px 16px" }}>
                    <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleSelectUser(u.id)} />
                  </td>
                  <td style={{ padding: "14px 16px", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1624" }}>
                    {u.email || "—"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>{tierBadge(u.subscriptionTier)}</td>
                  <td style={{ padding: "14px 16px" }}>{statusDot(u.subscriptionStatus)}</td>
                  <td style={{ padding: "14px 16px", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "#999" }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "14px 16px", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "#999" }}>
                    {relativeTime(u.lastSignedIn)}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setSelectedUser(u); setNewTier(u.subscriptionTier || "trial"); setShowTierDialog(true); }}
                        style={{ padding: "4px 10px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#1A1624" }}>
                        Edit
                      </button>
                      <button onClick={() => { setSelectedUser(u); setShowResetDialog(true); }}
                        style={{ padding: "4px 10px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#999" }}>
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredUsers?.length === 0 && (
          <p style={{ textAlign: "center", padding: 32, color: "#999", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14 }}>
            No users found.
          </p>
        )}
      </div>

      {/* Keep all existing shadcn dialogs */}
      <Dialog open={showBulkTierDialog} onOpenChange={setShowBulkTierDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Change Tier</DialogTitle><DialogDescription>Change tier for {selectedUserIds.length} selected users.</DialogDescription></DialogHeader>
          <div className="py-4">
            <Select value={bulkNewTier} onValueChange={(v: any) => setBulkNewTier(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="trial">Trial</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="agency">Agency</SelectItem></SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTierDialog(false)}>Cancel</Button>
            <Button onClick={() => bulkTierMutation.mutate({ userIds: selectedUserIds, newTier: bulkNewTier })} disabled={bulkTierMutation.isPending}>{bulkTierMutation.isPending ? "Updating…" : "Update Tier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuperuserDialog} onOpenChange={setShowSuperuserDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{superuserAction === "grant" ? "Grant Superuser" : "Revoke Superuser"}</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuperuserDialog(false)}>Cancel</Button>
            <Button onClick={() => superuserAction === "grant" ? createSuperUserMutation.mutate({ userId: superuserTarget?.id }) : revokeSuperUserMutation.mutate({ userId: superuserTarget?.id })} disabled={createSuperUserMutation.isPending || revokeSuperUserMutation.isPending}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset User Quota</DialogTitle><DialogDescription>Reset all counts for <strong>{selectedUser?.name || selectedUser?.email}</strong>?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button onClick={handleResetQuota} disabled={resetQuotaMutation.isPending}>{resetQuotaMutation.isPending ? "Resetting..." : "Reset Quota"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change User Tier</DialogTitle><DialogDescription>Update tier for <strong>{selectedUser?.name || selectedUser?.email}</strong>.</DialogDescription></DialogHeader>
          <div className="py-4">
            <Select value={newTier} onValueChange={(value: any) => setNewTier(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="trial">Trial</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="agency">Agency</SelectItem></SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTierDialog(false)}>Cancel</Button>
            <Button onClick={handleOverrideTier} disabled={overrideTierMutation.isPending}>{overrideTierMutation.isPending ? "Updating..." : "Update Tier"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
