import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

function SignupChart({ allUsers }: { allUsers: any[] }) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const chartData = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const counts: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      counts[d.toISOString().slice(0, 10)] = 0;
    }

    allUsers.forEach((u: any) => {
      if (!u.createdAt) return;
      const key = new Date(u.createdAt).toISOString().slice(0, 10);
      if (key in counts) counts[key]++;
    });

    return Object.entries(counts).map(([date, signups]) => ({
      date: date.slice(5),
      signups,
    }));
  }, [allUsers, range]);

  const pills: Array<"7d" | "30d" | "90d"> = ["7d", "30d", "90d"];

  return (
    <div style={{ background: "#fff", borderRadius: 24, padding: 24, marginBottom: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 18, color: "#1A1624", margin: 0 }}>
          Signups
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          {pills.map((p) => (
            <button
              key={p}
              onClick={() => setRange(p)}
              style={{
                padding: "5px 14px",
                borderRadius: 9999,
                border: range === p ? "none" : "1px solid #e5e0d8",
                background: range === p ? "#FF5B1D" : "#fff",
                color: range === p ? "#fff" : "#999",
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#999", fontFamily: "'Instrument Sans', sans-serif" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#999", fontFamily: "'Instrument Sans', sans-serif" }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e0d8",
              borderRadius: 12,
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: 13,
            }}
          />
          <Line type="monotone" dataKey="signups" stroke="#FF5B1D" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

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
  const { data: engagementMetrics } = trpc.admin.getEngagementMetrics.useQuery();
  const { data: systemHealth } = trpc.admin.getSystemHealth.useQuery();

  // New mutations
  const extendTrialMutation = trpc.admin.extendTrial.useMutation({ onSuccess: () => { toast.success("Trial extended by 7 days"); refetchUsers(); }, onError: () => toast.error("Failed to extend trial") });
  const sendMagicLinkMutation = trpc.admin.sendMagicLink.useMutation({ onSuccess: () => toast.success("Magic link sent"), onError: () => toast.error("Failed to send magic link") });
  const impersonateMutation = trpc.admin.impersonateUser.useMutation({ onSuccess: (data: any) => { localStorage.setItem("admin_original_token", document.cookie); document.cookie = `session=${data.token}; path=/; max-age=3600`; localStorage.setItem("impersonating", data.email); window.location.href = "/v2-dashboard"; }, onError: () => toast.error("Impersonation failed") });
  const updateNotesMutation = trpc.admin.updateUserNotes.useMutation({ onSuccess: () => { toast.success("Notes saved"); refetchUsers(); }, onError: () => toast.error("Failed to save notes") });

  const [activityFilter, setActivityFilter] = useState("all");
  const [editNotesUser, setEditNotesUser] = useState<any>(null);
  const [notesText, setNotesText] = useState("");

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
    let matchesActivity = true;
    if (activityFilter !== "all" && u.lastSignedIn) {
      const daysSince = Math.floor((Date.now() - new Date(u.lastSignedIn).getTime()) / (1000*60*60*24));
      if (activityFilter === "active7") matchesActivity = daysSince <= 7;
      else if (activityFilter === "inactive7_14") matchesActivity = daysSince > 7 && daysSince <= 14;
      else if (activityFilter === "inactive14") matchesActivity = daysSince > 14;
    }
    return matchesSearch && matchesTier && matchesActivity;
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

      {/* Revenue Row 2 */}
      {financialMetrics && (
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {statCard(`$${(financialMetrics.arr || 0).toLocaleString()}`, "ARR")}
          {statCard(`$${(financialMetrics.arpu || 0).toFixed(0)}`, "ARPU")}
          {statCard(`${(financialMetrics.trialToProRate || 0).toFixed(1)}%`, "Trial → Pro")}
          <div style={{ background: "#fff", borderRadius: 24, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flex: 1, minWidth: 140 }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 32, color: financialMetrics.churnedThisMonth > 0 ? "#C0390A" : "#22C55E", margin: 0, lineHeight: 1.1 }}>{financialMetrics.churnedThisMonth}</p>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", margin: "8px 0 0" }}>Churned (30d)</p>
          </div>
          {statCard(`$${(financialMetrics.newMrrThisMonth || 0).toLocaleString()}`, "New MRR (30d)")}
        </div>
      )}

      {/* Engagement Row */}
      {engagementMetrics && (
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {statCard(String(engagementMetrics.dau), "DAU")}
          {statCard(String(engagementMetrics.wau), "WAU")}
          {statCard(String(engagementMetrics.avgNodes), "Avg Nodes/Kit")}
          {statCard(`${engagementMetrics.completionRate}%`, "Kit Completion")}
          {statCard(`${engagementMetrics.activationRate}%`, "Activation Rate")}
        </div>
      )}

      {/* Signup Chart */}
      <SignupChart allUsers={allUsers || []} />

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
        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, background: "#fff", cursor: "pointer" }}
        >
          <option value="all">All Activity</option>
          <option value="active7">Active (7d)</option>
          <option value="inactive7_14">Inactive (7-14d)</option>
          <option value="inactive14">Inactive (14d+)</option>
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
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button onClick={() => { setSelectedUser(u); setNewTier(u.subscriptionTier || "trial"); setShowTierDialog(true); }}
                        style={{ padding: "4px 8px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#1A1624" }}>
                        Edit
                      </button>
                      {u.subscriptionTier === "trial" && (
                        <button onClick={() => extendTrialMutation.mutate({ userId: u.id })}
                          style={{ padding: "4px 8px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#FF5B1D" }}>
                          +7d Trial
                        </button>
                      )}
                      <button onClick={() => sendMagicLinkMutation.mutate({ email: u.email })}
                        style={{ padding: "4px 8px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#8B5CF6" }}>
                        Link
                      </button>
                      <button onClick={() => { setEditNotesUser(u); setNotesText(u.notes || ""); }}
                        style={{ padding: "4px 8px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#999" }}>
                        Notes
                      </button>
                      <button onClick={() => impersonateMutation.mutate({ userId: u.id })}
                        style={{ padding: "4px 8px", borderRadius: 9999, border: "1px solid #C0390A", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#C0390A" }}>
                        View As
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

      {/* System Health */}
      <div style={{ background: "#fff", borderRadius: 24, padding: 24, marginTop: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 18, color: "#1A1624", margin: "0 0 16px" }}>System Health</h3>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: systemHealth?.serverStatus === "online" ? "#22C55E" : "#EF4444", display: "inline-block" }} />
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13 }}>{systemHealth?.serverStatus === "online" ? "Server Online" : "Server Offline"}</span>
          </div>
          <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "#999" }}>Jobs completed: {systemHealth?.totalCompletedJobs ?? "—"}</span>
        </div>
        {systemHealth?.recentErrors && systemHealth.recentErrors.length > 0 && (
          <>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#C0390A", marginBottom: 8 }}>Recent Errors ({systemHealth.recentErrors.length})</p>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {systemHealth.recentErrors.map((e: any) => (
                <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", fontFamily: "'Instrument Sans', sans-serif", fontSize: 12 }}>
                  <span style={{ color: "#999" }}>{new Date(e.createdAt).toLocaleString()}</span>
                  <span style={{ marginLeft: 8, color: "#C0390A" }}>{e.error?.slice(0, 100)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notes Modal */}
      {editNotesUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,22,36,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setEditNotesUser(null)}>
          <div style={{ background: "#fff", borderRadius: 24, padding: 32, maxWidth: 440, width: "90%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 18, margin: "0 0 8px" }}>Notes — {editNotesUser.email}</h3>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Internal notes about this user..."
              style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: 12, border: "1px solid #e5e0d8", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setEditNotesUser(null)} style={{ padding: "8px 16px", borderRadius: 9999, border: "1px solid #e5e0d8", background: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { updateNotesMutation.mutate({ userId: editNotesUser.id, notes: notesText }); setEditNotesUser(null); }}
                style={{ padding: "8px 16px", borderRadius: 9999, border: "none", background: "#FF5B1D", color: "#fff", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}

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
