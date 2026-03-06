import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, User, CreditCard, BarChart3, FileText, MessageSquare, Shield, StickyNote, Plus, RotateCcw, Gift } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  trial: "bg-gray-100 text-gray-700",
  pro: "bg-blue-100 text-blue-700",
  agency: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-yellow-100 text-yellow-700",
  canceled: "bg-red-100 text-red-700",
  past_due: "bg-orange-100 text-orange-700",
};

const GENERATOR_TYPES = [
  { value: "headline", label: "Headlines" },
  { value: "hvco", label: "Free Opt-In (HVCO)" },
  { value: "hero", label: "Hero Mechanism" },
  { value: "icp", label: "Ideal Customer" },
  { value: "adCopy", label: "Ad Copy" },
  { value: "email", label: "Email Sequences" },
  { value: "whatsapp", label: "WhatsApp Sequences" },
  { value: "landingPage", label: "Landing Pages" },
  { value: "offer", label: "Sales Offers" },
];

export default function AdminUserDetail() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId || "0", 10);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [noteText, setNoteText] = useState("");
  const [newTier, setNewTier] = useState<"trial" | "pro" | "agency">("trial");
  const [bonusType, setBonusType] = useState<string>("icp");
  const [bonusAmount, setBonusAmount] = useState(5);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<"period_end" | "immediate">("period_end");

  // Queries
  const allUsers = trpc.admin.getAllUsers.useQuery();
  const user = allUsers.data?.find((u) => u.id === userId);
  const subDetails = trpc.admin.getUserSubscriptionDetails.useQuery({ userId }, { enabled: !!userId });
  const auditLog = trpc.admin.getAuditLogForUser.useQuery({ userId }, { enabled: !!userId });
  const notes = trpc.admin.getUserNotes.useQuery({ userId }, { enabled: !!userId });

  // Mutations
  const addNote = trpc.admin.addUserNote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      setNoteText("");
      utils.admin.getUserNotes.invalidate({ userId });
    },
    onError: () => toast.error("Failed to add note"),
  });

  const overrideTier = trpc.admin.overrideUserTier.useMutation({
    onSuccess: () => {
      toast.success("Tier updated");
      setTierDialogOpen(false);
      utils.admin.getAllUsers.invalidate();
    },
    onError: () => toast.error("Failed to update tier"),
  });

  const resetQuota = trpc.admin.resetUserQuota.useMutation({
    onSuccess: () => {
      toast.success("Quota reset to 0");
      utils.admin.getAllUsers.invalidate();
    },
    onError: () => toast.error("Failed to reset quota"),
  });

  const grantBonus = trpc.admin.grantBonusQuota.useMutation({
    onSuccess: () => {
      toast.success(`Granted ${bonusAmount} bonus uses`);
      setBonusDialogOpen(false);
      utils.admin.getAllUsers.invalidate();
    },
    onError: () => toast.error("Failed to grant bonus"),
  });

  const cancelSub = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription cancellation queued");
      setCancelDialogOpen(false);
      utils.admin.getAllUsers.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to cancel subscription"),
  });

  if (allUsers.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
        </Button>
      </div>
    );
  }

  const quotaFields = [
    { label: "Headlines", count: user.headlineGeneratedCount },
    { label: "HVCO", count: user.hvcoGeneratedCount },
    { label: "Hero Mechanisms", count: user.heroMechanismGeneratedCount },
    { label: "ICP", count: user.icpGeneratedCount },
    { label: "Ad Copy", count: user.adCopyGeneratedCount },
    { label: "Email Sequences", count: user.emailSeqGeneratedCount },
    { label: "WhatsApp Sequences", count: user.whatsappSeqGeneratedCount },
    { label: "Landing Pages", count: user.landingPageGeneratedCount },
    { label: "Sales Offers", count: user.offerGeneratedCount },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{user.name || "Unnamed User"}</h1>
          <p className="text-muted-foreground text-sm">{user.email} · ID #{user.id}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge className={TIER_COLORS[user.subscriptionTier || "trial"]}>
            {(user.subscriptionTier || "trial").toUpperCase()}
          </Badge>
          <Badge className={STATUS_COLORS[user.subscriptionStatus || "trialing"]}>
            {user.subscriptionStatus || "trialing"}
          </Badge>
          {user.role === "admin" && <Badge className="bg-red-100 text-red-700">ADMIN</Badge>}
          {user.role === "superuser" && <Badge className="bg-purple-100 text-purple-700">SUPERUSER</Badge>}
        </div>
      </div>

      {/* Section 1: Profile & Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile & Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Name</p><p className="font-medium">{user.name || "—"}</p></div>
            <div><p className="text-muted-foreground">Email</p><p className="font-medium">{user.email}</p></div>
            <div><p className="text-muted-foreground">Role</p><p className="font-medium capitalize">{user.role || "user"}</p></div>
            <div><p className="text-muted-foreground">Joined</p><p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p></div>
            <div><p className="text-muted-foreground">Last Sign-In</p><p className="font-medium">{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : "Never"}</p></div>
            <div><p className="text-muted-foreground">Stripe Customer</p><p className="font-medium font-mono text-xs">{user.stripeCustomerId || "—"}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
            <div><p className="text-muted-foreground">Tier</p><p className="font-medium capitalize">{user.subscriptionTier || "trial"}</p></div>
            <div><p className="text-muted-foreground">Status</p><p className="font-medium capitalize">{user.subscriptionStatus || "—"}</p></div>
            <div><p className="text-muted-foreground">Subscription ID</p><p className="font-medium font-mono text-xs">{user.stripeSubscriptionId || "—"}</p></div>
            {subDetails.data && (
              <>
                <div><p className="text-muted-foreground">Current Period End</p><p className="font-medium">{(subDetails.data as any).subscription?.current_period_end ? new Date((subDetails.data as any).subscription.current_period_end * 1000).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-muted-foreground">Cancel at Period End</p><p className="font-medium">{(subDetails.data as any).subscription?.cancel_at_period_end ? "Yes" : "No"}</p></div>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Change Tier</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Override Subscription Tier</DialogTitle></DialogHeader>
                <Select value={newTier} onValueChange={(v) => setNewTier(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="pro">Pro ($49/mo)</SelectItem>
                    <SelectItem value="agency">Agency ($199/mo)</SelectItem>
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button onClick={() => overrideTier.mutate({ userId, newTier })} disabled={overrideTier.isPending}>
                    {overrideTier.isPending ? "Saving…" : "Confirm Change"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) setCancelMode("period_end"); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Cancel Subscription</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">
                  You are about to cancel the subscription for <strong>{user?.name || user?.email}</strong>. Choose how to cancel:
                </p>
                <div className="space-y-3 mb-2">
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
                    style={{ borderColor: cancelMode === "period_end" ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                  >
                    <input
                      type="radio"
                      name="cancelMode"
                      value="period_end"
                      checked={cancelMode === "period_end"}
                      onChange={() => setCancelMode("period_end")}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">Cancel at end of billing period</p>
                      <p className="text-xs text-muted-foreground">Access continues until the current period ends. No further charges.</p>
                    </div>
                  </label>
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors"
                    style={{ borderColor: cancelMode === "immediate" ? "hsl(var(--destructive))" : "hsl(var(--border))" }}
                  >
                    <input
                      type="radio"
                      name="cancelMode"
                      value="immediate"
                      checked={cancelMode === "immediate"}
                      onChange={() => setCancelMode("immediate")}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">Cancel immediately</p>
                      <p className="text-xs text-muted-foreground">Access ends now. No refund is issued.</p>
                    </div>
                  </label>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelMode("period_end"); }}>Keep Subscription</Button>
                  <Button
                    variant="destructive"
                    onClick={() => cancelSub.mutate({ userId, cancelAtPeriodEnd: cancelMode === "period_end" })}
                    disabled={cancelSub.isPending}
                  >
                    {cancelSub.isPending ? "Canceling…" : "Confirm Cancel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Quota Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Quota Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
            {quotaFields.map((q) => (
              <div key={q.label} className="text-center p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold">{q.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{q.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => resetQuota.mutate({ userId })} disabled={resetQuota.isPending}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {resetQuota.isPending ? "Resetting…" : "Reset All Quota"}
            </Button>
            <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Gift className="h-3.5 w-3.5 mr-1.5" /> Grant Bonus Uses
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Grant Bonus Quota</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Generator</label>
                    <Select value={bonusType} onValueChange={setBonusType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENERATOR_TYPES.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Number of extra uses</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(parseInt(e.target.value) || 1)}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => grantBonus.mutate({ userId, generatorType: bonusType as any, amount: bonusAmount })} disabled={grantBonus.isPending}>
                    {grantBonus.isPending ? "Granting…" : "Grant Bonus"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Audit Log for this user */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Admin Actions on This User
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLog.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !auditLog.data || (auditLog.data as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(auditLog.data as any[]).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                  <div className="flex-1">
                    <span className="font-medium font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{entry.action_type}</span>
                    <span className="text-muted-foreground ml-2">by {entry.admin_name || "Admin"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Internal Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" /> Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
            {notes.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !notes.data || (notes.data as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              (notes.data as any[]).map((note: any) => (
                <div key={note.id} className="p-3 rounded-lg bg-muted/40 text-sm">
                  <p>{note.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">{note.admin_name} · {new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add an internal note about this user…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <Button
              size="sm"
              className="shrink-0 self-end"
              onClick={() => addNote.mutate({ userId, note: noteText })}
              disabled={!noteText.trim() || addNote.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
